import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar,
  Home,
  Clock,
  CreditCard,
  FileText,
  TrendingUp,
  AlertCircle,
  Megaphone,
  BarChart2,
  CheckCircle,
  Coffee,
  ChevronRight
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [attendancePct, setAttendancePct] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [noticeStats, setNoticeStats] = useState(null);
  const [tomorrowMeal, setTomorrowMeal] = useState(null);
  const [dues, setDues] = useState({ messPending: 0, hostelPending: 0 });
  const [loading, setLoading] = useState(true);
  const [timeLeftStr, setTimeLeftStr] = useState('');

  const fetchStats = async () => {
    try {
      const [statsRes, attRes, complaintRes, noticeRes] = await Promise.all([
        api.get('/leaves/stats'),
        api.get('/attendance/student/history'),
        api.get('/complaints/stats'),
        api.get('/notices/stats')
      ]);
      setStats(statsRes.data.stats);
      setAttendancePct(attRes.data.percentage);
      setComplaintStats(complaintRes.data.stats);
      setNoticeStats(noticeRes.data.stats);

      if (user?.approvalStatus === 'APPROVED') {
        const [mealRes, duesRes] = await Promise.all([
          api.get('/mess/tomorrow-meals'),
          api.get(`/mess/dues/${user._id}`)
        ]);
        setTomorrowMeal(mealRes.data.eligibility);
        
        let messPending = 0;
        let hostelPending = 0;
        duesRes.data.messBills.forEach(b => { if (b.status === 'PENDING') messPending += b.totalAmount; });
        duesRes.data.hostelFees.forEach(f => { if (f.status === 'PENDING') hostelPending += f.totalAmount; });
        setDues({ messPending, hostelPending });
      }
    } catch (error) {
      // Stats may not load if student isn't fully approved yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const interval = setInterval(() => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(22, 0, 0, 0); // 10:00 PM
      
      const diffMs = cutoff.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTimeLeftStr("LOCKED (Passed 10:00 PM)");
      } else {
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimeLeftStr(`Closes in ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleRefresh = (e) => {
      console.log('[Student Dashboard] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStats();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    return () => window.removeEventListener('erp:refresh', handleRefresh);
  }, []);

  const handleToggleTomorrowMeal = async (meal) => {
    try {
      const res = await api.post('/mess/toggle-tomorrow', { meal });
      setTomorrowMeal(res.data.eligibility);
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle tomorrow\'s meals.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-500">Loading Student Dashboard...</p>
      </div>
    );
  }

  const { activeLeave, totalLeaves } = stats || {};
  const isApproved = user?.approvalStatus === 'APPROVED';

  return (
    <div className="space-y-8 pb-10">
      
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Welcome, {user?.fullName}</h2>
          <p className="text-xs text-gray-500 font-medium">Verify daily check-ins, skip scheduled meals, pay outstanding bills, and apply for campus leave passes.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border shadow-sm text-xs font-semibold text-gray-600">
          <Calendar size={14} className="text-blue-500" />
          <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Emergency Notices Alerts */}
      {noticeStats?.emergency > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🚨</span>
            <div>
              <strong className="block text-rose-900 font-black uppercase tracking-wide">Emergency notices broadcasted</strong>
              <p className="text-rose-700 font-medium mt-0.5">Critical campus declarations require your review.</p>
            </div>
          </div>
          <Link to="/notices" className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-xl transition text-xs shadow">
            View Now
          </Link>
        </div>
      )}

      {!isApproved ? (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl space-y-2">
          <h3 className="text-lg font-black text-amber-800 uppercase tracking-tight flex items-center gap-2">
            <Clock className="text-amber-600 animate-spin" size={20} />
            Institutional Application Under Review
          </h3>
          <p className="text-xs font-medium text-amber-700 leading-relaxed">
            Your hosteler admission profile is undergoing administrative processing. You will receive allocated room details and dining card activation credentials via email upon authorization.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Allocation Details Ribbon */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-600"></div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Resident Status</div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <CheckCircle size={18} className="text-blue-500" />
                  Active Hostel Resident
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-xs font-semibold text-slate-700">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Assigned Hostel</span>
                  <strong>{user?.hostelId?.name || 'Assigned'}</strong>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Allocated Room</span>
                  <strong>Room {user?.roomId?.roomNumber || 'TBA'} <span className="text-gray-400 font-medium">(Floor {user?.roomId?.floor || '-'})</span></strong>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Academic Dept</span>
                  <strong>{user?.department || 'N/A'}</strong>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Academic Semester</span>
                  <strong>Semester {user?.semester || 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Tomorrow Meal Skip Plan */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400"></div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1">
                    <Coffee size={14} className="text-amber-500" />
                    Tomorrow's Meal Plan
                  </h3>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded ${timeLeftStr.includes('LOCKED') ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600 animate-pulse'}`}>
                    {timeLeftStr}
                  </span>
                </div>

                {tomorrowMeal ? (
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition text-xs font-bold text-slate-700">
                      <span>🍳 Breakfast</span>
                      <input
                        type="checkbox"
                        disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                        checked={!!tomorrowMeal.breakfast}
                        onChange={() => handleToggleTomorrowMeal('breakfast')}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition text-xs font-bold text-slate-700">
                      <span>🍛 Lunch</span>
                      <input
                        type="checkbox"
                        disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                        checked={!!tomorrowMeal.lunch}
                        onChange={() => handleToggleTomorrowMeal('lunch')}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition text-xs font-bold text-slate-700">
                      <span>🍽️ Dinner</span>
                      <input
                        type="checkbox"
                        disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                        checked={!!tomorrowMeal.dinner}
                        onChange={() => handleToggleTomorrowMeal('dinner')}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                    </label>

                    {tomorrowMeal.skippedByLeave && (
                      <p className="text-[10px] text-rose-600 font-bold italic mt-2">
                        ⚠️ Locked due to tomorrow's approved leave outpass.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Reading dining roster data...</p>
                )}
              </div>

              <div className="mt-4">
                <button
                  disabled={tomorrowMeal?.skippedByLeave || timeLeftStr.includes("LOCKED")}
                  onClick={() => handleToggleTomorrowMeal('all')}
                  className={`w-full text-center py-2.5 px-3 rounded-xl text-xs font-black transition shadow ${
                    tomorrowMeal?.skippedManually
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {tomorrowMeal?.skippedManually ? '🔄 Resume All Meals' : '🚫 Skip All Tomorrow Meals'}
                </button>
              </div>
            </div>

            {/* Financial Dues & Payments */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <CreditCard size={14} className="text-emerald-500" />
                  Hostel & Mess Dues
                </h3>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-50/50 p-3 rounded-xl border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Mess Dues</span>
                    <strong className="text-lg font-black text-slate-800">₹{dues.messPending}</strong>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Hostel Rent</span>
                    <strong className="text-lg font-black text-slate-800">₹{dues.hostelPending}</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/student/billing"
                  className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs font-black transition shadow"
                >
                  Pay Online &rarr;
                </Link>
              </div>
            </div>

            {/* Current Leave Status */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <FileText size={14} className="text-indigo-500" />
                  Active Outpass Status
                </h3>
                <div className="mt-3">
                  {activeLeave ? (
                    <div className="space-y-1.5">
                      <div className="text-xl font-black text-indigo-700 uppercase tracking-tight">{activeLeave.status}</div>
                      <div className="text-xs text-gray-500 font-semibold">Type: {activeLeave.leaveType}</div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-xl font-black text-slate-800 uppercase tracking-tight">On Campus</div>
                      <div className="text-xs text-gray-500 font-semibold">No active exit pass found.</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4">
                {activeLeave ? (
                  <Link to="/student/leaves/history" className="block w-full text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 px-3 rounded-xl text-xs font-black transition">
                    View QR Pass &rarr;
                  </Link>
                ) : (
                  <Link to="/student/leaves/request" className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-xl text-xs font-black shadow transition">
                    Apply for Outpass &rarr;
                  </Link>
                )}
              </div>
            </div>

            {/* Total Leaves History */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-500"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Total Leaves Taken</h3>
                <div className="text-4xl font-black text-slate-800 mt-2">{totalLeaves || 0}</div>
              </div>
              <Link to="/student/leaves/history" className="text-xs text-gray-500 hover:text-gray-700 font-bold inline-flex items-center gap-1 mt-4">
                View History <ChevronRight size={14} />
              </Link>
            </div>

            {/* Overall Attendance Rate */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Overall Attendance Rate</h3>
                <div className={`text-4xl font-black mt-2 ${attendancePct >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {attendancePct !== null ? attendancePct : 0}%
                </div>
              </div>
              <Link to="/student/attendance" className="text-xs text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1 mt-4">
                View Daily Logs <ChevronRight size={14} />
              </Link>
            </div>

            {/* Active Complaints */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-400"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Active Complaints</h3>
                <div className="text-4xl font-black text-orange-700 mt-2">
                  {(complaintStats?.openComplaints || 0) + (complaintStats?.inProgress || 0)}
                </div>
              </div>
              <Link to="/student/complaints" className="text-xs text-orange-600 hover:text-orange-755 font-bold inline-flex items-center gap-1 mt-4">
                View Open Issues <ChevronRight size={14} />
              </Link>
            </div>

            {/* Latest Notices */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between lg:col-span-2">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-500"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-2">Latest Notices</h3>
                {noticeStats?.latest?.length > 0 ? (
                  <div className="space-y-2 mt-2 max-h-[85px] overflow-y-auto pr-1">
                    {noticeStats.latest.map(n => (
                      <div key={n._id} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.priority === 'EMERGENCY' ? 'bg-rose-500' : n.priority === 'IMPORTANT' ? 'bg-amber-400' : 'bg-gray-300'}`}></span>
                        <span className="line-clamp-1 leading-relaxed">{n.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mt-2">No recent announcements.</p>
                )}
              </div>
              <Link to="/notices" className="text-xs text-purple-600 hover:text-purple-700 font-bold inline-flex items-center gap-1 mt-4">
                View Noticeboard <ChevronRight size={14} />
              </Link>
            </div>

            {/* Performance Insights */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-cyan-400"></div>
              <div>
                <h3 className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Performance Insights</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-2">Access comprehensive charts showing attendance trends and room maintenance resolution ratios.</p>
              </div>
              <Link to="/student/analytics" className="text-xs text-cyan-600 hover:text-cyan-700 font-bold inline-flex items-center gap-1 mt-4">
                View Trends <ChevronRight size={14} />
              </Link>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
