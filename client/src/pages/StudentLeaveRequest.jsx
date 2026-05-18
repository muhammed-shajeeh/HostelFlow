import { useState, useEffect, useContext, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Download, 
  Maximize2, 
  Sun, 
  X, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  MapPin, 
  Phone, 
  FileText, 
  PlusCircle, 
  History, 
  Clock, 
  CheckCircle2, 
  ShieldAlert 
} from 'lucide-react';

export default function StudentLeaveRequest() {
  const { user } = useContext(AuthContext);
  const { refreshBadgeSummary } = useSocket();
  
  // Leave lists and submission loading state
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal / High Contrast / Fullscreen States for Gate Pass
  const [selectedPass, setSelectedPass] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highBrightness, setHighBrightness] = useState(false);

  // Form input state
  const [formData, setFormData] = useState({
    leaveType: 'HOME',
    reason: '',
    destination: '',
    emergencyContact: '',
    departureDate: '',
    expectedReturnDate: '',
    isEmergency: false
  });

  // Fetch leave history on mount
  useEffect(() => {
    fetchHistory();
    // Mark leave updates as read to clear sidebar badges
    api.put('/notifications/read-category', { category: 'LEAVE' })
      .then(() => refreshBadgeSummary())
      .catch(err => console.warn('Failed to clear leave notifications', err));
  }, []);

  // Set up real-time Socket.IO live listeners
  useEffect(() => {
    const handleLeaveUpdated = (e) => {
      const updated = e.detail;
      setLeaves(prev => {
        // If it belongs to this student, patch the state dynamically
        if (prev.some(l => l._id === updated._id)) {
          toast.success(`Outpass status updated: ${updated.status}`, { 
            icon: '🔔',
            style: {
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #1e293b'
            }
          });
          return prev.map(l => l._id === updated._id ? { ...l, ...updated } : l);
        }
        // If it's a completely new request (unlikely to come via update event, but safe)
        return [updated, ...prev];
      });
      refreshBadgeSummary();
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
        toast.success(res.data.message || 'Leave request submitted successfully');
        
        // Dynamic state patching: refetch history to include the new request immediately
        await fetchHistory();
        
        // Reset the form values
        setFormData({
          leaveType: 'HOME',
          reason: '',
          destination: '',
          emergencyContact: '',
          departureDate: '',
          expectedReturnDate: '',
          isEmergency: false
        });
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

  // Split leaves into Active / Pending vs Historic Logs
  const activeLeaves = leaves.filter(l => ['PENDING', 'APPROVED', 'EXITED'].includes(l.status));
  const historicalLeaves = leaves.filter(l => ['RETURNED', 'REJECTED'].includes(l.status));

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">PENDING</span>;
      case 'APPROVED':
        return <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">APPROVED</span>;
      case 'EXITED':
        return <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">EXITED (OUT)</span>;
      case 'RETURNED':
        return <span className="bg-slate-100 dark:bg-zinc-800 text-slate-650 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">RETURNED</span>;
      case 'REJECTED':
        return <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">REJECTED</span>;
      default:
        return <span className="bg-slate-100 dark:bg-zinc-800 text-slate-650 border px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{status}</span>;
    }
  };

  // PNG Passcard Download Generator for native Android downloads
  const downloadPassCard = (leave) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');

      // 1. Draw Background (Premium Slate-to-Teal Gradient)
      const gradient = ctx.createLinearGradient(0, 0, 0, 900);
      gradient.addColorStop(0, '#0f172a'); 
      gradient.addColorStop(0.5, '#1e293b'); 
      gradient.addColorStop(1, '#0d9488'); 
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 900);

      // 2. Draw Subtle Branding Arcs
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(300, 450, 260, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMART HOSTEL OUTPASS', 300, 65);

      ctx.fillStyle = '#2dd4bf'; 
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('OFFICIAL DIGITAL AUTHORIZATION CARD', 300, 90);

      // 4. Details Container Box
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(40, 120, 520, 340, 20);
      ctx.fill();

      // Text configurations inside card details box
      ctx.textAlign = 'left';
      
      // Secondary Labels
      ctx.fillStyle = '#64748b'; 
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('STUDENT NAME', 70, 160);
      ctx.fillText('HOSTEL ACCOMMODATION', 70, 230);
      ctx.fillText('ROOM NUMBER', 340, 230);
      ctx.fillText('LEAVE OUTPASS TYPE', 70, 300);
      ctx.fillText('DEPARTURE DATE', 70, 370);
      ctx.fillText('EXPECTED RETURN DATE', 340, 370);

      // Value items
      ctx.fillStyle = '#0f172a'; 
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillText(user?.fullName?.toUpperCase() || 'HOSTEL RESIDENT', 70, 190);
      
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(user?.hostelId?.name || 'MAIN HOSTEL', 70, 260);
      ctx.fillText(user?.room || 'N/A', 340, 260);
      
      ctx.fillStyle = '#0d9488'; 
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(leave.leaveType || 'OUTPASS', 70, 330);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(new Date(leave.departureDate).toLocaleDateString(), 70, 400);
      ctx.fillText(new Date(leave.expectedReturnDate).toLocaleDateString(), 340, 400);

      // 5. Draw QR code image overlay
      const qrCanvas = document.getElementById(`qr-src-${leave._id}`);
      if (qrCanvas) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(175, 490, 250, 250, 16);
        ctx.fill();
        ctx.drawImage(qrCanvas, 190, 505, 220, 220);
      }

      // 6. Security Footer details
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`Pass ID: ${leave._id.toUpperCase()}`, 300, 780);

      ctx.fillStyle = '#ccfbf1';
      ctx.font = 'normal 11px system-ui, sans-serif';
      ctx.fillText('Verify at gatehouse terminals only.', 300, 810);
      ctx.fillText('Subject to standard hostel rules and code of conduct.', 300, 830);

      // 7. Save and initiate native system download prompt
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Outpass_${leave.leaveType}_${leave._id.slice(-6)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Passcard PNG downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Could not generate passcard PNG.');
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans text-slate-800 dark:text-zinc-100 max-w-5xl mx-auto">
      
      {/* Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 md:p-8 rounded-3xl text-white shadow-md flex items-center justify-between overflow-hidden relative">
        <div className="space-y-2 z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            ✈️ Student Leave & Outpass Portal
          </h2>
          <p className="text-blue-100 text-xs md:text-sm max-w-xl">
            Request official leave certificates, monitor approval queues, scan secure gatehouse QR codes, and review historic logs from this unified dashboard.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none translate-x-12 select-none">
          <FileText size={240} className="rotate-12" />
        </div>
      </div>

      {/* Grid Layout: Top Form (Left) & Info Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Leave Request Form */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <PlusCircle className="text-blue-600 dark:text-blue-400" size={20} />
            <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100">Apply for Outpass / Leave</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Leave Type</label>
                <select 
                  name="leaveType" 
                  value={formData.leaveType} 
                  onChange={handleChange} 
                  className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 font-bold text-xs"
                >
                  <option value="HOME">🏠 Home Visit</option>
                  <option value="DAY_PASS">🏙️ Day Pass</option>
                  <option value="MEDICAL">🏥 Medical Leave</option>
                  <option value="EMERGENCY">🚨 Emergency Outpass</option>
                  <option value="OTHER">📁 Other</option>
                </select>
              </div>
              
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 text-xs font-bold text-red-650 dark:text-red-400 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    name="isEmergency" 
                    checked={formData.isEmergency} 
                    onChange={handleChange} 
                    className="w-5 h-5 accent-red-650 rounded border-slate-200 dark:border-zinc-700" 
                  />
                  Mark as Emergency Request
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Reason for Request</label>
              <textarea 
                required 
                minLength={5} 
                name="reason" 
                value={formData.reason} 
                onChange={handleChange} 
                rows={3} 
                placeholder="Explain the specific reason for requesting this leave pass..." 
                className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Destination Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400"><MapPin size={16} /></span>
                  <input 
                    required 
                    type="text" 
                    name="destination" 
                    value={formData.destination} 
                    onChange={handleChange} 
                    placeholder="City, State" 
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 text-xs" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Emergency Contact Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400"><Phone size={16} /></span>
                  <input 
                    required 
                    type="tel" 
                    name="emergencyContact" 
                    value={formData.emergencyContact} 
                    onChange={handleChange} 
                    placeholder="+91 XXXXX XXXXX" 
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 text-xs" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Departure Date & Time</label>
                <div className="relative">
                  <input 
                    required 
                    type="datetime-local" 
                    name="departureDate" 
                    value={formData.departureDate} 
                    onChange={handleChange} 
                    className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 text-xs" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-zinc-400">Expected Return Date & Time</label>
                <div className="relative">
                  <input 
                    required 
                    type="datetime-local" 
                    name="expectedReturnDate" 
                    value={formData.expectedReturnDate} 
                    onChange={handleChange} 
                    className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 dark:bg-zinc-950 text-xs" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-black text-sm tracking-wide transition shadow-md select-none cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Submitting Outpass Request...
                  </>
                ) : 'Submit Outpass Request'}
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-3 font-semibold">
                Your outpass will be routed directly to your assigned Hostel Warden. QR clearance passes are generated automatically upon Warden approval.
              </p>
            </div>
          </form>
        </div>

        {/* Right Column: Dynamic Info Sidebar */}
        <div className="bg-slate-100 dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">Outpass Information</h4>
            <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800/80 flex items-start gap-2.5">
                <Clock className="text-blue-500 mt-0.5" size={16} />
                <div>
                  <strong className="font-extrabold text-slate-800 dark:text-zinc-200">1. Instant Status Sync</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">As soon as the warden processes your request, your status updates in real-time without reloading.</p>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800/80 flex items-start gap-2.5">
                <CheckCircle2 className="text-teal-500 mt-0.5" size={16} />
                <div>
                  <strong className="font-extrabold text-slate-800 dark:text-zinc-200">2. Gatehouse Terminals</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">Present your generated QR-code to security at the gatehouses during exits and returns.</p>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800/80 flex items-start gap-2.5">
                <ShieldAlert className="text-rose-500 mt-0.5" size={16} />
                <div>
                  <strong className="font-extrabold text-slate-800 dark:text-zinc-200">3. Emergency Priority</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">Marking as emergency flags the request in red on the warden's triage dashboard for speedier clearance.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider">Assigned Room</span>
            <div className="text-xl font-black text-blue-900 dark:text-blue-200 mt-1">
              Room {user?.room || 'Unassigned'}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Bed location: {user?.bedNumber || 'N/A'}</p>
          </div>
        </div>

      </div>

      {/* Middle Section: Active & Pending Leave Requests */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-850 pb-2">
          <Clock className="text-amber-600 dark:text-amber-400" size={18} />
          <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100">Active & Pending Outpasses</h3>
        </div>

        {loading ? (
          <div className="text-center p-12 text-slate-500 font-bold text-xs">
            <RefreshCw className="animate-spin inline-block mr-2 text-blue-500" size={18} />
            Loading active leave requests...
          </div>
        ) : activeLeaves.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs max-w-md mx-auto space-y-2">
            <div className="text-3xl">🗓️</div>
            <h4 className="font-extrabold text-sm text-slate-700 dark:text-zinc-300">No Active Leaves</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              You do not have any active or pending outpass clearances. Fill out the form above to submit a new leave request.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeLeaves.map((leave) => (
              <div key={leave._id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between">
                
                {/* Header Status Block */}
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 dark:text-zinc-200 text-xs uppercase">
                      {leave.leaveType.replace('_', ' ')}
                    </span>
                    {leave.isEmergency && (
                      <span className="bg-rose-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse select-none">
                        EMERGENCY
                      </span>
                    )}
                  </div>
                  {getStatusBadge(leave.status)}
                </div>

                {/* Details list */}
                <div className="p-4 flex-1 space-y-4">
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 uppercase font-black tracking-wider text-[8px] block">Destination & Reason</span>
                      <span className="text-slate-700 dark:text-zinc-200 font-semibold text-[11px] leading-tight block">
                        {leave.reason} &rarr; <em className="text-blue-600 dark:text-blue-400 not-italic font-black">{leave.destination}</em>
                      </span>
                    </div>
                    {leave.emergencyContact && (
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500 uppercase font-black tracking-wider text-[8px] block">Emergency Contact</span>
                        <span className="text-slate-700 dark:text-zinc-200 font-semibold text-[11px]">{leave.emergencyContact}</span>
                      </div>
                    )}
                  </div>

                  {/* Date range grid */}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px]">
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 uppercase font-black tracking-wider text-[8px] block mb-1">Departure Schedule</span>
                      <strong className="text-slate-800 dark:text-zinc-200 font-extrabold">{new Date(leave.departureDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-zinc-500 uppercase font-black tracking-wider text-[8px] block mb-1">Expected Return</span>
                      <strong className="text-slate-800 dark:text-zinc-200 font-extrabold">{new Date(leave.expectedReturnDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
                    </div>
                  </div>

                  {/* Actual gate exit triggers */}
                  {leave.exitedAt && (
                    <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/40 p-2.5 rounded-xl text-[10px] text-blue-800 dark:text-blue-400 flex justify-between">
                      <span className="font-extrabold uppercase tracking-wide">🚪 Gate Exit Logged</span>
                      <strong className="font-black">{new Date(leave.exitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                  )}

                  {/* QR Canvas Backing for PDF Pass downloads */}
                  <div className="hidden">
                    <QRCodeCanvas id={`qr-src-${leave._id}`} value={leave.qrToken || ''} size={256} level="H" />
                  </div>
                </div>

                {/* QR Access Footer (Only visible when approved or active exited) */}
                {(leave.status === 'APPROVED' || leave.status === 'EXITED') && leave.qrToken && (
                  <div className="px-4 pb-4 pt-3 bg-slate-50 dark:bg-zinc-950/40 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 select-none">
                      <div className="w-12 h-12 bg-white p-1 rounded-lg border flex items-center justify-center shadow-xs">
                        <QRCodeCanvas value={leave.qrToken} size={40} level="L" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider">
                          Secure Gatepass QR
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                          ID: {leave._id.slice(-8).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedPass(leave)}
                        className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Maximize2 size={12} /> View QR
                      </button>
                      <button
                        onClick={() => downloadPassCard(leave)}
                        className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Download size={12} /> Get Pass
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Leave History */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-850 pb-2">
          <History className="text-slate-650 dark:text-zinc-400" size={18} />
          <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100">Leave History & Logs</h3>
        </div>

        {loading ? (
          <div className="text-center p-12 text-slate-500 font-bold text-xs">
            <RefreshCw className="animate-spin inline-block mr-2 text-slate-500" size={18} />
            Loading historic outpasses...
          </div>
        ) : historicalLeaves.length === 0 ? (
          <div className="text-center p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs max-w-md mx-auto space-y-2">
            <div className="text-3xl">📚</div>
            <h4 className="font-extrabold text-sm text-slate-650 dark:text-zinc-400">No Historic Logs</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              You do not have any past completed or rejected outpasses on this portal yet.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                    <th className="p-4">Type</th>
                    <th className="p-4">Reason / Destination</th>
                    <th className="p-4">Schedule Dates</th>
                    <th className="p-4">Actual Logs</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                  {historicalLeaves.map((leave) => (
                    <tr key={leave._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/40 transition">
                      <td className="p-4 font-black text-slate-800 dark:text-zinc-200">
                        {leave.leaveType}
                        {leave.isEmergency && (
                          <span className="ml-1 bg-red-100 text-red-700 text-[8px] font-black px-1.5 py-0.5 rounded">EMT</span>
                        )}
                      </td>
                      <td className="p-4 max-w-xs">
                        <span className="block truncate text-slate-700 dark:text-zinc-300 font-semibold">{leave.reason}</span>
                        <span className="block text-[10px] text-slate-400">&rarr; {leave.destination}</span>
                      </td>
                      <td className="p-4 space-y-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
                        <div className="flex gap-1">
                          <span className="font-bold opacity-60">Out:</span>
                          <strong>{new Date(leave.departureDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="flex gap-1">
                          <span className="font-bold opacity-60">In:</span>
                          <strong>{new Date(leave.expectedReturnDate).toLocaleDateString()}</strong>
                        </div>
                      </td>
                      <td className="p-4 text-[10px]">
                        {leave.status === 'REJECTED' && leave.rejectionReason ? (
                          <span className="text-red-650 dark:text-red-400 font-semibold italic">Rejection Reason: {leave.rejectionReason}</span>
                        ) : (
                          <div className="space-y-0.5 text-slate-500">
                            {leave.exitedAt && (
                              <div><span className="opacity-60 uppercase font-black text-[8px]">Exited:</span> {new Date(leave.exitedAt).toLocaleDateString()}</div>
                            )}
                            {leave.returnedAt && (
                              <div><span className="opacity-60 uppercase font-black text-[8px]">Returned:</span> {new Date(leave.returnedAt).toLocaleDateString()}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {getStatusBadge(leave.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PASS MODAL WITH SCANNER VIEW ENHANCEMENTS */}
      {selectedPass && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition duration-150 ${
          highBrightness ? 'bg-white' : 'bg-slate-900/80 backdrop-blur-sm'
        }`}>
          
          {/* Modal Container */}
          <div className={`max-w-sm w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col justify-between ${
            highBrightness ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-slate-100'
          }`}>
            
            {/* Modal Header */}
            <div className={`p-4 flex justify-between items-center border-b ${
              highBrightness ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              <div>
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  🛡️ Gate Outpass Passcard
                </h3>
                <span className="text-[9px] uppercase font-mono tracking-wider opacity-60">
                  ID: {selectedPass._id.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedPass(null);
                  setHighBrightness(false);
                  setIsFullscreen(false);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {!isFullscreen && (
                <div className={`p-4 rounded-xl space-y-3 text-xs leading-relaxed ${
                  highBrightness ? 'bg-slate-50 text-slate-800' : 'bg-slate-900 text-slate-300'
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[8px] uppercase font-bold tracking-widest opacity-60 block">Hostel accommodation</span>
                      <strong className="font-extrabold text-[11px] text-slate-800 dark:text-zinc-200">{user?.hostelId?.name || 'Hostel'}</strong>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold tracking-widest opacity-60 block">Room allocation</span>
                      <strong className="font-extrabold text-[11px] text-slate-800 dark:text-zinc-200">{user?.room || 'Unassigned'}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/50 dark:border-zinc-800">
                    <div>
                      <span className="text-[8px] uppercase font-bold tracking-widest opacity-60 block">Departure</span>
                      <strong className="font-black text-[11px]">{new Date(selectedPass.departureDate).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold tracking-widest opacity-60 block">Expected Return</span>
                      <strong className="font-black text-[11px]">{new Date(selectedPass.expectedReturnDate).toLocaleDateString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Large QR Display */}
              <div className="flex flex-col items-center justify-center py-2 space-y-4">
                <div className={`p-3 rounded-2xl bg-white border flex items-center justify-center shadow-lg transition-transform ${
                  isFullscreen ? 'scale-110 my-4' : ''
                }`}>
                  <QRCodeCanvas value={selectedPass.qrToken} size={isFullscreen ? 200 : 160} level="H" includeMargin={true} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                    {selectedPass.leaveType} OUTPASS
                  </div>
                  <p className="text-[9px] opacity-60 mt-1 max-w-xs mx-auto px-4 font-semibold">
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
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                    highBrightness 
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Toggle high contrast backing for scanning machines"
                >
                  <Sun size={14} /> Contrast
                </button>
                
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                    isFullscreen 
                      ? 'bg-blue-100 text-blue-800 border-blue-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Maximize2 size={14} /> Size
                </button>
              </div>

              <button
                onClick={() => downloadPassCard(selectedPass)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Download size={14} /> Get PNG
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
