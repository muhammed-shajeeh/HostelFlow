import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [dashRes, leavesRes, attRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/leaves/stats'),
        api.get(`/attendance/summary?date=${new Date().toISOString().split('T')[0]}`)
      ]);
      setStats(dashRes.data.stats);
      setLeaveStats(leavesRes.data.stats);
      setAttendanceStats(attRes.data.summary);
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
      console.log('[Admin Dashboard] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStats();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    return () => window.removeEventListener('erp:refresh', handleRefresh);
  }, []);

  if (loading) {
    return <div className="text-center p-10">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Hostels</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.totalHostels || 0}</div>
        </div>
        
        <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Active Hostels</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.activeHostels || 0}</div>
        </div>
        
        <div className="bg-white p-6 rounded shadow border-l-4 border-purple-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Wardens</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.totalWardens || 0}</div>
        </div>
        
        <div className="bg-white p-6 rounded shadow border-l-4 border-orange-500">
          <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Students</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.totalStudents || 0}</div>
        </div>
      </div>
      
      {/* Leave & Attendance Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        <div className="bg-white p-6 rounded shadow border-t-4 border-purple-500">
          <h3 className="text-xl font-bold mb-4">Leave Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-sm font-bold text-purple-600 uppercase">Pending Approvals</div>
              <div className="text-3xl font-black text-purple-800">{leaveStats?.pendingLeaves || 0}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-sm font-bold text-blue-600 uppercase">Active Outside</div>
              <div className="text-3xl font-black text-blue-800">{leaveStats?.activeLeaves || 0}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow border-t-4 border-green-500">
          <h3 className="text-xl font-bold mb-4">Today's Attendance Snapshot</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded">
              <div className="text-sm font-bold text-green-600 uppercase">Present</div>
              <div className="text-3xl font-black text-green-800">{attendanceStats?.PRESENT || 0}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded">
              <div className="text-sm font-bold text-orange-600 uppercase">Late Returns</div>
              <div className="text-3xl font-black text-orange-800">{attendanceStats?.LATE_RETURN || 0}</div>
            </div>
          </div>
        </div>
        
      </div>

      <div className="mt-10 bg-white p-6 rounded shadow border">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <p className="text-gray-600 mb-4">Use the sidebar links to manage hostels and assign wardens. Ensure every hostel has an active warden assigned to handle student operations effectively.</p>
      </div>
    </div>
  );
}
