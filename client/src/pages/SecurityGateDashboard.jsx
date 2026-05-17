import { useState, useEffect, useRef, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { Shield, LogOut, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Lock, Delete } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

export default function SecurityGateDashboard() {
  const { user, token, login, logout } = useContext(AuthContext);

  // Verification Overlay & Scanner States
  const [verifying, setVerifying] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null); // { success, warning, action, studentName, roomNumber, message, time }
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualToken, setManualToken] = useState('');

  // Camera Status
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // PIN Login States
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('remember_gate_device') !== 'false');
  const [loginLoading, setLoginLoading] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0); // remaining seconds for terminal lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showPinMask, setShowPinMask] = useState(true);

  const qrCodeRef = useRef(null);
  const processingRef = useRef(false);
  const countdownIntervalRef = useRef(null);

  // Determine if terminal session is active
  const isSecuritySessionActive = token && user && user.role === 'SECURITY';

  // Lockout synchronization & timer tracking
  useEffect(() => {
    const savedLockExpiry = localStorage.getItem('terminal_lock_expiry');
    if (savedLockExpiry) {
      const remainingTime = Math.ceil((parseInt(savedLockExpiry) - Date.now()) / 1000);
      if (remainingTime > 0) {
        setLockCountdown(remainingTime);
      } else {
        localStorage.removeItem('terminal_lock_expiry');
      }
    }
  }, []);

  useEffect(() => {
    if (lockCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setLockCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            localStorage.removeItem('terminal_lock_expiry');
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [lockCountdown]);

  // Live Camera Scanner Auto-Start and Cleanup
  useEffect(() => {
    if (isSecuritySessionActive && !manualInputMode) {
      // Small timeout to guarantee element is fully rendered in the DOM before targeting
      const initTimeout = setTimeout(async () => {
        // Natively request permission before starting HTML5 QR Code to prevent camera blockages on physical devices
        if (Capacitor.isNativePlatform()) {
          try {
            const status = await Camera.checkPermissions();
            if (status.camera !== 'granted') {
              await Camera.requestPermissions({ permissions: ['camera'] });
            }
          } catch (permErr) {
            console.warn('[Camera Permission Request Failed]', permErr);
          }
        }

        const html5QrCode = new Html5Qrcode("reader");
        qrCodeRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            handleScan(decodedText);
          },
          (errorMessage) => {
            // ignore constant read failures
          }
        ).then(() => {
          setCameraActive(true);
          setCameraError(null);
        }).catch(err => {
          console.warn("Camera start failed:", err);
          setCameraActive(false);
          setCameraError("Camera access denied or unavailable.");
        });
      }, 100);

      return () => {
        clearTimeout(initTimeout);
        if (qrCodeRef.current) {
          if (qrCodeRef.current.isScanning) {
            qrCodeRef.current.stop().then(() => {
              qrCodeRef.current.clear();
            }).catch(err => console.error("Camera stop error:", err));
          }
        }
      };
    }
  }, [isSecuritySessionActive, manualInputMode]);

  // PIN submission for Gate Access
  const handlePinSubmit = async (enteredPin) => {
    const pinToSubmit = enteredPin || pin;
    if (pinToSubmit.length !== 6) {
      toast.error('PIN code must be exactly 6 digits.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await api.post('/auth/security-login', { pin: pinToSubmit });

      if (res.data.success) {
        localStorage.setItem('remember_gate_device', String(rememberMe));
        login(res.data.token, res.data.user);
        toast.success(`Gatehouse unlocked - ${res.data.user.fullName}`);
        setPin('');
        setFailedAttempts(0);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Access Denied: Invalid PIN.';
      toast.error(errMsg);
      setPin('');

      const nextFailCount = failedAttempts + 1;
      setFailedAttempts(nextFailCount);

      if (nextFailCount >= 5) {
        const lockoutDuration = 300; // 5 minutes
        const expiryTime = Date.now() + lockoutDuration * 1000;
        localStorage.setItem('terminal_lock_expiry', String(expiryTime));
        setLockCountdown(lockoutDuration);
        toast.error('Too many failed attempts. Keypad locked for 5 minutes.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Numeric Keypad handlers
  const handleKeypadPress = (num) => {
    if (lockCountdown > 0) return;
    if (pin.length >= 6) return;
    
    const newPin = pin + num;
    setPin(newPin);
    
    if (newPin.length === 6) {
      setTimeout(() => {
        handlePinSubmit(newPin);
      }, 150);
    }
  };

  const handleBackspace = () => {
    if (lockCountdown > 0) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockCountdown > 0) return;
    setPin('');
  };

  // QR verification logic
  const handleScan = async (scannedToken) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setVerifying(true);

    try {
      const res = await api.post('/leaves/verify-qr', { qrToken: scannedToken });
      
      if (res.data.success) {
        const studentInfo = res.data.student || {};
        const successResult = {
          success: true,
          warning: false,
          action: res.data.action,
          studentName: typeof studentInfo === 'string' ? studentInfo : studentInfo.fullName,
          roomNumber: studentInfo.roomNumber || 'Unassigned',
          message: res.data.message || 'Verification Successful',
          time: new Date().toLocaleTimeString()
        };
        setLastScanResult(successResult);
        toast.success(`${successResult.action === 'EXIT' ? 'Exit Authorized' : 'Return Authorized'} - ${successResult.studentName}`);
      }
    } catch (error) {
      const errData = error.response?.data || {};
      
      if (errData.warningType === 'DUPLICATE') {
        const warnResult = {
          success: false,
          warning: true,
          message: errData.message || 'Duplicate Scan: Token already used.',
          time: new Date().toLocaleTimeString()
        };
        setLastScanResult(warnResult);
        toast(warnResult.message, { icon: '⚠️' });
      } else {
        const errorResult = {
          success: false,
          warning: false,
          message: errData.message || 'Invalid or Expired QR Pass',
          time: new Date().toLocaleTimeString()
        };
        setLastScanResult(errorResult);
        toast.error(errorResult.message);
      }
    } finally {
      setVerifying(false);
      // Auto-reset back to camera scanner after 2.5 seconds
      setTimeout(() => {
        setLastScanResult(null);
        processingRef.current = false;
      }, 2500);
    }
  };

  const handleLogout = () => {
    logout();
    setLastScanResult(null);
  };

  const formatCountdownTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ==========================================
  // VIEW 1: Direct PIN Keypad entrance portal
  // ==========================================
  if (!isSecuritySessionActive) {
    const hasAnotherRoleActive = token && user;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,83,75,0.18),transparent)] pointer-events-none"></div>

        {hasAnotherRoleActive ? (
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <Shield size={36} />
            </div>
            <h2 className="text-xl font-black uppercase text-white tracking-wide">
              Active User Session Detected
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              You are currently logged in as an active <strong>{user.role}</strong> ({user.fullName}).
              To initiate a shared gatehouse terminal session, you must disconnect this active session first.
            </p>
            <button
              onClick={() => { logout(); }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest transition animate-in fade-in"
            >
              Disconnect Session
            </button>
          </div>
        ) : (
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500"></div>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/30 rounded-2xl flex items-center justify-center mx-auto text-teal-400 mb-2">
                <Shield size={24} className="animate-pulse" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">
                Hostel Gatehouse
              </h2>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Smart Hostel Shared Terminal
              </p>
            </div>

            <div className="space-y-2 relative">
              <label className="block text-[9px] font-black text-teal-400 uppercase tracking-widest pl-1 text-center">
                Enter 6-Digit Gate Access PIN
              </label>

              {lockCountdown > 0 ? (
                <div className="flex flex-col items-center justify-center bg-rose-950/20 border border-rose-500/20 py-4 rounded-2xl text-center space-y-2 animate-pulse">
                  <Lock className="text-rose-500" size={24} />
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">
                    Terminal Locked
                  </span>
                  <span className="text-2xl font-mono font-black text-rose-500">
                    {formatCountdownTime(lockCountdown)}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 flex items-center justify-center gap-3 h-16">
                    {[...Array(6)].map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-100 ${
                          idx < pin.length
                            ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)] scale-110'
                            : 'bg-slate-800'
                        }`}
                      ></span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPinMask(!showPinMask)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-wider pl-2"
                  >
                    {showPinMask ? 'Reveal' : 'Mask'}
                  </button>
                  
                  {!showPinMask && pin.length > 0 && (
                    <div className="text-center text-xs font-mono font-bold tracking-widest text-teal-400 mt-2">
                      {pin}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(String(num))}
                  className="w-14 h-14 bg-slate-950 border border-slate-800 hover:border-slate-700 active:bg-teal-500 active:text-slate-950 font-black rounded-full flex items-center justify-center text-md transition duration-100 select-none shadow-sm hover:scale-[1.04]"
                  disabled={lockCountdown > 0}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="w-14 h-14 bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-400 rounded-full flex items-center justify-center uppercase select-none transition hover:border-slate-700 hover:scale-[1.04]"
                disabled={lockCountdown > 0}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="w-14 h-14 bg-slate-950 border border-slate-800 hover:border-slate-700 active:bg-teal-500 active:text-slate-950 font-black rounded-full flex items-center justify-center text-md transition duration-100 select-none shadow-sm hover:scale-[1.04]"
                disabled={lockCountdown > 0}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="w-14 h-14 bg-slate-950 border border-slate-800 text-slate-400 rounded-full flex items-center justify-center select-none transition hover:border-slate-700 hover:scale-[1.04]"
                disabled={lockCountdown > 0}
              >
                <Delete size={18} />
              </button>
            </div>

            <div className="flex justify-between items-center px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-teal-500 focus:ring-0 cursor-pointer"
                />
                Persist Session
              </label>
              <span>{pin.length}/6 digits</span>
            </div>

            <button
              onClick={() => handlePinSubmit()}
              disabled={loginLoading || lockCountdown > 0 || pin.length !== 6}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg transition duration-100 hover:shadow-teal-500/10 active:scale-[0.98]"
            >
              {loginLoading ? 'Unlocking Scanner...' : 'Unlock Gate Scanner'}
            </button>
          </div>
        )}

        <div className="text-center mt-12 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          Smart Hostel ERP • Single Shared Terminal Access
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Fullscreen dedicated QR reader
  // ==========================================
  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden z-50">
      
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center z-20">
        <div>
          <h1 className="text-sm font-black tracking-widest uppercase text-teal-400">
            {user?.hostelId?.name || 'Assigned Hostel'}
          </h1>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
            GATE SCANNER TERMINAL
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
        >
          <LogOut size={14} /> Lock Terminal
        </button>
      </header>

      {/* Main Scanner viewport */}
      <main className="flex-1 flex flex-col justify-center items-center relative z-10 p-4">
        
        {/* Connection status overlay */}
        <div className="absolute top-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 border px-3 py-1 rounded-full flex items-center gap-1.5 z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
          Terminal Active & Listening
        </div>

        {!manualInputMode ? (
          <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 flex flex-col items-center gap-4 relative overflow-hidden shadow-2xl">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-slate-800">
              <div id="reader" className="w-full h-full"></div>
              
              {/* Scan box visual assistant */}
              {cameraActive && !lastScanResult && (
                <div className="absolute inset-0 border-[3px] border-teal-500/30 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-dashed border-teal-400 rounded-2xl relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-lg"></div>
                  </div>
                </div>
              )}

              {/* Action verifying loader overlay */}
              {verifying && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-teal-400" size={36} />
                  <span className="text-[10px] font-black uppercase text-teal-400 tracking-widest animate-pulse">Verifying Pass QR...</span>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="text-center text-xs text-rose-400 font-bold bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl w-full">
                ⚠️ {cameraError}
              </div>
            )}

            {!cameraActive && !cameraError && (
              <div className="text-center text-xs text-slate-400 font-bold py-4">
                Starting Gate Camera feed...
              </div>
            )}
          </div>
        ) : (
          /* Manual token input fallback */
          <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
            <h2 className="text-xs font-black text-teal-400 uppercase tracking-widest text-center">
              Manual Token Entry
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleScan(manualToken); setManualToken(''); }} className="space-y-4">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Enter 24-char QR Token manually..."
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 focus:outline-none px-4 py-4 rounded-xl text-center text-sm font-mono tracking-widest text-white"
                disabled={verifying}
              />
              <button
                type="submit"
                disabled={verifying || !manualToken.trim()}
                className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest transition"
              >
                {verifying ? 'Verifying...' : 'Verify Token'}
              </button>
            </form>
          </div>
        )}

        {/* Scan Result Feedback Giant Fullscreen Overlay */}
        {lastScanResult && (
          <div className={`fixed inset-0 z-30 flex flex-col items-center justify-center p-6 transition duration-200 animate-in fade-in ${
            lastScanResult.success 
              ? 'bg-emerald-950 text-emerald-100' 
              : lastScanResult.warning 
                ? 'bg-amber-950 text-amber-100' 
                : 'bg-rose-950 text-rose-100'
          }`}>
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
              {lastScanResult.success ? (
                <CheckCircle2 className={lastScanResult.action === 'EXIT' ? 'text-emerald-400' : 'text-cyan-400'} size={64} />
              ) : lastScanResult.warning ? (
                <AlertTriangle className="text-amber-400" size={64} />
              ) : (
                <XCircle className="text-rose-400" size={64} />
              )}
            </div>

            <span className={`text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-2 ${
              lastScanResult.success 
                ? 'bg-white/10 text-white' 
                : lastScanResult.warning 
                  ? 'bg-amber-500/25 text-amber-300' 
                  : 'bg-rose-500/25 text-rose-300'
            }`}>
              {lastScanResult.success 
                ? (lastScanResult.action === 'EXIT' ? 'EXIT AUTHORIZED (GREEN)' : 'RETURN LOGGED (GREEN)') 
                : lastScanResult.warning 
                  ? 'DUPLICATE / ALREADY LOGGED (YELLOW)' 
                  : 'BLOCKED / INVALID PASS (RED)'}
            </span>

            <h2 className="text-4xl font-black text-center text-white tracking-tight leading-none my-4">
              {lastScanResult.success ? lastScanResult.studentName : 'VERIFICATION FAILED'}
            </h2>

            {lastScanResult.success && (
              <div className="space-y-1 text-center font-bold mb-4">
                <p className="text-lg opacity-90">Room {lastScanResult.roomNumber}</p>
                <p className="text-xs opacity-60 uppercase tracking-widest">{user?.hostelId?.name}</p>
              </div>
            )}

            <p className="text-sm font-semibold opacity-90 text-center max-w-md px-4 leading-relaxed mt-2">
              {lastScanResult.message}
            </p>

            <span className="text-[10px] font-bold opacity-45 font-mono uppercase mt-6">
              {lastScanResult.time} • Auto-Resetting...
            </span>
          </div>
        )}
      </main>

      {/* Bottom Bar */}
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex justify-between items-center z-20">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          SYSTEM STATUS: ONLINE
        </span>
        <button
          onClick={() => setManualInputMode(!manualInputMode)}
          className="text-[10px] font-black text-teal-400 hover:text-teal-300 uppercase tracking-widest transition"
        >
          {manualInputMode ? 'Switch to Camera' : 'Manual Entry'}
        </button>
      </footer>
    </div>
  );
}
