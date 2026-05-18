import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function LeaveHistory() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const handleLeaveUpdated = (e) => {
      const updated = e.detail;
      setLeaves(prev => {
        if (prev.some(l => l._id === updated._id)) {
          return prev.map(l => l._id === updated._id ? { ...l, ...updated } : l);
        }
        if (updated.status !== 'PENDING') {
          return [updated, ...prev];
        }
        return prev;
      });
    };

    window.addEventListener('erp:leaveUpdated', handleLeaveUpdated);
    return () => window.removeEventListener('erp:leaveUpdated', handleLeaveUpdated);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/leaves/history');
      setLeaves(res.data.leaves);
    } catch (error) {
      toast.error('Failed to fetch leave history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'APPROVED': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">APPROVED</span>;
      case 'EXITED': return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold animate-pulse">OUTSIDE</span>;
      case 'RETURNED': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">RETURNED</span>;
      case 'REJECTED': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">REJECTED</span>;
      default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Leave & Outpass History</h2>

      {loading ? (
        <div className="text-center p-10">Loading records...</div>
      ) : isMobile ? (
        <div className="space-y-4">
          {leaves.map(leave => (
            <div key={leave._id} className={`bg-white rounded-2xl shadow-xs border ${leave.isEmergency ? 'border-red-400 border-l-4' : 'border-slate-200'} p-5 flex flex-col justify-between hover:shadow-md transition text-slate-800`}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900 text-base leading-tight">{leave.studentId?.fullName || '—'}</h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Room {leave.roomId?.roomNumber || '?'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {getStatusBadge(leave.status)}
                    {leave.isEmergency && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">Emergency</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 text-xs text-slate-650">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Leave Type</span>
                    <span className="font-bold text-slate-800">{leave.leaveType}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Scheduled Dates</span>
                    <span className="block font-medium text-slate-700"><strong>Out:</strong> {new Date(leave.departureDate).toLocaleDateString()}</span>
                    <span className="block font-medium text-slate-700"><strong>In:</strong> {new Date(leave.expectedReturnDate).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Actual Gate Tracking</span>
                    {leave.exitedAt ? (
                      <span className="block text-purple-700 font-bold">Left: {new Date(leave.exitedAt).toLocaleDateString()} {new Date(leave.exitedAt).toLocaleTimeString()}</span>
                    ) : <span className="block text-gray-400 italic">Not exited</span>}
                    
                    {leave.returnedAt ? (
                      <span className="block text-green-700 font-bold mt-0.5">Returned: {new Date(leave.returnedAt).toLocaleDateString()} {new Date(leave.returnedAt).toLocaleTimeString()}</span>
                    ) : <span className="block text-gray-400 italic">Not returned</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {leaves.length === 0 && (
            <div className="bg-white border rounded-2xl p-12 text-center text-gray-500">
              No leave history found.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Tracking</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaves.map(leave => (
                <tr key={leave._id} className={leave.isEmergency ? 'bg-red-50/30' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-900">{leave.studentId?.fullName}</div>
                    <div className="text-xs text-gray-500">Room {leave.roomId?.roomNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium">{leave.leaveType}</div>
                    {leave.isEmergency && <span className="text-[10px] bg-red-600 text-white px-1 rounded font-bold uppercase">Emergency</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div><span className="font-bold text-xs">Out:</span> {new Date(leave.departureDate).toLocaleDateString()}</div>
                    <div><span className="font-bold text-xs">In:</span> {new Date(leave.expectedReturnDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    {leave.exitedAt ? (
                      <div className="text-purple-700 font-bold mb-1">Left: {new Date(leave.exitedAt).toLocaleDateString()} {new Date(leave.exitedAt).toLocaleTimeString()}</div>
                    ) : <div className="text-gray-400 italic">Not exited</div>}
                    
                    {leave.returnedAt ? (
                      <div className="text-green-700 font-bold">Returned: {new Date(leave.returnedAt).toLocaleDateString()} {new Date(leave.returnedAt).toLocaleTimeString()}</div>
                    ) : <div className="text-gray-400 italic">Not returned</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(leave.status)}
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-500">No leave history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
