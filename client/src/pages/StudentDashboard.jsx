import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [attendancePct, setAttendancePct] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [noticeStats, setNoticeStats] = useState(null);
  const [tomorrowMeal, setTomorrowMeal] = useState(null);
  const [dues, setDues] = useState({ messPending: 0, hostelPending: 0 });
  const [loading, setLoading] = useState(true);

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
      // Stats may not load if student isn't fully approved yet — silent fail
    } finally {
      setLoading(false);
    }
  };

  const [timeLeftStr, setTimeLeftStr] = useState('');

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
        setTimeLeftStr(`Meal changes close in ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  const handleToggleTomorrowMeal = async (meal) => {
    try {
      const res = await api.post('/mess/toggle-tomorrow', { meal });
      setTomorrowMeal(res.data.eligibility);
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle tomorrow\'s meals.');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

  const { activeLeave, totalLeaves } = stats || {};

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Welcome, {user?.fullName}</h2>

      {/* Emergency Notice Banner */}
      {noticeStats?.emergency > 0 && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6 flex justify-between items-center shadow-lg">
          <div>
            <div className="font-bold text-lg">🚨 {noticeStats.emergency} Emergency Notice{noticeStats.emergency > 1 ? 's' : ''}</div>
            <div className="text-red-100 text-sm">Urgent announcements require your attention.</div>
          </div>
          <Link to="/notices" className="bg-white text-red-700 px-4 py-2 rounded font-bold hover:bg-red-50 transition text-sm">
            View Now
          </Link>
        </div>
      )}

      {user?.approvalStatus !== 'APPROVED' ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded shadow">
          <h3 className="text-lg font-bold text-yellow-800">Application Pending</h3>
          <p className="text-yellow-700">Your hostel application is currently under review by the Warden. You will be notified via email once approved and allocated a room.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Room Allocated</h3>
              <p className="text-gray-600">You are successfully allocated to your hostel.</p>
            </div>
            <div className="text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded">
              Active Resident
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow border-t-4 border-blue-500 lg:col-span-3">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-4">My Allocation Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Hostel</div>
                  <div className="font-bold">{user?.hostelId?.name || 'Assigned'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Room</div>
                  <div className="font-bold">{user?.roomId?.roomNumber || 'TBA'} (Floor {user?.roomId?.floor || '-'})</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Department</div>
                  <div className="font-bold">{user?.department || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Semester</div>
                  <div className="font-bold">{user?.semester || 'N/A'}</div>
                </div>
              </div>
            </div>

             {/* Smart Mess Widget (Phase 5: Partial Skip + Cut-off Timer) */}
             <div className="bg-white p-6 rounded shadow border-t-4 border-yellow-500 flex flex-col justify-between">
               <div>
                 <div className="flex justify-between items-center mb-2">
                   <h3 className="text-gray-500 text-sm font-bold uppercase">Tomorrow's Meal Plan</h3>
                   <span className="text-[10px] text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded">
                     {timeLeftStr}
                   </span>
                 </div>
 
                 {tomorrowMeal ? (
                   <div className="space-y-4 mt-3">
                     <div className="flex flex-col gap-2">
                       <label className="flex items-center justify-between p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition">
                         <span className="text-xs font-bold text-gray-700">🍳 Breakfast</span>
                         <input
                           type="checkbox"
                           disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                           checked={!!tomorrowMeal.breakfast}
                           onChange={() => handleToggleTomorrowMeal('breakfast')}
                           className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                         />
                       </label>
 
                       <label className="flex items-center justify-between p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition">
                         <span className="text-xs font-bold text-gray-700">🍛 Lunch</span>
                         <input
                           type="checkbox"
                           disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                           checked={!!tomorrowMeal.lunch}
                           onChange={() => handleToggleTomorrowMeal('lunch')}
                           className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                         />
                       </label>
 
                       <label className="flex items-center justify-between p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition">
                         <span className="text-xs font-bold text-gray-700">🍽️ Dinner</span>
                         <input
                           type="checkbox"
                           disabled={tomorrowMeal.skippedByLeave || timeLeftStr.includes("LOCKED")}
                           checked={!!tomorrowMeal.dinner}
                           onChange={() => handleToggleTomorrowMeal('dinner')}
                           className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                         />
                       </label>
                     </div>
 
                     {tomorrowMeal.skippedByLeave && (
                       <p className="text-[10px] text-red-600 font-bold italic">
                         ⚠️ Meals locked due to tomorrow's approved leave.
                       </p>
                     )}
                   </div>
                 ) : (
                   <p className="text-sm text-gray-500">Meal plan loading...</p>
                 )}
               </div>
               <div className="mt-4">
                 <button
                   disabled={tomorrowMeal?.skippedByLeave || timeLeftStr.includes("LOCKED")}
                   onClick={() => handleToggleTomorrowMeal('all')}
                   className={`w-full text-center py-2 px-3 rounded text-xs font-bold transition shadow ${
                     tomorrowMeal?.skippedManually
                       ? 'bg-green-600 hover:bg-green-700 text-white'
                       : 'bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                   }`}
                 >
                   {tomorrowMeal?.skippedManually ? '🔄 Resume All Meals' : '🚫 Skip All Tomorrow Meals'}
                 </button>
               </div>
             </div>

            {/* Billing & Fees Dues Widget */}
            <div className="bg-white p-6 rounded shadow border-t-4 border-emerald-500 flex flex-col justify-between">
              <div>
                <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Hostel & Mess Dues</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <span className="block text-xs text-gray-400">Mess Dues</span>
                    <span className="text-xl font-bold text-gray-800">₹{dues.messPending}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400">Hostel Dues</span>
                    <span className="text-xl font-bold text-gray-800">₹{dues.hostelPending}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/student/billing"
                  className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded text-sm font-bold transition shadow"
                >
                  Pay Online &rarr;
                </Link>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow border-t-4 border-purple-500">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Current Leave Status</h3>
              {activeLeave ? (
                <div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">{activeLeave.status}</div>
                  <div className="text-sm text-gray-600">Type: {activeLeave.leaveType}</div>
                  <Link to="/student/leaves/history" className="mt-4 inline-block text-sm text-purple-600 font-bold hover:underline">View QR Pass &rarr;</Link>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">On Campus</div>
                  <div className="text-sm text-gray-600">You have no active outpass.</div>
                  <Link to="/student/leaves/request" className="mt-4 inline-block text-sm text-purple-600 font-bold hover:underline">Apply for Outpass &rarr;</Link>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded shadow border-t-4 border-gray-500">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Total Leaves Taken</h3>
              <div className="text-4xl font-black text-gray-800">{totalLeaves || 0}</div>
              <Link to="/student/leaves/history" className="mt-4 inline-block text-sm text-gray-600 font-bold hover:underline">View History &rarr;</Link>
            </div>

            <div className="bg-white p-6 rounded shadow border-t-4 border-green-500">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Overall Attendance Rate</h3>
              <div className="flex justify-between items-end">
                <div className={`text-5xl font-black ${attendancePct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{attendancePct !== null ? attendancePct : 0}%</div>
              </div>
              <Link to="/student/attendance" className="mt-4 inline-block text-sm text-green-700 font-bold hover:underline">View Daily Logs &rarr;</Link>
            </div>

            {/* Active Complaints Widget */}
            <div className="bg-white p-6 rounded shadow border-t-4 border-orange-400">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Active Complaints</h3>
              <div className="text-4xl font-black text-orange-700">
                {(complaintStats?.openComplaints || 0) + (complaintStats?.inProgress || 0)}
              </div>
              <Link to="/student/complaints" className="mt-4 inline-block text-sm text-orange-600 font-bold hover:underline">View My Complaints &rarr;</Link>
            </div>

            {/* Latest Notices Widget */}
            <div className="bg-white p-6 rounded shadow border-t-4 border-indigo-400">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-3">Latest Notices</h3>
              {noticeStats?.latest?.length > 0 ? (
                <div className="space-y-2">
                  {noticeStats.latest.map(n => (
                    <div key={n._id} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.priority === 'EMERGENCY' ? 'bg-red-500' : n.priority === 'IMPORTANT' ? 'bg-orange-400' : 'bg-gray-300'}`}></span>
                      <span className="text-gray-700 line-clamp-1">{n.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No recent notices.</p>
              )}
              <Link to="/notices" className="mt-4 inline-block text-sm text-indigo-600 font-bold hover:underline">View All Notices &rarr;</Link>
            </div>

            {/* Analytics Shortcut Widget */}
            <div className="bg-white p-6 rounded shadow border-t-4 border-cyan-400">
              <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Performance Insights</h3>
              <p className="text-gray-600 text-sm mb-4">View your detailed attendance trends, leave history, and complaint status graphs.</p>
              <Link to="/student/analytics" className="inline-block text-sm text-cyan-600 font-bold hover:underline">Full Reports &rarr;</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
