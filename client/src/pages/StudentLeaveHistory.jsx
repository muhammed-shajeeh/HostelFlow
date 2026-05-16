import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentLeaveHistory() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/leaves/student/history');
      setLeaves(res.data.leaves);
    } catch (error) {
      toast.error('Failed to fetch leave history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">PENDING</span>;
      case 'APPROVED': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">APPROVED - READY FOR EXIT</span>;
      case 'EXITED': return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">CURRENTLY OUTSIDE</span>;
      case 'RETURNED': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">RETURNED</span>;
      case 'REJECTED': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">REJECTED</span>;
      default: return null;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">My Leave & Outpass History</h2>

      {loading ? (
        <div className="text-center p-10">Loading history...</div>
      ) : (
        <div className="space-y-6">
          {leaves.map(leave => (
            <div key={leave._id} className="bg-white rounded shadow border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800">{leave.leaveType}</span>
                  {leave.isEmergency && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase">Emergency</span>}
                </div>
                {getStatusBadge(leave.status)}
              </div>
              
              <div className="p-4 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-2 text-sm">
                  <div><strong>Reason:</strong> {leave.reason}</div>
                  <div><strong>Destination:</strong> {leave.destination}</div>
                  <div><strong>Emergency Contact:</strong> {leave.emergencyContact}</div>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <span className="block text-gray-500 text-xs">Departure</span>
                      <strong>{new Date(leave.departureDate).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-500 text-xs">Return</span>
                      <strong>{new Date(leave.expectedReturnDate).toLocaleString()}</strong>
                    </div>
                  </div>
                  
                  {leave.status === 'REJECTED' && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
                      <strong>Rejection Reason:</strong> {leave.rejectionReason}
                    </div>
                  )}

                  {(leave.exitedAt || leave.returnedAt) && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-xs">
                      {leave.exitedAt && <div><strong className="text-purple-600">Actual Exit:</strong><br/>{new Date(leave.exitedAt).toLocaleString()}</div>}
                      {leave.returnedAt && <div><strong className="text-green-600">Actual Return:</strong><br/>{new Date(leave.returnedAt).toLocaleString()}</div>}
                    </div>
                  )}
                </div>

                {/* Secure QR Display */}
                {(leave.status === 'APPROVED' || leave.status === 'EXITED') && leave.qrToken && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded border min-w-[200px]">
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase text-center">
                      {leave.status === 'APPROVED' ? 'Scan to Exit' : 'Scan to Return'}
                    </div>
                    <QRCodeSVG value={leave.qrToken} size={150} level="H" />
                    <div className="mt-2 text-[10px] text-gray-400 font-mono break-all text-center">
                      Pass ID: {leave._id.slice(-6)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {leaves.length === 0 && (
            <div className="text-center p-10 bg-white border shadow rounded text-gray-500">
              You have no leave history.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
