import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

// ── Shared badge helper utilities ──────────────────────

const STATUS_STYLES = {
  OPEN: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-300',
  RESOLVED: 'bg-green-100 text-green-800 border border-green-300',
  REJECTED: 'bg-red-100 text-red-800 border border-red-300'
};

const PRIORITY_STYLES = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700 font-black'
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
    {status?.replace('_', ' ')}
  </span>
);

const PriorityBadge = ({ priority }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-bold ${PRIORITY_STYLES[priority] || ''}`}>
    {priority === 'URGENT' ? '🚨 ' : ''}{priority}
  </span>
);

// ── Main Component ─────────────────────────────────────
import { useSocket } from '../context/SocketContext';

export default function MyComplaints() {
  const { user } = useContext(AuthContext);
  const { refreshBadgeSummary } = useSocket();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const fetchComplaints = async () => {
      setLoading(true);
      try {
        const res = await api.get('/complaints/my');
        setComplaints(res.data.complaints);
      } catch (error) {
        toast.error('Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();

    // Mark complaint updates as read to clear sidebar badges
    api.put('/notifications/read-category', { category: 'COMPLAINT' })
      .then(() => refreshBadgeSummary())
      .catch(err => console.warn('Failed to clear complaint notifications', err));
  }, []);

  // Client-side filter — no extra API call needed
  const filtered = filter === 'ALL'
    ? complaints
    : complaints.filter(c => c.status === filter);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">My Complaints</h2>
          <p className="text-sm text-gray-500 mt-1">{complaints.length} total submission{complaints.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/student/complaints/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold hover:bg-blue-700 transition"
        >
          + New Complaint
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
              filter === s ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-bold text-lg">No complaints found</div>
          <p className="text-sm mt-1">
            {filter === 'ALL'
              ? "You haven't submitted any complaints yet."
              : `No ${filter.replace('_', ' ')} complaints.`}
          </p>
          {filter === 'ALL' && (
            <Link to="/student/complaints/new" className="mt-4 inline-block text-blue-600 font-bold hover:underline text-sm">
              Submit your first complaint →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(complaint => (
            <div
              key={complaint._id}
              className={`bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition ${
                complaint.priority === 'URGENT' ? 'border-l-4 border-l-red-500' :
                complaint.priority === 'HIGH' ? 'border-l-4 border-l-orange-400' : ''
              }`}
            >
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-base">{complaint.title}</h3>
                    <StatusBadge status={complaint.status} />
                    <PriorityBadge priority={complaint.priority} />
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{complaint.description}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500">
                <div className="flex flex-wrap gap-4">
                  <span>📂 {complaint.category.replace('_', ' ')}</span>
                  <span>🕐 {new Date(complaint.createdAt).toLocaleDateString()}</span>
                  {complaint.assignedTo && (
                    <span>👤 Assigned to: {complaint.assignedTo.fullName}</span>
                  )}
                </div>
                {complaint.status === 'RESOLVED' && complaint.resolutionNotes && (
                  <div className="w-full mt-2 bg-green-50 border border-green-200 rounded p-2 text-green-800 text-xs">
                    <span className="font-bold">Resolution: </span>{complaint.resolutionNotes}
                  </div>
                )}
                {complaint.status === 'REJECTED' && complaint.resolutionNotes && (
                  <div className="w-full mt-2 bg-red-50 border border-red-200 rounded p-2 text-red-800 text-xs">
                    <span className="font-bold">Reason: </span>{complaint.resolutionNotes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
