import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

// ── Badge helpers ──────────────────────────────────────

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
  URGENT: 'bg-red-100 text-red-800 font-black'
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[status] || ''}`}>
    {status?.replace('_', ' ')}
  </span>
);

const PriorityBadge = ({ priority }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-bold ${PRIORITY_STYLES[priority] || ''}`}>
    {priority === 'URGENT' ? '🚨 ' : ''}{priority}
  </span>
);

// ── Status Update Modal ────────────────────────────────

function StatusModal({ complaint, onClose, onUpdated }) {
  const [status, setStatus] = useState(complaint.status);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if ((status === 'RESOLVED' || status === 'REJECTED') && !resolutionNotes.trim()) {
      return toast.error('Please add a resolution note when resolving or rejecting.');
    }
    setSubmitting(true);
    try {
      await api.put(`/complaints/${complaint._id}/status`, { status, resolutionNotes });
      toast.success('Complaint status updated successfully');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">Update Complaint Status</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1 font-medium">Complaint</p>
            <p className="font-bold text-gray-800">{complaint.title}</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">New Status</label>
            <div className="flex flex-wrap gap-2">
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map(s => (
                <button
                   key={s}
                   onClick={() => setStatus(s)}
                   className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                     status === s ? 'border-blue-500 ring-2 ring-blue-200 ' + (STATUS_STYLES[s] || '') : 'border-gray-200 text-gray-500'
                   }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          {(status === 'RESOLVED' || status === 'REJECTED') && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {status === 'RESOLVED' ? 'Resolution Notes' : 'Rejection Reason'} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder={status === 'RESOLVED' ? 'How was this resolved?' : 'Why is this being rejected?'}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition text-sm font-medium cancel">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition text-sm"
          >
            {submitting ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ComplaintManagement() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      // Build query string only for active filters
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);

      const res = await api.get(`/complaints?${params.toString()}`);
      setComplaints(res.data.complaints);
    } catch (error) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever a filter changes
  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    const handleComplaintUpdated = (e) => {
      const updated = e.detail;
      setComplaints(prev => {
        if (prev.some(c => c._id === updated._id)) {
          return prev.map(c => c._id === updated._id ? { ...c, ...updated } : c);
        }
        return [updated, ...prev];
      });
    };

    window.addEventListener('erp:complaintUpdated', handleComplaintUpdated);
    return () => window.removeEventListener('erp:complaintUpdated', handleComplaintUpdated);
  }, []);

  const openStatusModal = (complaint) => {
    setSelectedComplaint(complaint);
    setShowModal(true);
  };

  const urgentCount = complaints.filter(c => c.priority === 'URGENT' && c.status !== 'RESOLVED').length;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Complaint Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            {complaints.length} complaint{complaints.length !== 1 ? 's' : ''} found
            {urgentCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                🚨 {urgentCount} Urgent
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="ALL">All Priorities</option>
            <option value="URGENT">🚨 Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="ALL">All Categories</option>
            {['ELECTRICAL','PLUMBING','FURNITURE','WIFI','CLEANING','SECURITY','HARASSMENT','MESS','ROOM_CHANGE','OTHER'].map(cat => (
              <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); setCategoryFilter('ALL'); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border rounded-lg hover:bg-gray-50 transition"
        >
          Clear Filters
        </button>
      </div>

      {/* Complaints Table */}
      {loading ? (
        <div className="text-center p-10 text-gray-500">Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-bold text-lg">No complaints found</div>
          <p className="text-sm mt-1">No complaints match the current filters.</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-4">
          {complaints.map(c => (
            <div
              key={c._id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition ${
                c.priority === 'URGENT' ? 'border-l-4 border-l-red-500' :
                c.priority === 'HIGH' ? 'border-l-4 border-l-orange-400' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <h3 className="font-black text-gray-900 text-base leading-tight">{c.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{c.description}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusBadge status={c.status} />
                    <PriorityBadge priority={c.priority} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 text-xs text-gray-650">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Student Info</span>
                    <span className="font-bold text-gray-800">{c.studentId?.fullName || '—'}</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">Room {c.roomId?.roomNumber || '?'} · F{c.roomId?.floor || '?'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Category & Date</span>
                    <span className="font-bold text-gray-800">{c.category?.replace('_', ' ')}</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">Submitted: {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                {c.status !== 'RESOLVED' && c.status !== 'REJECTED' ? (
                  <button
                    onClick={() => openStatusModal(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Update Status
                  </button>
                ) : (
                  <span className="w-full text-center text-xs text-gray-400 italic py-2">Closed / Processed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Complaint</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Category</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Priority</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {complaints.map(c => (
                  <tr key={c._id} className={`hover:bg-gray-50 transition ${c.priority === 'URGENT' && c.status !== 'RESOLVED' ? 'bg-red-50' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900 text-sm">{c.title}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">{c.description}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-gray-800">{c.studentId?.fullName || '—'}</div>
                      <div className="text-xs text-gray-400">
                        Room {c.roomId?.roomNumber || '?'} · F{c.roomId?.floor || '?'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">{c.category?.replace('_', ' ')}</td>
                    <td className="px-5 py-4"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4 text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      {c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
                        <button
                          onClick={() => openStatusModal(c)}
                          className="text-sm text-blue-600 font-bold hover:underline"
                        >
                          Update
                        </button>
                      )}
                      {(c.status === 'RESOLVED' || c.status === 'REJECTED') && (
                        <span className="text-xs text-gray-400 italic">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showModal && selectedComplaint && (
        <StatusModal
          complaint={selectedComplaint}
          onClose={() => setShowModal(false)}
          onUpdated={fetchComplaints}
        />
      )}
    </div>
  );
}
