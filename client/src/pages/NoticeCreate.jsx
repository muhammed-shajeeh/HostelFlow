import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Calendar, Bell, ArrowLeft, ShieldAlert, Sparkles, Clock, RefreshCw } from 'lucide-react';

export default function NoticeCreate() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [hostels, setHostels] = useState([]);
  const [publishMode, setPublishMode] = useState('NOW'); // 'NOW' or 'LATER'
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: user?.role === 'WARDEN' ? 'HOSTEL' : 'HOSTEL',
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    priority: 'NORMAL',
    isPinned: false,
    audienceScope: 'ALL',
    expiresAt: '',
    publishAt: '',
    recurrenceType: 'NONE'
  });
  
  const [submitting, setSubmitting] = useState(false);

  // Load hostels for Admins
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get('/hostels')
        .then(res => {
          const list = res.data.hostels || [];
          setHostels(list);
          if (list.length > 0 && !formData.hostelId) {
            setFormData(prev => ({ ...prev, hostelId: list[0]._id }));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.content.length < 10) {
      return toast.error('Announcement must contain at least 10 characters.');
    }
    if (formData.targetType === 'HOSTEL' && !formData.hostelId) {
      return toast.error('Please select a targeted hostel.');
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        hostelId: formData.targetType === 'GLOBAL' ? undefined : formData.hostelId,
        publishAt: publishMode === 'NOW' ? new Date().toISOString() : new Date(formData.publishAt).toISOString(),
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        recurrenceType: formData.recurrenceType
      };

      await api.post('/notices', payload);
      toast.success(publishMode === 'NOW' ? 'Notice published successfully!' : 'Notice scheduled successfully!');
      navigate('/notices/manage');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell size={26} className="text-blue-600 animate-swing" />
            Create Announcement
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Broadcast a smart notice, schedule in advance, or queue recurring operational alerts.
          </p>
        </div>
        <button
          onClick={() => navigate('/notices/manage')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {/* Main Title Input */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Announcement Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="e.g. Mess Menu Rotation updates"
              className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition"
            />
            <div className="text-[10px] text-slate-400 text-right mt-1.5 font-bold">{formData.title.length}/150</div>
          </div>

          {/* Scope Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Target Scope */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Publishing Scope</label>
              <select
                name="targetType"
                value={formData.targetType}
                onChange={handleChange}
                disabled={user?.role === 'WARDEN'}
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="HOSTEL">Isolated Hostel</option>
                {user?.role === 'ADMIN' && <option value="GLOBAL">Global System Broadcast</option>}
              </select>
              {user?.role === 'WARDEN' && (
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">Wardens are locked to assigned hostel.</p>
              )}
            </div>

            {/* Hostel isolated selector */}
            {formData.targetType === 'HOSTEL' && (
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Target Hostel</label>
                {user?.role === 'ADMIN' ? (
                  <select
                    name="hostelId"
                    value={formData.hostelId}
                    onChange={handleChange}
                    required
                    className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Select Hostel Target --</option>
                    {hostels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={user?.hostelId?.name || 'Your Assigned Hostel'}
                    disabled
                    className="w-full text-xs p-3.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl outline-none font-bold"
                  />
                )}
              </div>
            )}
          </div>

          {/* Priority & Audience scopes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Priority Level</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="NORMAL">NORMAL priority</option>
                <option value="IMPORTANT">⚠️ IMPORTANT priority</option>
                <option value="EMERGENCY">🚨 EMERGENCY priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Audience Roles</label>
              <select
                name="audienceScope"
                value={formData.audienceScope}
                onChange={handleChange}
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Roles (Students, Parents & Wardens)</option>
                <option value="STUDENTS">Students Only</option>
                <option value="PARENTS">Parents Only</option>
                <option value="WARDENS">Wardens Only</option>
              </select>
            </div>
          </div>

          {/* Publishing Mode Selectors */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> Schedule & Publishing Engine
            </h4>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'NOW'}
                  onChange={() => setPublishMode('NOW')}
                  className="w-4 h-4 accent-blue-600"
                />
                Publish Instantly
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'LATER'}
                  onChange={() => setPublishMode('LATER')}
                  className="w-4 h-4 accent-blue-600"
                />
                Schedule Later
              </label>
            </div>

            {publishMode === 'LATER' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Publish Date & Time</label>
                  <input
                    type="datetime-local"
                    name="publishAt"
                    value={formData.publishAt}
                    onChange={handleChange}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full text-xs p-3 border border-slate-200 bg-white rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Expiry & Recurrence fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Auto Expiry */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Automatic Expiry (Optional)</label>
              <input
                type="date"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
              />
              <p className="text-[9px] text-slate-400 font-bold mt-1.5">Disappears from noticeboards automatically after selected date.</p>
            </div>

            {/* Recurrence Repeat Option */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                <RefreshCw size={12} className="text-slate-400" /> Recurrence Interval
              </label>
              <select
                name="recurrenceType"
                value={formData.recurrenceType}
                onChange={handleChange}
                className="w-full text-xs p-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="NONE">No Repeat (Single Announcement)</option>
                <option value="DAILY">Repeat Daily</option>
                <option value="WEEKLY">Repeat Weekly</option>
                <option value="MONTHLY">Repeat Monthly</option>
              </select>
              <p className="text-[9px] text-slate-400 font-bold mt-1.5">Automatically clones a fresh scheduled notice instance at interval limits.</p>
            </div>
          </div>

          {/* Pin Announcement Switch */}
          <div className="flex items-center gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
            <input
              type="checkbox"
              id="isPinned"
              name="isPinned"
              checked={formData.isPinned}
              onChange={handleChange}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="isPinned" className="text-xs font-extrabold text-blue-800 cursor-pointer flex items-center gap-1">
              📌 Pin Announcement (forces to display on top of notice boards)
            </label>
          </div>

          {/* Main Notice Content Area */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Message Body</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={7}
              maxLength={5000}
              placeholder="Provide the complete details of the announcement here..."
              className="w-full text-sm p-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition resize-none"
            />
            <div className="text-[10px] text-slate-400 text-right mt-1.5 font-bold">{formData.content.length}/5000</div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/notices/manage')}
              className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : publishMode === 'NOW' ? 'Publish Announcement' : 'Schedule Announcement'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
