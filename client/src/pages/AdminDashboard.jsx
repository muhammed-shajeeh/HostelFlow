import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        setStats(res.data.stats);
      } catch (error) {
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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
      
      <div className="mt-10 bg-white p-6 rounded shadow border">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <p className="text-gray-600 mb-4">Use the sidebar links to manage hostels and assign wardens. Ensure every hostel has an active warden assigned to handle student operations effectively.</p>
      </div>
    </div>
  );
}
