import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function AttendanceSummary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(null);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, logsRes] = await Promise.all([
        api.get(`/attendance/summary?date=${date}`),
        api.get(`/attendance/daily?date=${date}`)
      ]);
      setSummary(sumRes.data.summary);
      setDailyLogs(logsRes.data.attendances);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Attendance Analytics</h2>
        <input 
          type="date" 
          value={date} 
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setDate(e.target.value)} 
          className="p-2 border rounded shadow-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {loading ? <div className="p-10 text-center">Loading...</div> : (
        <>
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Marked</div>
              <div className="text-2xl font-black">{summary?.totalMarked || 0} / {summary?.totalStudents || 0}</div>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Present</div>
              <div className="text-2xl font-black text-green-700">{summary?.PRESENT || 0}</div>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Absent</div>
              <div className="text-2xl font-black text-red-700">{summary?.ABSENT || 0}</div>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">On Leave</div>
              <div className="text-2xl font-black text-purple-700">{summary?.ON_LEAVE || 0}</div>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-orange-500">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Late Return</div>
              <div className="text-2xl font-black text-orange-700">{summary?.LATE_RETURN || 0}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow border mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Overall Attendance Rate</h3>
              <p className="text-gray-500 text-sm">Percentage of marked students who are PRESENT</p>
            </div>
            <div className="text-4xl font-black text-blue-600">{summary?.attendancePercentage || 0}%</div>
          </div>

          {/* Daily Logs Table */}
          <h3 className="text-xl font-bold mb-4">Detailed Logs for {new Date(date).toDateString()}</h3>
          <div className="bg-white rounded shadow border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Remarks</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Marked At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailyLogs.map(log => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{log.studentId?.fullName}</div>
                      <div className="text-xs text-gray-500">{log.studentId?.admissionNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                      {log.roomId?.roomNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        log.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                        log.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                        log.status === 'ON_LEAVE' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {log.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.remarks || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.markedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {dailyLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">No attendance records found for this date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
