import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  CheckSquare, 
  AlertCircle, 
  Utensils, 
  Megaphone, 
  BarChart2, 
  ShieldAlert, 
  TrendingUp, 
  Calendar,
  Lock,
  ChevronRight
} from 'lucide-react';

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

    const handleRefresh = (e) => {
      console.log('[Warden Dashboard] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStats();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    return () => window.removeEventListener('erp:refresh', handleRefresh);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-500">Loading Warden Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Warden Operations</h2>
          <p className="text-xs text-gray-500 font-medium">Monitor active leaves, record daily rolls, track compliance, and manage student dining schedules.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border shadow-sm text-xs font-semibold text-gray-600">
          <Calendar size={14} className="text-blue-500" />
          <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main KPI Stats Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Pending Leaves */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-xs font-black uppercase tracking-wider mb-1">Pending Leave Approvals</div>
              <div className="text-4xl font-black text-slate-800 tracking-tight">{stats?.pendingLeaves || 0}</div>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
              <FileText size={20} />
            </div>
          </div>
          <Link 
            to="/leaves/pending" 
            className="text-xs text-amber-600 font-bold mt-4 inline-flex items-center gap-1 hover:text-amber-700 transition"
          >
            Review Requests <ChevronRight size={14} />
          </Link>
        </div>

        {/* Students Outside */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-xs font-black uppercase tracking-wider mb-1">Students Outside Campus</div>
              <div className="text-4xl font-black text-slate-800 tracking-tight">{stats?.studentsOutside || 0}</div>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <Users size={20} />
            </div>
          </div>
          <Link 
            to="/leaves/history" 
            className="text-xs text-indigo-600 font-bold mt-4 inline-flex items-center gap-1 hover:text-indigo-700 transition"
          >
            Track Active Leaves <ChevronRight size={14} />
          </Link>
        </div>

        {/* Returned Today */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-gray-400 text-xs font-black uppercase tracking-wider mb-1">Returned Today</div>
              <div className="text-4xl font-black text-slate-800 tracking-tight">{stats?.returnedToday || 0}</div>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
              <CheckSquare size={20} />
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded inline-block mt-4 uppercase">Gate Verified</span>
        </div>

      </div>

      {/* Attendance & Complaints Overview Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Today's Attendance Snapshot */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Today's Attendance Snapshot
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Real-time counts for daily gate verification roll calls.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
              <div className="text-[10px] text-emerald-700 font-black uppercase tracking-wider mb-1">Present</div>
              <div className="text-2xl font-black text-emerald-800">{attendanceStats?.PRESENT || 0}</div>
            </div>
            <div className="p-4 bg-rose-50/30 rounded-xl border border-rose-100/50">
              <div className="text-[10px] text-rose-700 font-black uppercase tracking-wider mb-1">Absent</div>
              <div className="text-2xl font-black text-rose-800">{attendanceStats?.ABSENT || 0}</div>
            </div>
            <div className="p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
              <div className="text-[10px] text-indigo-700 font-black uppercase tracking-wider mb-1">On Official Leave</div>
              <div className="text-2xl font-black text-indigo-800">{attendanceStats?.ON_LEAVE || 0}</div>
            </div>
            <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-100/50">
              <div className="text-[10px] text-amber-700 font-black uppercase tracking-wider mb-1">Late Return</div>
              <div className="text-2xl font-black text-amber-800">{attendanceStats?.LATE_RETURN || 0}</div>
            </div>
          </div>
        </div>

        {/* Complaints Overview */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Complaints & Maintenance Log
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Track and resolve student-submitted room issues.</p>
            </div>
            <Link to="/complaints" className="text-xs text-amber-600 font-bold hover:underline">View All &rarr;</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-100/50">
              <div className="text-[10px] text-amber-700 font-black uppercase tracking-wider mb-1">Open Issues</div>
              <div className="text-2xl font-black text-amber-800">{complaintStats?.openComplaints || 0}</div>
            </div>
            <div className="p-4 bg-sky-50/30 rounded-xl border border-sky-100/50">
              <div className="text-[10px] text-sky-700 font-black uppercase tracking-wider mb-1">In Progress</div>
              <div className="text-2xl font-black text-sky-800">{complaintStats?.inProgress || 0}</div>
            </div>
            <div className="p-4 bg-rose-50/30 rounded-xl border border-rose-100/50">
              <div className="text-[10px] text-rose-700 font-black uppercase tracking-wider mb-1">🚨 Severe / Urgent</div>
              <div className="text-2xl font-black text-rose-800">{complaintStats?.urgentOpen || 0}</div>
            </div>
            <div className="p-4 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
              <div className="text-[10px] text-emerald-700 font-black uppercase tracking-wider mb-1">Resolved</div>
              <div className="text-2xl font-black text-emerald-800">{complaintStats?.resolved || 0}</div>
            </div>
          </div>
        </div>

      </div>

      {/* Grid Quick Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Student Directory Management */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Users size={16} className="text-indigo-500" />
              Student Allocations
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">Manage pending hosteler applications, allocate clean rooms, and verify active resident records.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/students/pending" className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-xl text-xs transition">Pending</Link>
            <Link to="/students/list" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition">Directory</Link>
          </div>
        </div>

        {/* Announcements Noticeboard */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Megaphone size={16} className="text-purple-500" />
              Hostel Broadcasts
            </h3>
            {noticeStats?.latest?.length > 0 ? (
              <div className="space-y-2 mt-3 max-h-[90px] overflow-y-auto">
                {noticeStats.latest.map(n => (
                  <div key={n._id} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.priority === 'EMERGENCY' ? 'bg-rose-500 animate-pulse' : n.priority === 'IMPORTANT' ? 'bg-amber-400' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600 truncate font-semibold">{n.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic mt-3">No active notices broadcasted.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/notices/manage" className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-3 py-2 rounded-xl text-xs transition">Manage</Link>
            <Link to="/notices/create" className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition">+ Post</Link>
          </div>
        </div>

        {/* Occupancy and Reports */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <BarChart2 size={16} className="text-sky-500" />
              Occupancy & Reports
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">Generate instant CSV data, review long-term meal logs, check fine collection analytics, and audit security compliance logs.</p>
          </div>
          <Link to="/warden/analytics" className="w-full text-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition">
            Generate Reports
          </Link>
        </div>

      </div>

    </div>
  );
}
