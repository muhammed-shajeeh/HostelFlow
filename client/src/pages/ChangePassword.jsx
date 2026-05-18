import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { Eye, EyeOff, ShieldAlert, KeyRound, Check } from 'lucide-react';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const getPasswordStrength = (pass) => {
    if (!pass) return { label: '', color: 'bg-slate-200 dark:bg-zinc-800 w-0', textClass: 'text-slate-400' };
    if (pass.length < 6) return { label: 'Too Short (Min 6 chars)', color: 'bg-rose-500 w-1/3', textClass: 'text-rose-500' };
    const hasNumbers = /\d/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    if (pass.length >= 8 && hasNumbers && hasSpecial) {
      return { label: 'Strong Security', color: 'bg-emerald-500 w-full', textClass: 'text-emerald-500' };
    }
    return { label: 'Medium Strength', color: 'bg-amber-500 w-2/3', textClass: 'text-amber-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await api.put('/parent/change-password', { newPassword });
      toast.success('Password updated successfully! Redirecting...');
      
      // Force silent logout to re-authenticate with new password cleanly
      setTimeout(() => {
        logout('silent');
        navigate('/');
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-[#f0f6fc] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      {/* Background ambient glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-6 bg-white dark:bg-[#161b22] p-8 md:p-10 rounded-3xl border border-slate-200 dark:border-[#30363d] shadow-xl z-10">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 mx-auto shadow-sm">
            <KeyRound className="w-7 h-7 stroke-[2]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Configure Credentials
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold leading-relaxed max-w-xs mx-auto">
            Hi <span className="text-slate-800 dark:text-slate-200 font-bold">{user?.fullName || 'Guardian'}</span>, for your security, you must update your temporary credentials before continuing to the operational dashboard.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* New Password field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-gray-450">
              New Secure Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl p-3.5 pr-10 text-slate-800 dark:text-white focus:outline-none focus:border-blue-650 transition placeholder:text-slate-400 dark:placeholder:text-gray-600 font-semibold text-sm"
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white transition cursor-pointer p-0.5"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Dynamic Password Strength Bar */}
            {newPassword && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                <div className="h-1 bg-slate-100 dark:bg-[#0d1117] rounded-full overflow-hidden flex">
                  <div className={`h-full transition-all duration-300 ${strength.color}`} />
                </div>
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-slate-400 dark:text-gray-500">Security Strength:</span>
                  <span className={strength.textClass}>{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-gray-450">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl p-3.5 pr-10 text-slate-800 dark:text-white focus:outline-none focus:border-blue-655 transition placeholder:text-slate-400 dark:placeholder:text-gray-600 font-semibold text-sm"
                placeholder="Re-type your secure password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white transition cursor-pointer p-0.5"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && newPassword === confirmPassword && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 animate-in fade-in duration-200 mt-1">
                <Check size={10} className="stroke-[3]" /> Passwords match
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-900/40 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 cursor-pointer text-xs"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating Credentials...
                </>
              ) : (
                'Save Password & Authenticate'
              )}
            </button>
          </div>
        </form>

        <div className="flex items-start gap-2 bg-slate-50 dark:bg-[#0d1117] p-3.5 rounded-2xl border border-slate-100 dark:border-[#30363d]/50 text-[10px] text-slate-500 dark:text-gray-400 font-semibold leading-relaxed">
          <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <span>Keep your password confidential. Once updated, you will be automatically redirected to re-authenticate using your new credentials.</span>
        </div>
      </div>
    </div>
  );
}
