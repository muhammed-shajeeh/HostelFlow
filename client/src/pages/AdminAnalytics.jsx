import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api';
import toast from 'react-hot-toast';

// ── Chart color palette ──────────────────────────────
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#6366f1',
  RESOLVED: '#10b981',
  REJECTED: '#ef4444'
};

// ── Metric card component ────────────────────────────
function MetricCard({ label, value, color = 'indigo', sub }) {
  const colorMap = {
    indigo: 'border-l-indigo-500 text-indigo-700',
    green: 'border-l-green-500 text-green-700',
    yellow: 'border-l-yellow-500 text-yellow-700',
    red: 'border-l-red-500 text-red-700',
    purple: 'border-l-purple-500 text-purple-700',
    blue: 'border-l-blue-500 text-blue-700'
  };
  return (
    <div className={`bg-white rounded-lg shadow border-l-4 p-5 ${colorMap[color]}`}>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-4xl font-black`}>{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────
function Skeleton({ h = 'h-40' }) {
  return <div className={`bg-gray-100 rounded-lg ${h} animate-pulse`}></div>;
}

// ── CSV Export helper ─────────────────────────────────
const exportCSV = async (type) => {
  try {
    const res = await api.get(`/analytics/export?type=${type}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type} data exported!`);
  } catch {
    toast.error('Export failed');
  }
};

// ── Main Admin Analytics Page ─────────────────────────
export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/admin')
      .then(res => setData(res.data.analytics))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  // Format trend data for Recharts (fill missing dates with 0)
  const formatAttendanceTrend = (raw = []) =>
    raw.map(d => ({ date: d._id.slice(5), present: d.present, absent: d.absent, onLeave: d.onLeave }));

  const formatComplaintTrend = (raw = []) =>
    raw.map(d => ({ date: d._id.slice(5), complaints: d.count }));

  const formatLeaveTrend = (raw = []) =>
    raw.map(d => ({ date: d._id.slice(5), leaves: d.count }));

  const formatCategories = (raw = []) =>
    raw.map(d => ({ name: d._id.replace('_', ' '), value: d.count }));

  const formatComplaintStatus = (map = {}) =>
    Object.entries(map).map(([name, value]) => ({ name, value }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">System Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Full platform insights — all hostels</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportCSV('attendance')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50 transition">
            ⬇ Attendance CSV
          </button>
          <button onClick={() => exportCSV('complaints')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50 transition">
            ⬇ Complaints CSV
          </button>
          <button onClick={() => exportCSV('leaves')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50 transition">
            ⬇ Leaves CSV
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? [...Array(8)].map((_, i) => <Skeleton key={i} h="h-24" />) : (
          <>
            <MetricCard label="Total Students" value={data?.summary.totalStudents} color="indigo" />
            <MetricCard label="Total Rooms" value={data?.summary.totalRooms} color="blue" />
            <MetricCard label="Open Complaints" value={data?.summary.openComplaints} color="yellow" />
            <MetricCard label="Resolved Complaints" value={data?.summary.resolvedComplaints} color="green" />
            <MetricCard label="Active Notices" value={data?.summary.activeNotices} color="purple" />
            <MetricCard label="Emergency Notices" value={data?.summary.emergencyNotices} color="red" />
            <MetricCard label="Late Returns (Total)" value={data?.summary.lateReturns} color="red" />
          </>
        )}
      </div>

      {/* Charts Row 1: Attendance + Leave Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Attendance Trend (30 Days)</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={formatAttendanceTrend(data?.attendanceTrend)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="onLeave" stroke="#8b5cf6" dot={false} strokeWidth={1} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Leave Approvals (30 Days)</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={formatLeaveTrend(data?.leaveTrend)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leaves" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Complaint Trends + Category Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Complaints Filed (30 Days)</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={formatComplaintTrend(data?.complaintTrend)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="complaints" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Top Complaint Categories</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={formatCategories(data?.complaintsByCategory)}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={85}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {formatCategories(data?.complaintsByCategory).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Hostel Occupancy Comparison */}
      <div className="bg-white rounded-lg shadow border p-5 mb-8">
        <h3 className="font-bold text-gray-800 mb-4">Hostel Occupancy Comparison</h3>
        {loading ? <Skeleton h="h-64" /> : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.hostelOccupancy || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="occupancyPct" fill="#6366f1" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', formatter: v => `${v}%`, fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
            {/* Table under chart */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs font-bold text-gray-500 uppercase">Hostel</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">Rooms</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">Capacity</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">Occupied</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">Occupancy %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.hostelOccupancy || []).map(h => (
                    <tr key={h._id}>
                      <td className="py-2 font-medium">{h.name} <span className="text-gray-400 text-xs">({h.hostelCode})</span></td>
                      <td className="py-2 text-right text-gray-600">{h.totalRooms}</td>
                      <td className="py-2 text-right text-gray-600">{h.totalCapacity}</td>
                      <td className="py-2 text-right text-gray-600">{h.totalOccupied}</td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${h.occupancyPct >= 90 ? 'text-red-600' : h.occupancyPct >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {h.occupancyPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Complaint Status Breakdown */}
      <div className="bg-white rounded-lg shadow border p-5">
        <h3 className="font-bold text-gray-800 mb-4">Complaint Status Breakdown</h3>
        {loading ? <Skeleton h="h-48" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data?.complaintsByStatus || {}).map(([status, count]) => (
              <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-black" style={{ color: STATUS_COLORS[status] }}>{count}</div>
                <div className="text-xs font-bold text-gray-500 uppercase mt-1">{status.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
