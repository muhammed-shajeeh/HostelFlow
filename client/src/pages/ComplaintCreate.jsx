import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';

// Category labels for the dropdown
const CATEGORIES = [
  { value: 'ELECTRICAL', label: '⚡ Electrical' },
  { value: 'PLUMBING', label: '🔧 Plumbing' },
  { value: 'FURNITURE', label: '🪑 Furniture' },
  { value: 'WIFI', label: '📶 WiFi / Internet' },
  { value: 'CLEANING', label: '🧹 Cleaning' },
  { value: 'SECURITY', label: '🔒 Security' },
  { value: 'HARASSMENT', label: '🚨 Harassment' },
  { value: 'MESS', label: '🍽️ Mess / Canteen' },
  { value: 'ROOM_CHANGE', label: '🚪 Room Change Request' },
  { value: 'OTHER', label: '📋 Other' }
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: '🚨 Urgent', color: 'bg-red-100 text-red-700' }
];

export default function ComplaintCreate() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category) return toast.error('Please select a category');
    if (formData.description.length < 20)
      return toast.error('Please provide a more detailed description (at least 20 characters)');

    setSubmitting(true);
    try {
      // Backend auto-attaches hostelId and roomId from the authenticated user
      await api.post('/complaints', formData);
      toast.success('Complaint submitted successfully! The warden has been notified.');
      navigate('/student/complaints');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Submit a Complaint</h2>
          <p className="text-gray-500 text-sm mt-1">
            Room: {user?.roomId?.roomNumber ? `Room ${user.roomId.roomNumber}` : 'Auto-detected'} •{' '}
            Hostel: {user?.hostelId?.name || 'Auto-detected'}
          </p>
        </div>
        <button
          onClick={() => navigate('/student/complaints')}
          className="text-gray-500 hover:text-gray-700 font-medium text-sm"
        >
          ← Back to My Complaints
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Complaint Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g. Tap in bathroom is leaking"
              maxLength={120}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{formData.title.length}/120</div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <NativeSelect
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="-- Select Category --"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">-- Select Category --</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </NativeSelect>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Priority Level
            </label>
            <div className="flex flex-wrap gap-3">
              {PRIORITIES.map(p => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${formData.priority === p.value
                      ? 'border-blue-500 ring-2 ring-blue-300 ' + p.color
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Describe the issue in detail. Include when it started, how it affects you, and any relevant observations..."
              maxLength={2000}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{formData.description.length}/2000</div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={() => navigate('/student/complaints')}
              className="px-5 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow"
            >
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
