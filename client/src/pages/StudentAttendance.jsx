import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function StudentAttendance() {
  const [history, setHistory] = useState([]);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance/student/history');
      setHistory(res.data.attendances);
      setPercentage(res.data.percentage);
    } catch (error) {
      toast.error('Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">My Attendance Record</h2>

      {loading ? <div className="p-10 text-center">Loading...</div> : (
        <>
          {/* Summary Card */}
          <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500 mb-8 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Overall Attendance</h3>
              <p className="text-sm text-gray-500">Your total presence compared to total marked days.</p>
            </div>
            <div className={`text-4xl font-black ${percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
              {percentage}%
            </div>
          </div>

          <div className="bg-white rounded shadow border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map(record => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                      {new Date(record.date).toDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        record.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                        record.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                        record.status === 'ON_LEAVE' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {record.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {record.remarks || '-'}
                      {record.leaveReference && (
                        <div className="text-[10px] text-purple-600 mt-1 uppercase font-bold border border-purple-200 inline-block px-1 rounded">
                          Linked to {record.leaveReference.leaveType} Leave
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-10 text-center text-gray-500">No attendance records found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
