import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function MetricCard({ label, value, color = 'indigo', sub }) {
  const colorMap = {
    indigo: 'border-l-indigo-500 text-indigo-700',
    green: 'border-l-green-500 text-green-700',
    yellow: 'border-l-yellow-500 text-yellow-700',
    red: 'border-l-red-500 text-red-700',
    blue: 'border-l-blue-500 text-blue-700',
    purple: 'border-l-purple-500 text-purple-700'
  };
  return (
    <div className={`bg-white rounded-lg shadow border-l-4 p-5 ${colorMap[color]}`}>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-4xl font-black">{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Skeleton({ h = 'h-40' }) {
  return <div className={`bg-gray-100 rounded-lg ${h} animate-pulse`}></div>;
}

const exportCSV = async (type) => {
  try {
    const res = await api.get(`/analytics/export?type=${type}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `${type}_export.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type} exported!`);
  } catch { toast.error('Export failed'); }
};

export default function WardenAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/warden')
      .then(res => setData(res.data.analytics))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const formatTrend = (raw = []) =>
    raw.map(d => ({ date: d._id.slice(5), present: d.present, absent: d.absent, onLeave: d.onLeave }));

  const formatCategories = (raw = []) =>
    raw.map(d => ({ name: d._id.replace('_', ' '), value: d.count }));

  const todayTotal = Object.values(data?.todayAttendance || {}).reduce((a, b) => a + b, 0);
  const todayPresent = data?.todayAttendance?.PRESENT || 0;
  const todayPct = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Hostel Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Your hostel's performance metrics</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportCSV('attendance')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50">⬇ Attendance CSV</button>
          <button onClick={() => exportCSV('complaints')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50">⬇ Complaints CSV</button>
          <button onClick={() => exportCSV('leaves')} className="px-3 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50">⬇ Leaves CSV</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {loading ? [...Array(6)].map((_, i) => <Skeleton key={i} h="h-24" />) : (
          <>
            <MetricCard label="Students" value={data?.summary.totalStudents} color="indigo" />
            <MetricCard label="Rooms" value={data?.summary.totalRooms} color="blue" />
            <MetricCard label="Occupancy" value={`${data?.summary.occupancyPct}%`} color="green" />
            <MetricCard label="On Leave" value={data?.summary.leaveSummary} color="purple" />
            <MetricCard label="Late Returns" value={data?.summary.lateReturnCount} color="red" />
            <MetricCard label="Open Complaints" value={data?.summary.openComplaints} color="yellow" />
          </>
        )}
      </div>

      {/* Today's Attendance + Attendance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Today Summary card */}
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Today's Attendance</h3>
          {loading ? <Skeleton /> : (
            <>
              <div className="text-center mb-4">
                <div className={`text-6xl font-black ${todayPct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{todayPct}%</div>
                <div className="text-gray-400 text-sm mt-1">{todayPresent} / {todayTotal} students present</div>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'PRESENT', label: 'Present', color: 'bg-green-500' },
                  { key: 'ABSENT', label: 'Absent', color: 'bg-red-500' },
                  { key: 'ON_LEAVE', label: 'On Leave', color: 'bg-purple-500' },
                  { key: 'LATE_RETURN', label: 'Late Return', color: 'bg-orange-500' }
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
                      <span className="text-gray-600">{label}</span>
                    </div>
                    <span className="font-bold">{data?.todayAttendance?.[key] || 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 30-day trend */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Attendance Trend (30 Days)</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formatTrend(data?.attendanceTrend)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="onLeave" stroke="#8b5cf6" dot={false} strokeWidth={1} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Complaint Category Pie + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Complaints by Category</h3>
          {loading ? <Skeleton h="h-64" /> : formatCategories(data?.complaintsByCategory).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No complaints yet — great job! ✅</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={formatCategories(data?.complaintsByCategory)} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {formatCategories(data?.complaintsByCategory).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border p-5">
          <h3 className="font-bold text-gray-800 mb-4">Complaint Status Summary</h3>
          {loading ? <Skeleton h="h-64" /> : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'OPEN', label: 'Open', color: '#f59e0b' },
                { key: 'IN_PROGRESS', label: 'In Progress', color: '#6366f1' },
                { key: 'RESOLVED', label: 'Resolved', color: '#10b981' },
                { key: 'REJECTED', label: 'Rejected', color: '#ef4444' }
              ].map(({ key, label, color }) => (
                <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-black" style={{ color }}>{data?.complaintsByStatus?.[key] || 0}</div>
                  <div className="text-xs font-bold text-gray-500 uppercase mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Room Occupancy Table */}
      <div className="bg-white rounded-lg shadow border p-5">
        <h3 className="font-bold text-gray-800 mb-4">Room-wise Occupancy</h3>
        {loading ? <Skeleton h="h-48" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Room</th>
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Floor</th>
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Capacity</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Occupied</th>
                  <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.roomOccupancy || []).map(room => {
                  const pct = room.capacity > 0 ? Math.round((room.occupiedBeds / room.capacity) * 100) : 0;
                  return (
                    <tr key={room._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-bold">Room {room.roomNumber}</td>
                      <td className="px-4 py-2 text-gray-500">F{room.floor}</td>
                      <td className="px-4 py-2 text-gray-500">{room.roomType}</td>
                      <td className="px-4 py-2 text-right">{room.capacity}</td>
                      <td className="px-4 py-2 text-right">{room.occupiedBeds}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct === 100 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(data?.roomOccupancy || []).length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No rooms found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
