import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  PRESENT: '#10b981',
  ABSENT: '#ef4444',
  ON_LEAVE: '#8b5cf6',
  LATE_RETURN: '#f97316'
};

const COMPLAINT_COLORS = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#6366f1',
  RESOLVED: '#10b981',
  REJECTED: '#ef4444'
};

function Skeleton({ h = 'h-40' }) {
  return <div className={`bg-gray-100 rounded-lg ${h} animate-pulse`}></div>;
}

// ── Circular Progress Ring ───────────────────────────
function ProgressRing({ pct, size = 120, strokeWidth = 10, color = '#6366f1' }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" fontSize="22" fontWeight="bold" fill={color}>{pct}%</text>
    </svg>
  );
}

export default function StudentAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/student')
      .then(res => setData(res.data.analytics))
      .catch(() => toast.error('Failed to load your analytics'))
      .finally(() => setLoading(false));
  }, []);

  // Build chart: count by status across the timeline
  const statusBreakdown = data
    ? [
        { name: 'Present', value: data.attendance.presentDays, fill: '#10b981' },
        { name: 'Absent', value: data.attendance.absentDays, fill: '#ef4444' },
        { name: 'On Leave', value: data.attendance.onLeaveDays, fill: '#8b5cf6' },
        { name: 'Late Return', value: data.attendance.lateReturnDays, fill: '#f97316' }
      ]
    : [];

  // Last 30 days of timeline for the line chart (filter)
  const recentTimeline = (data?.attendance.timeline || [])
    .slice(-30)
    .map(t => ({ date: t.date, present: t.value }));

  // Complaint data for pie
  const complaintData = data
    ? Object.entries(data.complaints)
        .filter(([k]) => k !== 'total')
        .map(([name, value]) => ({ name, value }))
    : [];

  const attColor = (data?.attendance.pct || 0) >= 75 ? '#10b981' : '#ef4444';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Your personal hostel activity summary (last 90 days)</p>
      </div>

      {/* Attendance Overview */}
      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <h3 className="font-bold text-gray-800 mb-5">Attendance Overview</h3>
        {loading ? <Skeleton h="h-40" /> : (
          <div className="flex flex-wrap gap-6 items-center">
            {/* Progress ring */}
            <div className="flex flex-col items-center">
              <ProgressRing pct={data?.attendance.pct || 0} color={attColor} size={130} strokeWidth={12} />
              <div className="text-xs text-gray-500 mt-2 font-medium">Overall Rate</div>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-w-[200px]">
              {[
                { label: 'Total Days Recorded', value: data?.attendance.totalDays, color: 'text-gray-800' },
                { label: 'Days Present', value: data?.attendance.presentDays, color: 'text-green-700' },
                { label: 'Days Absent', value: data?.attendance.absentDays, color: 'text-red-600' },
                { label: 'Days On Leave', value: data?.attendance.onLeaveDays, color: 'text-purple-600' },
                { label: 'Late Returns', value: data?.attendance.lateReturnDays, color: 'text-orange-600' }
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  <div className={`text-2xl font-black ${color}`}>{value ?? 0}</div>
                </div>
              ))}
            </div>

            {/* Mini pie */}
            <div>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={statusBreakdown.filter(s => s.value > 0)} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                    {statusBreakdown.map((s, i) => <Cell key={i} fill={s.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                {statusBreakdown.map(s => (
                  <div key={s.name} className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }}></span>
                    {s.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Timeline */}
      <div className="bg-white rounded-lg shadow border p-5 mb-6">
        <h3 className="font-bold text-gray-800 mb-4">Attendance Timeline (Last 30 Days)</h3>
        {loading ? <Skeleton h="h-48" /> : recentTimeline.length === 0 ? (
          <div className="text-center h-40 flex items-center justify-center text-gray-400">No attendance records found.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={recentTimeline} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? '✓' : '✗'} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v === 1 ? 'Present' : 'Absent'} />
              <Bar dataKey="present" radius={[3, 3, 0, 0]}
                fill="#10b981"
                // Color absent bars red by checking value
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Leave Summary + Complaint Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Leave Summary */}
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Leave Summary</h3>
          {loading ? <Skeleton /> : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Total', value: data?.leaves.total, color: 'text-gray-800' },
                  { label: 'Approved', value: data?.leaves.approved, color: 'text-green-700' },
                  { label: 'Pending', value: data?.leaves.pending, color: 'text-yellow-700' },
                  { label: 'Rejected', value: data?.leaves.rejected, color: 'text-red-600' }
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center bg-gray-50 p-3 rounded-lg">
                    <div className={`text-2xl font-black ${color}`}>{value ?? 0}</div>
                    <div className="text-xs text-gray-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {data?.leaves.history?.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Recent Leaves</div>
                  {data.leaves.history.slice(0, 3).map((l, i) => (
                    <div key={i} className="flex justify-between text-sm border-b pb-1">
                      <span className="text-gray-700 font-medium">{l.leaveType}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        l.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        l.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{l.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No leave records found.</p>
              )}
              <Link to="/student/leaves/history" className="mt-3 inline-block text-sm text-indigo-600 font-bold hover:underline">
                View All Leaves →
              </Link>
            </>
          )}
        </div>

        {/* Complaint Summary */}
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">My Complaints</h3>
          {loading ? <Skeleton /> : (
            <>
              <div className="text-center mb-4">
                <div className="text-5xl font-black text-gray-800">{data?.complaints.total || 0}</div>
                <div className="text-xs text-gray-400 mt-1">Total Complaints Submitted</div>
              </div>
              {complaintData.filter(c => c.value > 0).length > 0 ? (
                <div className="space-y-2">
                  {complaintData.filter(c => c.value > 0).map(c => (
                    <div key={c.name} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{c.name.replace('_', ' ')}</span>
                      <span className="font-bold px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: COMPLAINT_COLORS[c.name] + '20', color: COMPLAINT_COLORS[c.name] }}>
                        {c.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No complaints submitted yet.</p>
              )}
              <Link to="/student/complaints" className="mt-3 inline-block text-sm text-indigo-600 font-bold hover:underline">
                View My Complaints →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Attendance Alert */}
      {!loading && (data?.attendance.pct || 0) < 75 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="font-bold text-red-800">⚠️ Low Attendance Warning</div>
          <p className="text-red-700 text-sm mt-1">
            Your attendance is at <strong>{data?.attendance.pct}%</strong>, which is below the required 75%. 
            Please maintain regular attendance to avoid academic penalties.
          </p>
        </div>
      )}
    </div>
  );
}
