import { useState, useEffect, useContext, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { AuthContext } from '../context/AuthContext';
import { Download, Maximize2, Sun, ShieldCheck, X, FileText, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

import { useSocket } from '../context/SocketContext';

export default function StudentLeaveHistory() {
  const { user } = useContext(AuthContext);
  const { refreshBadgeSummary } = useSocket();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / High Contrast / Fullscreen States
  const [selectedPass, setSelectedPass] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highBrightness, setHighBrightness] = useState(false);

  useEffect(() => {
    fetchHistory();
    // Mark leave updates as read to clear sidebar badges
    api.put('/notifications/read-category', { category: 'LEAVE' })
      .then(() => refreshBadgeSummary())
      .catch(err => console.warn('Failed to clear leave notifications', err));
  }, []);

  useEffect(() => {
    const handleLeaveUpdated = (e) => {
      const updated = e.detail;
      setLeaves(prev => {
        if (prev.some(l => l._id === updated._id)) {
          toast.success(`Outpass status updated: ${updated.status}`, { icon: '🔔' });
          return prev.map(l => l._id === updated._id ? { ...l, ...updated } : l);
        }
        return [updated, ...prev];
      });
    };

    window.addEventListener('erp:leaveUpdated', handleLeaveUpdated);
    return () => window.removeEventListener('erp:leaveUpdated', handleLeaveUpdated);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/leaves/student/history');
      setLeaves(res.data.leaves || []);
    } catch (error) {
      toast.error('Failed to fetch leave history.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">PENDING</span>;
      case 'APPROVED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">APPROVED</span>;
      case 'EXITED':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">EXITED (OUTSIDE)</span>;
      case 'RETURNED':
        return <span className="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">RETURNED</span>;
      case 'REJECTED':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">REJECTED</span>;
      default:
        return null;
    }
  };

  // PNG Passcard Download Generator
  const downloadPassCard = (leave) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');

      // 1. Draw Background (Premium Teal Gradient)
      const gradient = ctx.createLinearGradient(0, 0, 0, 900);
      gradient.addColorStop(0, '#0f172a'); // slate-900
      gradient.addColorStop(0.5, '#1e293b'); // slate-800
      gradient.addColorStop(1, '#0d9488'); // teal-600
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 900);

      // 2. Draw Decorative Shapes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(300, 450, 260, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMART HOSTEL OUTPASS', 300, 65);

      ctx.fillStyle = '#2dd4bf'; // teal-400
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('OFFICIAL DIGITAL AUTHORIZATION CARD', 300, 90);

      // 4. White details container
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(40, 120, 520, 340, 20);
      ctx.fill();

      // Details inside white container
      ctx.textAlign = 'left';
      
      // Labels
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('STUDENT NAME', 70, 160);
      ctx.fillText('HOSTEL ACCOMMODATION', 70, 230);
      ctx.fillText('ROOM NUMBER', 340, 230);
      ctx.fillText('LEAVE OUTPASS TYPE', 70, 300);
      ctx.fillText('DEPARTURE DATE', 70, 370);
      ctx.fillText('EXPECTED RETURN DATE', 340, 370);

      // Values
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillText(user?.fullName?.toUpperCase() || 'HOSTEL RESIDENT', 70, 190);
      
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(user?.hostelId?.name || 'MAIN HOSTEL', 70, 260);
      ctx.fillText(user?.roomId?.roomNumber || 'N/A', 340, 260);
      
      ctx.fillStyle = '#0d9488'; // teal-600
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(leave.leaveType || 'OUTPASS', 70, 330);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(new Date(leave.departureDate).toLocaleDateString(), 70, 400);
      ctx.fillText(new Date(leave.expectedReturnDate).toLocaleDateString(), 340, 400);

      // 5. Draw QR code
      const qrCanvas = document.getElementById(`qr-src-${leave._id}`);
      if (qrCanvas) {
        // Draw white backing for QR
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(175, 490, 250, 250, 16);
        ctx.fill();

        ctx.drawImage(qrCanvas, 190, 505, 220, 220);
      }

      // 6. Footer Information
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`Pass ID: ${leave._id.toUpperCase()}`, 300, 780);

      ctx.fillStyle = '#ccfbf1';
      ctx.font = 'normal 11px system-ui, sans-serif';
      ctx.fillText('Verify at gatehouse terminals only.', 300, 810);
      ctx.fillText('Subject to standard hostel rules and code of conduct.', 300, 830);

      // 7. Save and trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Outpass_${leave.leaveType}_${leave._id.slice(-6)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Passcard downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Could not generate passcard PNG.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 font-sans text-slate-800">
      
      {/* Header section */}
      <div className="bg-gradient-to-r from-teal-800 to-cyan-900 p-6 md:p-8 rounded-2xl text-white shadow-lg">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          ✈️ Outpass & Leave Pass History
        </h2>
        <p className="text-teal-100 text-sm mt-2 max-w-2xl">
          View your requested outpasses, check approval statuses, and download official gate passes containing secure verification codes.
        </p>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center p-12 text-slate-500 font-bold">
          <RefreshCw className="animate-spin inline-block mr-2 text-teal-500" size={24} />
          Retrieving outpass logs...
        </div>
      ) : leaves.length === 0 ? (
        <div className="text-center p-16 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 max-w-lg mx-auto">
          <div className="text-5xl">📝</div>
          <h3 className="font-extrabold text-lg text-slate-700">No Leave History Found</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            You haven't requested any leaves or gate outpasses yet. When you request an outpass, it will appear here with its real-time approval status.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leaves.map((leave) => (
            <div key={leave._id} className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
              
              {/* Card Title & Status Badge */}
              <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-800 tracking-tight text-base">
                    {leave.leaveType}
                  </span>
                  {leave.isEmergency && (
                    <span className="bg-rose-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                      EMERGENCY
                    </span>
                  )}
                </div>
                {getStatusBadge(leave.status)}
              </div>

              {/* Card Details */}
              <div className="p-5 flex-1 space-y-4">
                
                {/* Details layout */}
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] block">Reason / Destination</span>
                    <span className="text-slate-700 font-semibold">{leave.reason} &rarr; <em className="text-teal-600 not-italic">{leave.destination}</em></span>
                  </div>
                  {leave.emergencyContact && (
                    <div>
                      <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] block">Emergency Contact</span>
                      <span className="text-slate-700 font-semibold">{leave.emergencyContact}</span>
                    </div>
                  )}
                </div>

                {/* Dates Block */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] block mb-1">Departure Schedule</span>
                    <strong className="text-slate-800 font-extrabold">{new Date(leave.departureDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] block mb-1">Expected Return</span>
                    <strong className="text-slate-800 font-extrabold">{new Date(leave.expectedReturnDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
                  </div>
                </div>

                {/* Status-specific Alerts */}
                {leave.status === 'REJECTED' && leave.rejectionReason && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex gap-2 items-start">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <strong className="font-extrabold">Rejection Reason:</strong>
                      <p className="mt-1">{leave.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {(leave.exitedAt || leave.returnedAt) && (
                  <div className="bg-slate-50 border p-3 rounded-xl text-[10px] grid grid-cols-2 gap-3 text-slate-500">
                    {leave.exitedAt && (
                      <div>
                        <span className="block font-bold uppercase tracking-wider text-[8px] text-slate-400">Actual Exit logged</span>
                        <strong>{new Date(leave.exitedAt).toLocaleString()}</strong>
                      </div>
                    )}
                    {leave.returnedAt && (
                      <div>
                        <span className="block font-bold uppercase tracking-wider text-[8px] text-slate-400">Actual Return logged</span>
                        <strong>{new Date(leave.returnedAt).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* QR display / Pass actions (Only shown when approved or exited) */}
              {(leave.status === 'APPROVED' || leave.status === 'EXITED') && leave.qrToken && (
                <div className="px-5 pb-5 pt-3 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="hidden">
                    {/* Hidden canvas used exclusively as image source for drawing download cards */}
                    <QRCodeCanvas id={`qr-src-${leave._id}`} value={leave.qrToken} size={256} level="H" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white p-1 rounded-lg border flex items-center justify-center shadow-sm">
                      <QRCodeCanvas value={leave.qrToken} size={48} level="L" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-teal-700 tracking-wider">
                        Secure Gatepass QR
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        Pass ID: {leave._id.slice(-8).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setSelectedPass(leave)}
                      className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Maximize2 size={13} /> View Pass
                    </button>
                    <button
                      onClick={() => downloadPassCard(leave)}
                      className="flex-1 md:flex-none px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Download size={13} /> Download Pass
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* PASS MODAL WITH SCANNER VIEW ENHANCEMENTS */}
      {selectedPass && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition duration-150 ${
          highBrightness ? 'bg-white' : 'bg-slate-900/85 backdrop-blur-md'
        }`}>
          
          {/* Modal Card wrapper */}
          <div className={`max-w-md w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col justify-between ${
            highBrightness ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-slate-100'
          }`}>
            
            {/* Modal Header */}
            <div className={`p-5 flex justify-between items-center border-b ${
              highBrightness ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  🛡️ Gate Outpass Card
                </h3>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                  ID: {selectedPass._id.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedPass(null);
                  setHighBrightness(false);
                  setIsFullscreen(false);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Pass details summary */}
              {!isFullscreen && (
                <div className={`p-4 rounded-2xl space-y-3 text-xs leading-relaxed ${
                  highBrightness ? 'bg-slate-50 text-slate-800' : 'bg-slate-900 text-slate-300'
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-60 block">Hostel accommodation</span>
                      <strong className="font-black text-slate-800">{user?.hostelId?.name || 'Hostel'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-60 block">Room allocation</span>
                      <strong className="font-black text-slate-800">{user?.roomId?.roomNumber || 'Unassigned'}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/50">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-60 block">Departure</span>
                      <strong className="font-extrabold">{new Date(selectedPass.departureDate).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-60 block">Expected Return</span>
                      <strong className="font-extrabold">{new Date(selectedPass.expectedReturnDate).toLocaleDateString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Large QR displaying */}
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className={`p-4 rounded-2xl bg-white border flex items-center justify-center shadow-lg transition-transform ${
                  isFullscreen ? 'scale-125 my-8' : ''
                }`}>
                  <QRCodeCanvas value={selectedPass.qrToken} size={isFullscreen ? 240 : 180} level="H" includeMargin={true} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase text-teal-500 tracking-wider">
                    {selectedPass.leaveType} OUTPASS
                  </div>
                  <p className="text-[10px] opacity-60 mt-1 max-w-xs mx-auto">
                    Present this code at the gate terminal. Security will scan this to mark your shift entry/exit.
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Controls */}
            <div className={`p-4 border-t flex gap-2 justify-between items-center ${
              highBrightness ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setHighBrightness(!highBrightness)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    highBrightness 
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300' 
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                  title="Toggle high contrast backing for scanning machines"
                >
                  <Sun size={15} /> Contrast
                </button>
                
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    isFullscreen 
                      ? 'bg-teal-100 text-teal-800 border-teal-300' 
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  <Maximize2 size={15} /> Size
                </button>
              </div>

              <button
                onClick={() => downloadPassCard(selectedPass)}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <Download size={15} /> Get PNG Pass
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
