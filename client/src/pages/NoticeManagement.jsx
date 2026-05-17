import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { 
  Bell, Calendar, Clock, Trash2, Edit3, ShieldAlert, 
  MapPin, User, RefreshCw, Layers, CheckCircle2, Lock, Tag, AlertTriangle
} from 'lucide-react';

const PRIORITY_THEMES = {
  EMERGENCY: 'border-red-200 bg-red-50/30 text-red-700 font-extrabold',
  IMPORTANT: 'border-amber-200 bg-amber-50/30 text-amber-700 font-bold',
  NORMAL: 'border-slate-200 bg-slate-50/50 text-slate-700'
};

const formatDate = (d) => {
  if (!d) return 'Never';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Confirm Delete Modal ─────────────────────────────────────────
function ConfirmDeleteModal({ notice, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6">
        <h3 className="font-extrabold text-slate-900 text-lg mb-2 flex items-center gap-2">
          <AlertTriangle className="text-red-500 animate-bounce" size={22} />
          Remove Announcement?
        </h3>
        <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-5">
          Are you sure you want to permanently delete <strong>"{notice.title}"</strong>? This will remove the notice from all active feeds.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
            {deleting ? 'Removing...' : 'Delete Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Advanced Notice Edit Modal ──────────────────────────────────
function EditModal({ notice, onClose, onUpdated }) {
  const [publishMode, setPublishMode] = useState(
    notice.publishAt && new Date(notice.publishAt) > new Date() ? 'LATER' : 'NOW'
  );

  const [formData, setFormData] = useState({
    title: notice.title,
    content: notice.content,
    priority: notice.priority,
    isPinned: notice.isPinned,
    audienceScope: notice.audienceScope || notice.visibleTo || 'ALL',
    expiresAt: notice.expiresAt ? notice.expiresAt.split('T')[0] : '',
    publishAt: notice.publishAt ? notice.publishAt.slice(0, 16) : '',
    recurrenceType: notice.recurrenceType || 'NONE'
  });
  
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        publishAt: publishMode === 'NOW' ? new Date().toISOString() : new Date(formData.publishAt).toISOString(),
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null
      };

      await api.put(`/notices/${notice._id}`, payload);
      toast.success('Announcement modified successfully.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update announcement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl my-8">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
          <h3 className="font-extrabold text-slate-800 text-md flex items-center gap-2">
            <Edit3 size={18} className="text-blue-500" /> Edit Announcement
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-extrabold text-xl">×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Announcement Title</label>
              <input 
                type="text" name="title" value={formData.title} onChange={handleChange} required maxLength={150}
                className="w-full text-xs p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none" 
              />
            </div>

            {/* Config Grids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Priority</label>
                <select name="priority" value={formData.priority} onChange={handleChange}
                  className="w-full text-xs p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none">
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Audience Roles</label>
                <select name="audienceScope" value={formData.audienceScope} onChange={handleChange}
                  className="w-full text-xs p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none">
                  <option value="ALL">All Roles</option>
                  <option value="STUDENTS">Students Only</option>
                  <option value="PARENTS">Parents Only</option>
                  <option value="WARDENS">Wardens Only</option>
                </select>
              </div>
            </div>

            {/* Schedule config */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio" name="editPublishMode" checked={publishMode === 'NOW'} onChange={() => setPublishMode('NOW')}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Publish Instantly
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio" name="editPublishMode" checked={publishMode === 'LATER'} onChange={() => setPublishMode('LATER')}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Schedule Future Time
                </label>
              </div>

              {publishMode === 'LATER' && (
                <input
                  type="datetime-local" name="publishAt" value={formData.publishAt} onChange={handleChange} required
                  className="w-full text-xs p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none"
                />
              )}
            </div>

            {/* Recurrence & Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Repeat Option</label>
                <select name="recurrenceType" value={formData.recurrenceType} onChange={handleChange}
                  className="w-full text-xs p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none">
                  <option value="NONE">No Repeat</option>
                  <option value="DAILY">Repeat Daily</option>
                  <option value="WEEKLY">Repeat Weekly</option>
                  <option value="MONTHLY">Repeat Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Expiry Date</label>
                <input type="date" name="expiresAt" value={formData.expiresAt} onChange={handleChange}
                  className="w-full text-xs p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none" />
              </div>
            </div>

            {/* Pin Announcement Switch */}
            <div className="flex items-center gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <input type="checkbox" id="editPinned" name="isPinned" checked={formData.isPinned} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
              <label htmlFor="editPinned" className="text-xs font-extrabold text-blue-800 cursor-pointer">📌 Pin Announcement</label>
            </div>

            {/* Content text */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Message Content</label>
              <textarea name="content" value={formData.content} onChange={handleChange} rows={5} maxLength={5000} required
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none resize-none" />
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Notice Management Panel ─────────────────────────────────────
export default function NoticeManagement() {
  const { user } = useContext(AuthContext);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices?mode=manage');
      setNotices(res.data.notices || []);
    } catch (error) {
      toast.error('Failed to load active notices timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchNotices(); 
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/notices/${toDelete._id}`);
      toast.success('Notice removed successfully.');
      setToDelete(null);
      fetchNotices();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove announcement.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = filter === 'ALL' ? notices
    : filter === 'PINNED' ? notices.filter(n => n.isPinned)
    : filter === 'SCHEDULED' ? notices.filter(n => !n.isPublished || new Date(n.publishAt) > new Date())
    : filter === 'RECURRING' ? notices.filter(n => n.isRecurring)
    : notices.filter(n => n.priority === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers size={26} className="text-blue-600" />
            Notice Management
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Moderate, edit, delete, or create smart automated announcements for isolated residency audiences.
          </p>
        </div>
        <Link to="/notices/create"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/10 cursor-pointer self-start md:self-auto"
        >
          + New Announcement
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['ALL', 'PINNED', 'SCHEDULED', 'RECURRING', 'EMERGENCY', 'IMPORTANT', 'NORMAL'].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === f 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'EMERGENCY' ? '🚨 ' : f === 'IMPORTANT' ? '⚠️ ' : f === 'PINNED' ? '📌 ' : f === 'SCHEDULED' ? '⏰ ' : f === 'RECURRING' ? '🔄 ' : ''}{f}
          </button>
        ))}
      </div>

      {/* Notices Grid cards */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">Querying announcements...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-4 text-slate-400">
            <Bell size={28} />
          </div>
          <h3 className="font-extrabold text-sm text-slate-800 mb-1">No Announcements Queued</h3>
          <p className="text-xs text-slate-400 font-semibold max-w-sm">
            There are no active or scheduled notices inside this moderation query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(n => {
            const isScheduled = !n.isPublished || new Date(n.publishAt) > new Date();
            const isExpired = n.expiresAt && new Date(n.expiresAt) <= new Date();
            
            // Perms Check
            const canModify = user?.role === 'ADMIN' || (user?.role === 'WARDEN' && n.createdBy?._id === user?._id);

            return (
              <div 
                key={n._id} 
                className={`relative bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  PRIORITY_THEMES[n.priority]
                } ${n.isPinned ? 'ring-2 ring-blue-500/20' : ''}`}
              >
                {/* Badges line */}
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs">
                      {n.priority}
                    </span>
                    {n.isPinned && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5 shadow-2xs">
                        📌 PINNED
                      </span>
                    )}
                    {isScheduled && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-0.5 shadow-2xs animate-pulse">
                        ⏰ SCHEDULED
                      </span>
                    )}
                    {n.isRecurring && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 shadow-2xs">
                        🔄 {n.recurrenceType}
                      </span>
                    )}
                    {isExpired && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-0.5 shadow-2xs">
                        ⚠️ EXPIRED
                      </span>
                    )}
                  </div>

                  {/* Title & Body */}
                  <h4 className="font-extrabold text-sm text-slate-800 leading-snug mb-1.5">{n.title}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4 whitespace-pre-line line-clamp-4">
                    {n.content}
                  </p>
                </div>

                {/* Footer Details */}
                <div className="border-t border-slate-100 pt-4 mt-2 flex flex-col gap-2">
                  {/* Targets & Timings */}
                  <div className="flex flex-col gap-1 text-[10px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400" />
                      Scope: <strong className="text-slate-600">{n.targetType === 'GLOBAL' ? '🌐 ALL HOSTELS' : `🏠 ${n.hostelId?.name || 'Assigned Hostel'}`}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers size={12} className="text-slate-400" />
                      Audience: <strong className="text-slate-600">{n.audienceScope || n.visibleTo || 'ALL'}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      Publish: <span className="text-slate-600 font-bold">{formatDate(n.publishAt)}</span>
                    </span>
                    {n.expiresAt && (
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-slate-400" />
                        Expiry: <span className="text-red-500 font-bold">{formatDate(n.expiresAt)}</span>
                      </span>
                    )}
                  </div>

                  {/* Author, Actions */}
                  <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400 font-bold">
                      <User size={11} />
                      <span>
                        {n.createdBy?.fullName || 'System'} <span className="font-medium">({n.createdBy?.role})</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canModify ? (
                        <>
                          <button 
                            onClick={() => setToEdit(n)} 
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit notice"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => setToDelete(n)} 
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete notice"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded font-black text-[9px]">
                          <Lock size={9} /> LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {toDelete && (
        <ConfirmDeleteModal notice={toDelete} onConfirm={handleDelete} onCancel={() => setToDelete(null)} deleting={deleting} />
      )}
      {toEdit && (
        <EditModal notice={toEdit} onClose={() => setToEdit(null)} onUpdated={fetchNotices} />
      )}
    </div>
  );
}
