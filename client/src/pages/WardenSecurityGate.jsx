import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, Key, Power, RefreshCw, Eye, EyeOff, Lock, Unlock, Sparkles, Clock, AlertTriangle, ArrowRightLeft } from 'lucide-react';

export default function WardenSecurityGate() {
  const { user } = useContext(AuthContext);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form States
  const [customPin, setCustomPin] = useState('');
  const [revealedRandomPin, setRevealedRandomPin] = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const res = await api.get('/security-gate/accounts');
      // Retrieve the single auto-initialized security gate account
      setAccount(res.data.account || res.data.accounts?.[0] || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load security configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCustomPin = async (e) => {
    e.preventDefault();
    if (!account) return;
    
    const cleanPin = String(customPin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      toast.error('PIN must be exactly 6 numeric digits.');
      return;
    }

    setUpdatingPin(true);
    try {
      const res = await api.put(`/security-gate/accounts/${account._id}/reset-password`, {
        pin: cleanPin
      });
      toast.success(res.data.message);
      setCustomPin('');
      setRevealedRandomPin('');
      fetchAccount();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update PIN.');
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleGenerateRandomPin = async () => {
    if (!account) return;
    setUpdatingPin(true);
    try {
      const res = await api.put(`/security-gate/accounts/${account._id}/reset-password`, {
        generateRandom: true
      });
      toast.success(res.data.message);
      if (res.data.randomPin) {
        setRevealedRandomPin(res.data.randomPin);
      }
      setCustomPin('');
      fetchAccount();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate PIN.');
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!account) return;
    const nextState = !account.isActive;
    if (!window.confirm(`Are you sure you want to ${nextState ? 'ENABLE' : 'DISABLE'} Security Gate access for this hostel?`)) {
      return;
    }

    try {
      const res = await api.put(`/security-gate/accounts/${account._id}/toggle-status`);
      toast.success(res.data.message);
      fetchAccount();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleNumericInput = (val) => {
    const cleanVal = val.replace(/\D/g, '').slice(0, 6);
    setCustomPin(cleanVal);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="animate-spin text-teal-600" size={32} />
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
          Loading Security Gatehouse configuration...
        </p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4">
        <ShieldAlert className="mx-auto text-rose-500" size={48} />
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">
          Security Terminal Initialization Error
        </h3>
        <p className="text-sm text-slate-500">
          We were unable to locate or automatically initialize a gatehouse terminal for your assigned hostel. Please verify your hostel assignment or contact the system administrator.
        </p>
        <button
          onClick={fetchAccount}
          className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-xl transition hover:bg-slate-800"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const isLockedOut = account.loginLockUntil && new Date() < new Date(account.loginLockUntil);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 font-sans text-slate-800">
      
      {/* Premium Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-teal-800 to-cyan-900 p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            🛡️ Shared Gatehouse Terminal Settings
          </h2>
          <p className="text-teal-100 text-sm mt-2 max-w-2xl">
            Configure the 6-digit access PIN and view active scan metrics for the gatekeepers at <strong>{account.hostelId?.name || 'Your Assigned Hostel'}</strong>.
          </p>
        </div>
        <button
          onClick={fetchAccount}
          className="relative z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition shadow-inner flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
          title="Refresh statistics"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Security Control Panel */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Main settings card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
            
            {/* Status section */}
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Gatehouse Access State
                </h3>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold mt-1.5 uppercase ${
                  account.isActive ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    account.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}></span>
                  {account.isActive ? 'Active Terminal Enabled' : 'Terminal Access Disabled'}
                </span>
              </div>
              <button
                onClick={handleToggleStatus}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition shadow flex items-center gap-2 ${
                  account.isActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                <Power size={14} /> {account.isActive ? 'Disable Gate' : 'Enable Gate'}
              </button>
            </div>

            {/* PIN Configuration form */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Configure 6-Digit Gate PIN
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Enter a new 6-digit numeric passkey for the shared terminal device. PINs are securely encrypted and must be globally unique to identify your hostel.
                </p>
              </div>

              <form onSubmit={handleSetCustomPin} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    pattern="\d*"
                    value={customPin}
                    onChange={(e) => handleNumericInput(e.target.value)}
                    placeholder="Enter 6-Digit PIN (e.g. 582194)..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-teal-500 rounded-xl font-mono text-sm tracking-widest text-slate-800 shadow-inner"
                    disabled={updatingPin}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                    {customPin.length}/6
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={updatingPin || customPin.length !== 6}
                  className="px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl transition text-xs font-black uppercase tracking-wider"
                >
                  Save PIN
                </button>
              </form>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateRandomPin}
                  disabled={updatingPin}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 shadow"
                >
                  <Sparkles size={14} className="text-teal-400" /> Generate Random 6-Digit PIN
                </button>

                {revealedRandomPin && (
                  <div className="bg-teal-50 border border-teal-200/60 p-4 rounded-2xl text-center space-y-1">
                    <span className="text-[10px] font-black text-teal-700 uppercase tracking-widest block">
                      New Generated Passkey
                    </span>
                    <span className="text-2xl font-mono font-black text-teal-900 tracking-widest block">
                      {revealedRandomPin}
                    </span>
                    <p className="text-[9px] text-teal-600 leading-relaxed max-w-sm mx-auto">
                      Write this down or share it with the hostel guards. They will type this exactly on the keypad at <strong className="font-extrabold">/security</strong>.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

        {/* Right Column: Terminal Metrics */}
        <div className="md:col-span-5 space-y-6">
          
          {/* Metrics card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <h3 className="text-xs font-black text-teal-400 uppercase tracking-widest pb-3 border-b border-white/5">
              Live Terminal Status
            </h3>

            {/* Locked out warning state */}
            {isLockedOut ? (
              <div className="bg-rose-950/30 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
                <AlertTriangle className="text-rose-400 shrink-0" size={20} />
                <div>
                  <span className="text-xs font-black text-rose-400 uppercase tracking-wider block">
                    Brute-Force Lockout Active
                  </span>
                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                    Gatehouse device login is blocked due to excessive wrong entries. Locks will automatically release at: <strong className="font-extrabold">{new Date(account.loginLockUntil).toLocaleTimeString()}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-2xl flex items-start gap-3">
                <Unlock className="text-emerald-400 shrink-0 animate-pulse" size={20} />
                <div>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                    Terminal Secured
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Access is fully unlocked and ready to synchronize gate logs. Keepers can access via the PIN keypad.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <ArrowRightLeft size={10} className="text-teal-400" /> Today's Scans
                </span>
                <span className="text-2xl font-black text-white mt-3 font-mono">
                  {account.todayScanCount}
                </span>
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} className="text-teal-400" /> Shift Logins
                </span>
                <span className="text-2xl font-black text-white mt-3 font-mono">
                  {account.securityLoginCount}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-[11px] text-slate-400 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="font-medium">Active Device Connection:</span>
                <span className="font-mono text-slate-200 font-bold">
                  {account.lastSecurityLogin
                    ? new Date(account.lastSecurityLogin).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                    : 'Never Connected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Security Account ID:</span>
                <span className="font-mono text-[9px] text-slate-500 font-bold">
                  {account._id}
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
