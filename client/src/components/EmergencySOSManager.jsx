import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../api';
import toast from 'react-hot-toast';
import { ShieldAlert, Volume2, VolumeX, CheckCircle, Clock, X, HelpCircle } from 'lucide-react';

export default function EmergencySOSManager() {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();

  // Cooldown rate limit state (in seconds)
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Student Confirm Modal State
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  // Active Alerts List (for Wardens, Security, Admins)
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  // Web Audio Context refs
  const audioCtxRef = useRef(null);
  const sirenIntervalRef = useRef(null);

  // ────────────────────────────────────────────────────────
  // 1. Client-Side 2-Minute Cooldown Timer
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.role === 'STUDENT') {
      const checkCooldown = () => {
        const lastSent = localStorage.getItem('sos_last_triggered');
        if (lastSent) {
          const elapsed = Date.now() - parseInt(lastSent, 10);
          const remaining = Math.max(0, Math.ceil((2 * 60 * 1000 - elapsed) / 1000));
          setCooldownLeft(remaining);
        } else {
          setCooldownLeft(0);
        }
      };

      checkCooldown();
      const interval = setInterval(checkCooldown, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // ────────────────────────────────────────────────────────
  // 2. Fetch Active Alerts on Mount (Wardens/Security/Admins)
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && (user.role === 'WARDEN' || user.role === 'SECURITY' || user.role === 'ADMIN')) {
      const fetchActiveAlerts = async () => {
        try {
          const res = await api.get('/emergency/alerts/active');
          if (res.data.success && res.data.alerts) {
            setActiveAlerts(res.data.alerts);
          }
        } catch (err) {
          console.warn('[SOS Manager] Failed to fetch active alerts list', err);
        }
      };

      fetchActiveAlerts();
    }
  }, [user]);

  // ────────────────────────────────────────────────────────
  // 3. Socket.IO Real-time SOS Trigger Observers
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user) return;

    // Wardens, Security terminals, and Admins handle active alerts & sirens
    const isAuthority = user.role === 'WARDEN' || user.role === 'SECURITY' || user.role === 'ADMIN';

    const handleNewAlert = (alert) => {
      if (isAuthority) {
        // Double-check isolated hostel eligibility (Admin can see all, others only see their hostel)
        if (user.role === 'ADMIN' || (user.hostelId && alert.hostelId?._id === user.hostelId)) {
          setActiveAlerts((prev) => {
            if (prev.some((a) => a._id === alert._id)) return prev;
            return [alert, ...prev];
          });

          // Play toast notification with premium emergency icon styling
          toast.error(`🚨 EMERGENCY SOS TRIGGERED: Room ${alert.roomId?.roomNumber || 'N/A'} - ${alert.studentId?.fullName}`, {
            duration: 8000,
            style: {
              background: '#991b1b',
              color: '#ffffff',
              fontWeight: '900',
              border: '1px solid #ef4444',
            },
          });
        }
      }
    };

    const handleResolvedAlert = (data) => {
      if (isAuthority) {
        setActiveAlerts((prev) => prev.filter((a) => a._id !== data.alertId));
        toast.success(`✅ Emergency Alert Marked Resolved by ${data.resolvedBy}`, {
          duration: 5000,
        });
      }
    };

    socket.on('EMERGENCY_ALERT', handleNewAlert);
    socket.on('EMERGENCY_RESOLVED', handleResolvedAlert);

    return () => {
      socket.off('EMERGENCY_ALERT', handleNewAlert);
      socket.off('EMERGENCY_RESOLVED', handleResolvedAlert);
    };
  }, [socket, user]);

  // ────────────────────────────────────────────────────────
  // 4. Web Audio Siren Synthesizer Loop Engine
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    const shouldPlaySiren = activeAlerts.length > 0 && !isMuted;

    if (shouldPlaySiren) {
      if (!sirenIntervalRef.current) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
            
            // Loop alternating siren audio sweeps
            sirenIntervalRef.current = setInterval(() => {
              const audioCtx = audioCtxRef.current;
              if (!audioCtx) return;

              const time = audioCtx.currentTime;
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();

              // Urgency siren synthesis
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(880, time); // A5 High siren tone
              osc.frequency.linearRampToValueAtTime(587, time + 0.4); // Linear sweep down to D5 pitch

              gain.gain.setValueAtTime(0.08, time);
              gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

              osc.connect(gain);
              gain.connect(audioCtx.destination);

              osc.start(time);
              osc.stop(time + 0.4);
            }, 500);
          }
        } catch (err) {
          console.warn('[SOS Alarm engine] Audio context initialisation blocked', err);
        }
      }
    } else {
      // Cleanup / halt loops instantly
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
        audioCtxRef.current = null;
      }
    };
  }, [activeAlerts, isMuted]);

  // ────────────────────────────────────────────────────────
  // 5. Student SOS Trigger & Network Communication Handler
  // ────────────────────────────────────────────────────────
  const triggerStudentSOS = async () => {
    // 2-minute cooldown rate-limit validation
    const lastSent = localStorage.getItem('sos_last_triggered');
    if (lastSent && Date.now() - parseInt(lastSent, 10) < 2 * 60 * 1000) {
      toast.error('Emergency alert already sent within the last 2 minutes. Please wait before triggering another one.', {
        icon: '⚠️',
      });
      return;
    }

    setSendingAlert(true);
    try {
      const res = await api.post('/emergency/alert');
      if (res.data.success) {
        // Record timestamp in local storage
        localStorage.setItem('sos_last_triggered', Date.now().toString());
        toast.success('Emergency alert sent successfully to hostel authorities.', {
          duration: 6000,
          icon: '🚨',
        });
        setShowConfirm(false);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to dispatch SOS alert. Please try again.';
      toast.error(msg);
    } finally {
      setSendingAlert(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // 6. Warden SOS Alert Resolution Communication Handler
  // ────────────────────────────────────────────────────────
  const resolveSOSAlert = async (alertId) => {
    try {
      const res = await api.put(`/emergency/alerts/${alertId}/resolve`);
      if (res.data.success) {
        setActiveAlerts((prev) => prev.filter((a) => a._id !== alertId));
        toast.success('Active emergency alert has been successfully resolved.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve emergency alert.');
    }
  };

  // ==========================================
  // VIEW: 1. STUDENT VIEWPORT FLOATING BUTTON
  // ==========================================
  if (user && user.role === 'STUDENT') {
    return (
      <>
        {/* Floating circular red emergency action button */}
        <button
          onClick={() => setShowConfirm(true)}
          className={`fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition duration-300 transform hover:scale-110 active:scale-95 cursor-pointer ${
            cooldownLeft > 0
              ? 'bg-zinc-650 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 animate-pulse ring-4 ring-red-500/30'
          }`}
          title={cooldownLeft > 0 ? `SOS Cooldown: ${cooldownLeft}s` : 'Trigger Emergency SOS'}
        >
          {cooldownLeft > 0 ? (
            <span className="text-xs font-black font-mono">{cooldownLeft}s</span>
          ) : (
            <ShieldAlert size={26} className="animate-bounce" />
          )}
        </button>

        {/* Mandatory UX Confirmation Dialogue Modal overlay */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex justify-center items-center z-[150] p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in scale-in duration-200">
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30 rounded-2xl flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                  <HelpCircle size={28} />
                </div>
                
                <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100">
                  Emergency Alert
                </h3>
                
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 leading-relaxed px-2">
                  Are you sure you want to send an emergency alert to hostel authorities?
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={sendingAlert}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={triggerStudentSOS}
                    disabled={sendingAlert}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg hover:shadow-red-600/10 transition cursor-pointer"
                  >
                    {sendingAlert ? 'Sending...' : 'Send Alert'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ==========================================
  // VIEW: 2. WARDEN, SECURITY & ADMIN PANEL POPUPS
  // ==========================================
  const isAuthority = user && (user.role === 'WARDEN' || user.role === 'SECURITY' || user.role === 'ADMIN');
  if (isAuthority && activeAlerts.length > 0) {
    const primaryAlert = activeAlerts[0]; // Display the most recent active emergency alert prominently

    return (
      <div className="fixed inset-0 bg-red-950/95 backdrop-blur-md flex flex-col justify-center items-center p-6 z-[9999] animate-in fade-in duration-200 overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.18),transparent)] pointer-events-none"></div>

        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border-2 border-red-500 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Accent blinking top warning line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600 animate-pulse"></div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 border border-red-300 rounded-2xl flex items-center justify-center mx-auto text-red-600 dark:text-red-400 relative">
              <ShieldAlert size={36} className="animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-650"></span>
              </span>
            </div>
            
            <h2 className="text-xl font-black uppercase text-red-600 tracking-wider">
              🚨 ACTIVE EMERGENCY ALERT
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
              Smart Hostel Realtime ERP
            </p>
          </div>

          {/* Student Profile Specs Grid */}
          <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-zinc-800 pb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400">Student</span>
              <span className="text-xs font-black text-slate-800 dark:text-zinc-100">{primaryAlert.studentId?.fullName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-zinc-800 pb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400">Admission No</span>
              <span className="text-xs font-black text-slate-800 dark:text-zinc-100">{primaryAlert.studentId?.admissionNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-zinc-800 pb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400">Hostel</span>
              <span className="text-xs font-black text-slate-800 dark:text-zinc-100">{primaryAlert.hostelId?.name || 'Assigned'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-zinc-800 pb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400">Room / Bed</span>
              <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono">
                Room {primaryAlert.roomId?.roomNumber || 'N/A'} / Bed {primaryAlert.studentId?.bedNumber || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400 text-left">Time Sent</span>
              <span className="text-xs font-black text-slate-800 dark:text-zinc-100 text-right flex items-center gap-1">
                <Clock size={12} className="text-blue-500" />
                {new Date(primaryAlert.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Interactive control buttons */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center justify-center gap-2 cursor-pointer transition select-none ${
                  isMuted
                    ? 'bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-750 text-slate-700 dark:text-zinc-300'
                    : 'bg-amber-500/10 hover:bg-amber-500/25 border-amber-500/30 text-amber-500 dark:text-amber-400'
                }`}
              >
                {isMuted ? (
                  <>
                    <Volume2 size={16} /> Unmute Siren
                  </>
                ) : (
                  <>
                    <VolumeX size={16} /> Mute Siren
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => resolveSOSAlert(primaryAlert._id)}
                className="py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white border border-red-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-red-600/15"
              >
                <CheckCircle size={16} /> Mark Resolved
              </button>
            </div>

            {/* Queue Counter if multiple emergencies occur */}
            {activeAlerts.length > 1 && (
              <div className="text-center text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                ⚠️ QUEUE WARNING: {activeAlerts.length - 1} other active emergency alert(s) pending.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
