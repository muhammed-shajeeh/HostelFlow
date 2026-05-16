import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function WardenDashboard() {
  const [stats, setStats] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [noticeStats, setNoticeStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [statsRes, attRes, complaintRes, noticeRes] = await Promise.all([
        api.get('/leaves/stats'),
        api.get(`/attendance/summary?date=${new Date().toISOString().split('T')[0]}`),
        api.get('/complaints/stats'),
        api.get('/notices/stats')
      ]);
      setStats(statsRes.data.stats);
      setAttendanceStats(attRes.data.summary);
      setComplaintStats(complaintRes.data.stats);
      setNoticeStats(noticeRes.data.stats);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const handleRefresh = (e) => {
      console.log('[Warden Dashboard] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStats();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    return () => window.removeEventListener('erp:refresh', handleRefresh);
  }, []);

  if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Warden Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow border-l-4 border-yellow-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Pending Leaves</div>
          <div className="text-4xl font-bold text-gray-800">{stats?.pendingLeaves || 0}</div>
          <Link to="/leaves/pending" className="text-sm text-yellow-600 font-bold mt-2 inline-block hover:underline">Review Requests &rarr;</Link>
        </div>

        <div className="bg-white p-6 rounded shadow border-l-4 border-purple-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Students Outside</div>
          <div className="text-4xl font-bold text-gray-800">{stats?.studentsOutside || 0}</div>
          <Link to="/leaves/history" className="text-sm text-purple-600 font-bold mt-2 inline-block hover:underline">View Tracking &rarr;</Link>
        </div>

        <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Returned Today</div>
          <div className="text-4xl font-bold text-gray-800">{stats?.returnedToday || 0}</div>
        </div>
      </div>
      <h3 className="text-xl font-bold mb-4 mt-8">Today's Attendance Snapshot</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow border-t-4 border-green-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">Present</div>
          <div className="text-2xl font-black text-green-700">{attendanceStats?.PRESENT || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-red-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">Absent</div>
          <div className="text-2xl font-black text-red-700">{attendanceStats?.ABSENT || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-purple-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">On Leave</div>
          <div className="text-2xl font-black text-purple-700">{attendanceStats?.ON_LEAVE || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-orange-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">Late Return</div>
          <div className="text-2xl font-black text-orange-700">{attendanceStats?.LATE_RETURN || 0}</div>
        </div>
      </div>

      {/* Complaint Summary */}
      <h3 className="text-xl font-bold mb-4 mt-8">Complaint Overview</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow border-t-4 border-yellow-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">Open</div>
          <div className="text-2xl font-black text-yellow-700">{complaintStats?.openComplaints || 0}</div>
          <Link to="/complaints" className="text-xs text-yellow-600 font-bold hover:underline">View →</Link>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-blue-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">In Progress</div>
          <div className="text-2xl font-black text-blue-700">{complaintStats?.inProgress || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-red-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">🚨 Urgent</div>
          <div className="text-2xl font-black text-red-700">{complaintStats?.urgentOpen || 0}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border-t-4 border-green-500">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">Resolved</div>
          <div className="text-2xl font-black text-green-700">{complaintStats?.resolved || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-bold mb-4">Student Management</h3>
          <p className="text-gray-600 text-sm mb-4">Manage new hostel applications and existing room allocations from the student directory.</p>
          <div className="flex gap-3">
            <Link to="/students/pending" className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold hover:bg-blue-200 transition text-sm">Pending Students</Link>
            <Link to="/students/list" className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold hover:bg-blue-200 transition text-sm">Student Directory</Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-bold mb-3">Hostel Announcements</h3>
          {noticeStats?.latest?.length > 0 ? (
            <div className="space-y-2 mb-4">
              {noticeStats.latest.map(n => (
                <div key={n._id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.priority === 'EMERGENCY' ? 'bg-red-500' : n.priority === 'IMPORTANT' ? 'bg-orange-400' : 'bg-gray-300'}`}></span>
                  <span className="text-gray-700 truncate">{n.title}</span>
                  {n.isPinned && <span className="text-blue-500 text-xs">📌</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No active notices for this hostel.</p>
          )}
          <div className="flex gap-2">
            <Link to="/notices/manage" className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded font-bold hover:bg-indigo-200 transition text-sm">View All</Link>
            <Link to="/notices/create" className="bg-indigo-600 text-white px-3 py-1.5 rounded font-bold hover:bg-indigo-700 transition text-sm">+ Post Notice</Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-bold mb-4">Reports & Analytics</h3>
          <p className="text-gray-600 text-sm mb-4">Access detailed trends for attendance, complaints, and room occupancy. Generate CSV reports for administration.</p>
          <div className="flex gap-3">
            <Link to="/warden/analytics" className="bg-cyan-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-cyan-700 transition text-sm">View Analytics</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
