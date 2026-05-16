import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

// ── Priority badge config ──────────────────────────────
const PRIORITY_STYLES = {
  EMERGENCY: 'bg-red-100 text-red-800 border border-red-300',
  IMPORTANT: 'bg-orange-100 text-orange-800 border border-orange-300',
  NORMAL: 'bg-gray-100 text-gray-600'
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Delete Confirm Modal ───────────────────────────────
function ConfirmDeleteModal({ notice, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-lg mb-2">Delete Notice?</h3>
        <p className="text-gray-600 text-sm mb-5">
          Are you sure you want to remove <strong>"{notice.title}"</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition text-sm">
            {deleting ? 'Deleting...' : 'Delete Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────
function EditModal({ notice, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    title: notice.title,
    content: notice.content,
    priority: notice.priority,
    isPinned: notice.isPinned,
    visibleTo: notice.visibleTo,
    expiresAt: notice.expiresAt ? notice.expiresAt.split('T')[0] : ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.put(`/notices/${notice._id}`, { ...formData, expiresAt: formData.expiresAt || null });
      toast.success('Notice updated successfully');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update notice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">Edit Notice</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} maxLength={150}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange}
                className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">⚠️ Important</option>
                <option value="EMERGENCY">🚨 Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Visible To</label>
              <select name="visibleTo" value={formData.visibleTo} onChange={handleChange}
                className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="ALL">All Users</option>
                <option value="STUDENTS">Students Only</option>
                <option value="WARDENS">Wardens Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Expiry Date</label>
            <input type="date" name="expiresAt" value={formData.expiresAt} onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editPinned" name="isPinned" checked={formData.isPinned} onChange={handleChange} className="w-4 h-4" />
            <label htmlFor="editPinned" className="text-sm font-bold text-gray-700 cursor-pointer">📌 Pin this notice</label>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Content</label>
            <textarea name="content" value={formData.content} onChange={handleChange} rows={5} maxLength={5000}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition text-sm font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition text-sm">
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Management Page ───────────────────────────────
export default function NoticeManagement() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices');
      setNotices(res.data.notices);
    } catch (error) {
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/notices/${toDelete._id}`);
      toast.success('Notice removed successfully');
      setToDelete(null);
      fetchNotices();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete notice');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = filter === 'ALL' ? notices
    : filter === 'PINNED' ? notices.filter(n => n.isPinned)
    : notices.filter(n => n.priority === filter);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Notice Management</h2>
          <p className="text-sm text-gray-500 mt-1">{notices.length} active notice{notices.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/notices/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold hover:bg-blue-700 transition">
          + New Notice
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['ALL', 'PINNED', 'EMERGENCY', 'IMPORTANT', 'NORMAL'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
              filter === f ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'EMERGENCY' ? '🚨 ' : f === 'IMPORTANT' ? '⚠️ ' : f === 'PINNED' ? '📌 ' : ''}{f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center p-10 text-gray-500">Loading notices...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-bold text-lg">No notices found</div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Notice</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Target</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Priority</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Visible To</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expires</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(n => (
                  <tr key={n._id} className={`hover:bg-gray-50 transition ${n.priority === 'EMERGENCY' ? 'bg-red-50' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {n.isPinned && <span className="text-blue-500 text-xs font-bold">📌</span>}
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{n.title}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{n.content}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.targetType === 'GLOBAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {n.targetType === 'GLOBAL' ? '🌐 GLOBAL' : `🏠 ${n.hostelId?.name || 'HOSTEL'}`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[n.priority]}`}>
                        {n.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 font-medium">{n.visibleTo}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {n.expiresAt ? formatDate(n.expiresAt) : <span className="text-gray-400 italic">Never</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button onClick={() => setToEdit(n)} className="text-blue-600 text-sm font-bold hover:underline">Edit</button>
                        <button onClick={() => setToDelete(n)} className="text-red-500 text-sm font-bold hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toDelete && (
        <ConfirmDeleteModal notice={toDelete} onConfirm={handleDelete} onCancel={() => setToDelete(null)} deleting={deleting} />
      )}
      {toEdit && (
        <EditModal notice={toEdit} onClose={() => setToEdit(null)} onUpdated={fetchNotices} />
      )}
    </div>
  );
}
