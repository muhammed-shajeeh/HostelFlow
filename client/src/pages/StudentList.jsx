import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeftRight, History, X, RefreshCw, AlertCircle, CheckSquare, ShieldCheck, HelpCircle } from 'lucide-react';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Reassignment Modal States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History Modal States
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    const handleRoomTransferred = (e) => {
      const transfer = e.detail;
      setStudents(prev => {
        return prev.map(s => {
          if (s._id === transfer.studentId) {
            return {
              ...s,
              roomId: s.roomId ? {
                ...s.roomId,
                _id: transfer.newRoomId,
                roomNumber: transfer.newRoomNumber
              } : {
                _id: transfer.newRoomId,
                roomNumber: transfer.newRoomNumber
              },
              bedNumber: transfer.newBedNumber
            };
          }
          return s;
        });
      });
    };

    const handleStudentApproved = (e) => {
      const student = e.detail;
      setStudents(prev => {
        if (prev.some(s => s._id === student.studentId)) return prev;
        return [...prev, {
          _id: student.studentId,
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          hostelId: student.hostelId,
          roomId: {
            _id: student.roomId,
            roomNumber: student.roomNumber
          },
          bedNumber: student.bedNumber,
          approvalStatus: 'APPROVED'
        }];
      });
    };

    window.addEventListener('erp:roomTransferred', handleRoomTransferred);
    window.addEventListener('erp:studentApproved', handleStudentApproved);
    return () => {
      window.removeEventListener('erp:roomTransferred', handleRoomTransferred);
      window.removeEventListener('erp:studentApproved', handleStudentApproved);
    };
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      // Filter out pending and rejected for this view
      const approved = res.data.students.filter(s => s.approvalStatus === 'APPROVED');
      setStudents(approved);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  // Fetch only available, inactive-filtered rooms for reassignment
  const fetchAvailableRooms = async (hostelId) => {
    if (!hostelId) return;
    setLoadingRooms(true);
    try {
      const res = await api.get(`/rooms/available/${hostelId}`);
      setRooms(res.data.rooms || []);
    } catch (error) {
      toast.error('Failed to load available rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const openReassignModal = (student) => {
    setSelectedStudent(student);
    setTargetRoomId('');
    setTransferReason('');
    fetchAvailableRooms(student.hostelId);
  };

  const handleReassignmentSubmit = async (e) => {
    e.preventDefault();
    if (!targetRoomId) {
      toast.error('Please select a target room');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/students/${selectedStudent._id}/change-room`, {
        newRoomId: targetRoomId,
        reason: transferReason
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Room shifted successfully!');
        setSelectedStudent(null);
        fetchStudents();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign student room');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchTransferHistory = async () => {
    setLoadingHistory(true);
    setShowHistory(true);
    try {
      const res = await api.get('/students/room-transfers/history');
      setHistoryList(res.data.history || []);
    } catch (error) {
      toast.error('Failed to load transfer history');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100">Current Residents</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Manage room placements and track shifting audit logs</p>
        </div>
        <button
          onClick={fetchTransferHistory}
          className="flex items-center gap-2 bg-slate-800 dark:bg-zinc-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <History size={15} /> Room Shift Logs
        </button>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500 font-bold dark:text-zinc-400">
          <RefreshCw className="animate-spin inline-block mr-2 text-blue-500" size={24} />
          Retrieving approved resident profiles...
        </div>
      ) : isMobile ? (
        <div className="space-y-4">
          {students.map(student => (
            <div key={student._id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition text-slate-800 dark:text-zinc-150">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{student.fullName}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">{student.email}</p>
                  </div>
                  {student.roomId ? (
                    <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                      Room: {student.roomId.roomNumber}
                    </span>
                  ) : (
                    <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                      Not Allocated
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 dark:border-zinc-855 text-xs text-slate-650 dark:text-zinc-400">
                  <div>
                    <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Admission No</span>
                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{student.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Department</span>
                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{student.department}</span>
                  </div>
                  {student.roomId && (
                    <>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Bed Number</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">Bed {student.bedNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Floor Level</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">Floor {student.roomId.floor}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  onClick={() => openReassignModal(student)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-55 hover:bg-blue-100 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <ArrowLeftRight size={13} /> Reassign Room
                </button>
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-450 dark:text-zinc-500 font-bold italic">
              No approved active hostel residents found.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-100 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-850">
              <thead className="bg-slate-50 dark:bg-zinc-950">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Name & Account</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Admission No</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Room Placement</th>
                  <th className="px-6 py-3.5 text-right text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 bg-white dark:bg-zinc-900">
                {students.map(student => (
                  <tr key={student._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-zinc-150">{student.fullName}</div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500">{student.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-zinc-400">
                      {student.admissionNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-650 dark:text-zinc-400 font-bold">
                      {student.department} <span className="opacity-60">| Y{student.year} (S{student.semester})</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.roomId ? (
                        <div className="text-xs">
                          <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                            Room {student.roomId.roomNumber}
                          </span>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 pl-0.5">
                            Bed {student.bedNumber} | Floor {student.roomId.floor}
                          </div>
                        </div>
                      ) : (
                        <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                          Not Allocated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openReassignModal(student)}
                        className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <ArrowLeftRight size={13} /> Reassign Room
                      </button>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-450 dark:text-zinc-500">
                      No approved active hostel residents found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REASSIGNMENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/40">
              <div>
                <h3 className="font-black text-md text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-blue-600 dark:text-blue-400" />
                  Shift Resident Room
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase font-mono">
                  Resident: {selectedStudent.fullName}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleReassignmentSubmit} className="p-6 space-y-5">
              
              {/* Current Room Placement */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 text-xs space-y-2">
                <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-1">Current Placement</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Room Number</span>
                    <strong className="text-slate-700 dark:text-zinc-200 font-bold">
                      {selectedStudent.roomId?.roomNumber ? `Room ${selectedStudent.roomId.roomNumber}` : 'Unassigned'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Bed Position</span>
                    <strong className="text-slate-700 dark:text-zinc-200 font-bold">
                      {selectedStudent.bedNumber ? `Bed ${selectedStudent.bedNumber}` : 'Unassigned'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Target Room Selection Dropdown */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 pl-0.5">Target Room Assignment</label>
                {loadingRooms ? (
                  <div className="text-xs text-slate-400 py-2.5">Querying available hostel rooms...</div>
                ) : (
                  <select
                    required
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900 text-sm font-bold text-slate-800 dark:text-zinc-150"
                  >
                    <option value="">-- Select Available Room --</option>
                    {rooms.map(room => (
                      <option key={room._id} value={room._id}>
                        Room {room.roomNumber} — Floor {room.floor} ({room.availableBeds} beds remaining)
                      </option>
                    ))}
                  </select>
                )}
                {rooms.length === 0 && !loadingRooms && (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-2 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> No available rooms with free capacity inside this hostel.
                  </p>
                )}
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 pl-0.5">Shift & Transfer Reason</label>
                <textarea
                  required
                  rows="3"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="E.g. Roommate conflict, room upgrade, medical shift request..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-zinc-900"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="w-1/2 p-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-650 dark:text-zinc-300 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetRoomId}
                  className="w-1/2 p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Shifting...' : 'Confirm Transfer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* SHIFT LOGS HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/40">
              <div>
                <h3 className="font-black text-md text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <History size={18} className="text-blue-600 dark:text-blue-400" />
                  Room Shifting Audit History
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase">
                  Official hostel room transfer logs for traceability
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
              {loadingHistory ? (
                <div className="text-center py-10 font-bold text-slate-400">Loading audit history...</div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                  <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
                  No student room shifting records found.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {historyList.map(log => (
                    <div key={log._id} className="p-4 border border-slate-100 dark:border-zinc-850 rounded-2xl bg-slate-50/50 dark:bg-zinc-950/10 space-y-3 text-xs">
                      
                      {/* Top Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <strong className="text-slate-800 dark:text-zinc-100 text-sm font-black block">
                            {log.studentId?.fullName || 'Resident'}
                          </strong>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            Admission: {log.studentId?.admissionNumber || 'N/A'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 px-2 py-0.5 rounded-lg">
                          {new Date(log.transferredAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* Room change comparison */}
                      <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-850/60 font-bold">
                        <div className="text-slate-400 uppercase text-[9px] tracking-widest pl-1">Shift</div>
                        <div className="bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-zinc-300">
                          {log.oldRoomId ? `Room ${log.oldRoomId.roomNumber}` : 'Unassigned'}
                        </div>
                        <span className="text-slate-400 font-bold">&rarr;</span>
                        <div className="bg-blue-600 text-white px-2.5 py-0.5 rounded text-[10px]">
                          Room {log.newRoomId?.roomNumber || 'Room'}
                        </div>
                      </div>

                      {/* Log details */}
                      <div className="grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
                        <div>
                          <span className="text-slate-400 block">Authorized By</span>
                          <strong className="text-slate-650 dark:text-zinc-400 font-bold">
                            {log.transferredBy?.fullName || 'Warden'} ({log.transferredBy?.role})
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Reason</span>
                          <em className="text-slate-650 dark:text-zinc-400 not-italic font-semibold block line-clamp-2">
                            "{log.reason}"
                          </em>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
