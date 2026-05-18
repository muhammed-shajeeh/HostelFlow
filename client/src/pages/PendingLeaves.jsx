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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchPending();
  }, []);

  useEffect(() => {
    const handleLeaveUpdated = (e) => {
      const updated = e.detail;
      setLeaves(prev => {
        if (updated.status !== 'PENDING') {
          return prev.filter(l => l._id !== updated._id);
        }
        if (prev.some(l => l._id === updated._id)) {
          return prev.map(l => l._id === updated._id ? { ...l, ...updated } : l);
        }
        return [updated, ...prev];
      });
    };

    window.addEventListener('erp:leaveUpdated', handleLeaveUpdated);
    return () => window.removeEventListener('erp:leaveUpdated', handleLeaveUpdated);
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
            <div key={leave._id} className={`bg-white rounded-2xl shadow-xs border ${leave.isEmergency ? 'border-red-400 border-l-4' : 'border-gray-200'} overflow-hidden`}>
              <div className="p-5 flex flex-col lg:flex-row justify-between gap-5">
                
                {/* Student Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-black text-slate-900">{leave.studentId.fullName}</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg font-bold">{leave.studentId.admissionNumber}</span>
                    {leave.isEmergency && <span className="bg-red-650 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">Emergency</span>}
                  </div>
                  <div className="text-xs text-slate-500 mb-3">
                    <span className="font-extrabold text-blue-600">Room {leave.roomId.roomNumber}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="font-medium">{leave.studentId.department}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Leave Type</span>
                      <span className="font-bold text-slate-800">{leave.leaveType}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Destination</span>
                      <span className="font-bold text-slate-800 truncate block">{leave.destination}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Emergency Contact</span>
                      <span className="font-bold text-slate-800">{leave.emergencyContact}</span>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Reason for Request</span>
                      <span className="font-medium text-slate-700">{leave.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Dates & Actions */}
                <div className="flex flex-col justify-between w-full lg:w-auto lg:min-w-[250px] lg:border-l lg:border-slate-100 lg:pl-5 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 mb-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Departure</div>
                      <div className="text-xs font-bold text-slate-800">{new Date(leave.departureDate).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expected Return</div>
                      <div className="text-xs font-bold text-slate-800">{new Date(leave.expectedReturnDate).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setActiveLeaveId(leave._id); setShowRejectModal(true); }}
                      className="flex-1 px-4 py-2.5 border border-red-200 text-red-650 hover:bg-red-50 font-bold rounded-xl transition text-xs cursor-pointer shadow-2xs"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(leave._id)}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition text-xs shadow-sm cursor-pointer"
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
