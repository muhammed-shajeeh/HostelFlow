import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

export default function StudentLeaveRequest() {
  const navigate = useNavigate();
  const { refreshBadgeSummary } = useSocket();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: 'HOME',
    reason: '',
    destination: '',
    emergencyContact: '',
    departureDate: '',
    expectedReturnDate: '',
    isEmergency: false
  });

  useEffect(() => {
    // Mark leave updates as read to clear sidebar badges
    api.put('/notifications/read-category', { category: 'LEAVE' })
      .then(() => refreshBadgeSummary())
      .catch(err => console.warn('Failed to clear leave notifications', err));
  }, []);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/leaves/request', formData);
      if (res.data.success) {
        toast.success(res.data.message);
        navigate('/student/leaves/history');
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit leave request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="bg-white p-8 rounded shadow border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Apply for Leave / Outpass</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Leave Type</label>
              <select name="leaveType" value={formData.leaveType} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="HOME">Home Visit</option>
                <option value="DAY_PASS">Day Pass</option>
                <option value="MEDICAL">Medical Leave</option>
                <option value="EMERGENCY">Emergency</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 text-sm font-bold text-red-600 cursor-pointer">
                <input type="checkbox" name="isEmergency" checked={formData.isEmergency} onChange={handleChange} className="w-5 h-5 accent-red-600" />
                Mark as Emergency
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">Reason for Leave</label>
            <textarea required minLength="5" name="reason" value={formData.reason} onChange={handleChange} rows="3" placeholder="Please explain in detail..." className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Destination Address</label>
              <input required type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="City, State" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Emergency Contact Number</label>
              <input required type="text" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="+1 234 567 890" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Departure Date & Time</label>
              <input required type="datetime-local" name="departureDate" value={formData.departureDate} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Expected Return Date & Time</label>
              <input required type="datetime-local" name="expectedReturnDate" value={formData.expectedReturnDate} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <button 
              type="submit" 
              disabled={submitting} 
              className="w-full bg-blue-600 text-white p-3 rounded font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting Request...' : 'Submit Leave Request'}
            </button>
            <p className="text-xs text-center text-gray-500 mt-3">Your request will be sent to your assigned Warden for approval. QR codes are generated upon approval.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
