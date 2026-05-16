import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function WardenDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/leaves/stats');
        setStats(res.data.stats);
      } catch (error) {
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-bold mb-4">Security QR Scanner</h3>
          <p className="text-gray-600 text-sm mb-4">Use the built-in scanner tool to verify student QR passes at the gate. This will automatically update their status from APPROVED to EXITED, or EXITED to RETURNED.</p>
          <Link to="/leaves/scanner" className="bg-gray-900 text-white px-4 py-2 rounded shadow font-bold inline-block hover:bg-gray-800 transition">Open QR Scanner</Link>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-bold mb-4">Student Management</h3>
          <p className="text-gray-600 text-sm mb-4">Manage new hostel applications and existing room allocations from the student directory.</p>
          <div className="flex gap-3">
            <Link to="/students/pending" className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold hover:bg-blue-200 transition text-sm">Pending Students</Link>
            <Link to="/students/list" className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold hover:bg-blue-200 transition text-sm">Student Directory</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
