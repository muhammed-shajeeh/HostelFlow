import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/leaves/stats');
        setStats(res.data.stats);
      } catch (error) {
        // Stats might not load if the student isn't approved yet, that's fine
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

  const { activeLeave, totalLeaves } = stats || {};

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Welcome, {user?.fullName}</h2>
      
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        </div>
      )}
    </div>
  );
}
