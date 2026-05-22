import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import NativeSelect from '../components/NativeSelect';

export default function AttendanceMark() {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      if (user.role === 'ADMIN') {
        const hRes = await api.get('/hostels');
        if (hRes.data.hostels.length > 0) {
          const rRes = await api.get(`/rooms/hostel/${hRes.data.hostels[0]._id}`);
          setRooms(rRes.data.rooms);
        }
      } else {
        // user.hostelId is a populated object after getMe populate(); extract ._id for URL
        const rRes = await api.get(`/rooms/hostel/${user.hostelId?._id}`);
        setRooms(rRes.data.rooms);
      }
    } catch (error) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomStudents = async (roomId) => {
    if (!roomId) return;
    setFetchingStudents(true);
    try {
      // First get the approved students in the room
      const res = await api.get(`/students?roomId=${roomId}&approvalStatus=APPROVED`);
      setStudents(res.data.students);

      // Initialize attendance state (default all PRESENT)
      const initialRecords = {};
      res.data.students.forEach(student => {
        initialRecords[student._id] = { status: 'PRESENT', remarks: '' };
      });
      setAttendanceRecords(initialRecords);

      // Attempt to fetch already marked attendance for this date
      const attRes = await api.get(`/attendance/daily?date=${date}&roomId=${roomId}`);
      if (attRes.data.attendances && attRes.data.attendances.length > 0) {
        const existingRecords = { ...initialRecords };
        attRes.data.attendances.forEach(att => {
          existingRecords[att.studentId._id] = { status: att.status, remarks: att.remarks || '' };
        });
        setAttendanceRecords(existingRecords);
        toast.success('Loaded existing attendance for this date');
      }

    } catch (error) {
      toast.error('Failed to load students');
    } finally {
      setFetchingStudents(false);
    }
  };

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomStudents(selectedRoomId);
    } else {
      setStudents([]);
    }
  }, [selectedRoomId, date]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks }
    }));
  };

  const handleSubmit = async () => {
    if (!selectedRoomId) return toast.error('Please select a room');
    if (students.length === 0) return toast.error('No students in this room');

    setSubmitting(true);
    try {
      const recordsArray = Object.keys(attendanceRecords).map(studentId => ({
        studentId,
        status: attendanceRecords[studentId].status,
        remarks: attendanceRecords[studentId].remarks
      }));

      await api.post('/attendance/mark', {
        roomId: selectedRoomId,
        date,
        attendanceRecords: recordsArray
      });

      toast.success('Attendance saved successfully!');
      // Reload to reflect potential auto-detected leaves
      loadRoomStudents(selectedRoomId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const markAll = (status) => {
    const updated = {};
    Object.keys(attendanceRecords).forEach(id => {
      updated[id] = { ...attendanceRecords[id], status };
    });
    setAttendanceRecords(updated);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Mark Room Attendance</h2>

      {loading ? <div className="p-10 text-center">Loading...</div> : (
        <>
          <div className="bg-white p-6 rounded shadow border mb-6 flex flex-wrap gap-6 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Floor</label>
              <NativeSelect
                value={selectedFloor}
                onChange={(e) => {
                  setSelectedFloor(e.target.value);
                  setSelectedRoomId(''); // Reset room when floor changes
                  setStudents([]);
                }}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs font-bold"
              >
                <option value="">-- Select Floor --</option>
                {[...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b).map(floor => (
                  <option key={floor} value={floor}>Floor {floor}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Room</label>
              <NativeSelect
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                disabled={!selectedFloor}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100 text-xs font-bold"
              >
                <option value="">-- Select Room --</option>
                {rooms.filter(r => r.floor.toString() === selectedFloor.toString()).map(r => (
                  <option key={r._id} value={r._id}>Room {r.roomNumber}</option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {selectedRoomId && (
            <div className="bg-white rounded shadow border overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">Students in Room</h3>
                {students.length > 0 && (
                  <div className="space-x-2">
                    <button onClick={() => markAll('PRESENT')} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded font-bold hover:bg-green-200">Mark All Present</button>
                    <button onClick={() => markAll('ABSENT')} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded font-bold hover:bg-red-200">Mark All Absent</button>
                  </div>
                )}
              </div>

              {fetchingStudents ? <div className="p-10 text-center">Loading students...</div> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Remarks (Optional)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map(student => (
                        <tr key={student._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{student.fullName}</div>
                            <div className="text-xs text-gray-500">{student.admissionNumber}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {['PRESENT', 'ABSENT', 'ON_LEAVE', 'LATE_RETURN'].map(status => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(student._id, status)}
                                  className={`px-3 py-1 text-xs font-bold rounded border ${attendanceRecords[student._id]?.status === status
                                      ? status === 'PRESENT' ? 'bg-green-600 text-white border-green-600'
                                        : status === 'ABSENT' ? 'bg-red-600 text-white border-red-600'
                                          : status === 'ON_LEAVE' ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-orange-600 text-white border-orange-600'
                                      : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                  {status.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                            {attendanceRecords[student._id]?.status === 'ON_LEAVE' && <div className="text-[10px] text-purple-600 mt-1">* Will be auto-verified against leave DB</div>}
                            {attendanceRecords[student._id]?.status === 'LATE_RETURN' && <div className="text-[10px] text-orange-600 mt-1">* Student has breached expected return time</div>}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              placeholder="Add note..."
                              value={attendanceRecords[student._id]?.remarks || ''}
                              onChange={(e) => handleRemarksChange(student._id, e.target.value)}
                              className="w-full text-sm p-2 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-6 py-10 text-center text-gray-500">No approved students assigned to this room yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {students.length > 0 && !fetchingStudents && (
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-blue-600 text-white font-bold px-6 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {submitting ? 'Saving...' : 'Save Room Attendance'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
