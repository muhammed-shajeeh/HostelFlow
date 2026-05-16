import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function PendingLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeLeaveId, setActiveLeaveId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/leaves/pending');
      setLeaves(res.data.leaves);
    } catch (error) {
      toast.error('Failed to fetch pending leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (window.confirm('Approve this leave and generate QR Pass?')) {
      try {
        const res = await api.put(`/leaves/${id}/approve`);
        toast.success(res.data.message);
        fetchPending();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Approval failed');
      }
    }
  };

  const submitReject = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/leaves/${activeLeaveId}/reject`, { rejectionReason });
      toast.success('Leave rejected successfully');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchPending();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Rejection failed');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Pending Leave Requests</h2>

      {loading ? (
        <div className="text-center p-10">Loading requests...</div>
      ) : (
        <div className="space-y-4">
          {leaves.map(leave => (
            <div key={leave._id} className={`bg-white rounded shadow border ${leave.isEmergency ? 'border-red-400 border-l-4' : 'border-gray-200'}`}>
              <div className="p-5 flex flex-col lg:flex-row justify-between gap-4">
                
                {/* Student Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{leave.studentId.fullName}</h3>
                    <span className="text-sm bg-gray-100 px-2 rounded text-gray-600">{leave.studentId.admissionNumber}</span>
                    {leave.isEmergency && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase animate-pulse">Emergency</span>}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-bold text-blue-600">Room {leave.roomId.roomNumber}</span>
                    <span className="mx-2">|</span>
                    <span>{leave.studentId.department}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-gray-50 p-3 rounded mt-3">
                    <div><strong>Type:</strong> {leave.leaveType}</div>
                    <div><strong>Destination:</strong> {leave.destination}</div>
                    <div><strong>Emergency Contact:</strong> {leave.emergencyContact}</div>
                    <div className="col-span-full"><strong>Reason:</strong> {leave.reason}</div>
                  </div>
                </div>

                {/* Dates & Actions */}
                <div className="flex flex-col justify-between min-w-[250px] border-l pl-4">
                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 font-bold uppercase">Departure</div>
                      <div className="text-sm">{new Date(leave.departureDate).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-bold uppercase">Expected Return</div>
                      <div className="text-sm">{new Date(leave.expectedReturnDate).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setActiveLeaveId(leave._id); setShowRejectModal(true); }}
                      className="flex-1 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded transition text-sm"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(leave._id)}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded transition text-sm shadow"
                    >
                      Approve
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
          {leaves.length === 0 && (
            <div className="text-center p-10 bg-white shadow rounded text-gray-500">
              No pending leave requests.
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-red-600">Reject Leave Request</h3>
            <form onSubmit={submitReject}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1">Reason for Rejection</label>
                <textarea 
                  required 
                  value={rejectionReason} 
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 outline-none" 
                  rows="3"
                  placeholder="Explain why this request is denied..."
                ></textarea>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRejectModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Confirm Rejection</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
