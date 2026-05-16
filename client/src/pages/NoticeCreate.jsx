import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function NoticeCreate() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [hostels, setHostels] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'HOSTEL',
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    priority: 'NORMAL',
    isPinned: false,
    expiresAt: '',
    visibleTo: 'ALL'
  });
  const [submitting, setSubmitting] = useState(false);

  // Admins need to pick a hostel from the list for HOSTEL-targeted notices
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get('/hostels').then(res => setHostels(res.data.hostels || [])).catch(() => {});
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.content.length < 10) return toast.error('Please write more detailed content.');
    if (formData.targetType === 'HOSTEL' && !formData.hostelId) {
      return toast.error('Please select a hostel for hostel-targeted notices.');
    }

    setSubmitting(true);
    try {
      await api.post('/notices', {
        ...formData,
        // Only include hostelId when targeting a specific hostel
        hostelId: formData.targetType === 'GLOBAL' ? undefined : formData.hostelId,
        expiresAt: formData.expiresAt || null
      });
      toast.success('Notice published successfully!');
      navigate('/notices/manage');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to publish notice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Create Notice</h2>
          <p className="text-sm text-gray-500 mt-1">Publish an announcement to hostel residents</p>
        </div>
        <button onClick={() => navigate('/notices/manage')} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text" name="title" value={formData.title}
              onChange={handleChange} required maxLength={150}
              placeholder="e.g. Water supply disruption on Floor 3"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{formData.title.length}/150</div>
          </div>

          {/* Target Type (Admin only for GLOBAL) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Target</label>
              <select
                name="targetType" value={formData.targetType} onChange={handleChange}
                className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={user?.role === 'WARDEN'} // Wardens always post to their hostel
              >
                <option value="HOSTEL">Specific Hostel</option>
                {user?.role === 'ADMIN' && <option value="GLOBAL">Global (All Hostels)</option>}
              </select>
              {user?.role === 'WARDEN' && (
                <p className="text-xs text-gray-400 mt-1">Wardens can only post hostel-specific notices.</p>
              )}
            </div>

            {/* Hostel picker (hidden for GLOBAL or Wardens) */}
            {formData.targetType === 'HOSTEL' && user?.role === 'ADMIN' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Hostel</label>
                <select
                  name="hostelId" value={formData.hostelId} onChange={handleChange} required
                  className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Select Hostel --</option>
                  {hostels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
              </div>
            )}

            {formData.targetType === 'HOSTEL' && user?.role === 'WARDEN' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hostel</label>
                <input type="text" value={user?.hostelId?.name || 'Your Hostel'} disabled
                  className="w-full p-3 border rounded-lg bg-gray-50 text-gray-500" />
              </div>
            )}
          </div>

          {/* Priority & Visibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange}
                className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">⚠️ Important</option>
                <option value="EMERGENCY">🚨 Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Visible To</label>
              <select name="visibleTo" value={formData.visibleTo} onChange={handleChange}
                className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="ALL">All Users</option>
                <option value="STUDENTS">Students Only</option>
                <option value="WARDENS">Wardens Only</option>
              </select>
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Expiry Date (Optional)</label>
            <input type="date" name="expiresAt" value={formData.expiresAt} onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Leave blank for a permanent notice.</p>
          </div>

          {/* Pin Toggle */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <input type="checkbox" id="isPinned" name="isPinned"
              checked={formData.isPinned} onChange={handleChange}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="isPinned" className="text-sm font-bold text-blue-800 cursor-pointer">
              📌 Pin this notice (appears at the top of the noticeboard)
            </label>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              name="content" value={formData.content} onChange={handleChange}
              required rows={7} maxLength={5000}
              placeholder="Write the full announcement here..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{formData.content.length}/5000</div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => navigate('/notices/manage')}
              className="px-5 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition font-medium">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow">
              {submitting ? 'Publishing...' : 'Publish Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
