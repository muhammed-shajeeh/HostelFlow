import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ArrowRight, Lock, LogOut, X, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

// High-fidelity vector SVG logo based exactly on visual reference
const HostelFlowLogo = ({ className = "w-6 h-6", color = "currentColor" }) => (
  <svg viewBox="0 0 100 100" className={className} fill={color}>
    {/* Roof */}
    <path d="M50,22 L16,46 L21,50 L50,29 L79,50 L84,46 Z" />
    {/* Chimney */}
    <path d="M68,26 L68,36 L74,41 L74,26 Z" />
    {/* Bedposts */}
    <rect x="25" y="45" width="6" height="36" rx="2" />
    <rect x="69" y="58" width="6" height="23" rx="2" />
    {/* Bed base frame */}
    <rect x="31" y="66" width="38" height="6" rx="2" />
    {/* Pillow */}
    <rect x="34" y="52" width="11" height="7" rx="2" />
    {/* Head circle */}
    <circle cx="39.5" cy="46" r="4.5" />
    {/* Mattress / Person body */}
    <rect x="47" y="52" width="21" height="9" rx="3.5" />
  </svg>
);

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const auth = useContext(AuthContext);
  const { login } = auth || {};
  const navigate = useNavigate();

  // Unified Multi-Stage Password Recovery State (Forgot Password Workflow)
  const [recoveryStage, setRecoveryStage] = useState(null); // null, 'email', 'otp', 'reset', 'success'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', formData);
      if (res.data.success) {
        if (login) login(res.data.token, res.data.user);
        toast.success(`Welcome back, ${res.data.user.fullName}!`);
        
        // Redirect based on role
        const roleRoutes = {
          ADMIN: '/admin',
          WARDEN: '/warden',
          STUDENT: '/student',
          PARENT: '/parent',
          SECURITY: '/security'
        };
        navigate(roleRoutes[res.data.user.role] || '/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Recovery - Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleStartRecovery = () => {
    setRecoveryStage('email');
    setRecoveryEmail('');
    setRecoveryOtp('');
    setRecoveryPassword('');
    setRecoveryConfirmPassword('');
    setResendCooldown(0);
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!recoveryEmail) return toast.error('Please enter your email address.');
    setRecoveryLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: recoveryEmail });
      if (res.data.success) {
        toast.success(res.data.message || 'OTP code sent to email.');
        setRecoveryStage('otp');
        setResendCooldown(60); // 60 seconds cooldown
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send verification code.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!recoveryOtp || recoveryOtp.trim().length !== 6) {
      return toast.error('Please enter the 6-digit verification code.');
    }
    setRecoveryLoading(true);
    try {
      const res = await api.post('/auth/verify-reset-otp', { email: recoveryEmail, otp: recoveryOtp });
      if (res.data.success) {
        toast.success(res.data.message || 'Verification successful.');
        setRecoveryStage('reset');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect verification code.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (recoveryPassword !== recoveryConfirmPassword) {
      return toast.error('Passwords do not match.');
    }
    if (recoveryPassword.length < 6) {
      return toast.error('Password must be at least 6 characters long.');
    }
    setRecoveryLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: recoveryEmail,
        otp: recoveryOtp,
        password: recoveryPassword,
        confirmPassword: recoveryConfirmPassword
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Password updated successfully.');
        setRecoveryStage('success');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Simple, friendly password strength check
  const getPasswordStrength = (pass) => {
    if (!pass) return { label: '', color: 'bg-slate-200 w-0', textClass: 'text-slate-400' };
    if (pass.length < 6) return { label: 'Too short', color: 'bg-red-500 w-1/3', textClass: 'text-red-500' };
    const hasNumbers = /\d/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    if (pass.length >= 8 && hasNumbers && hasSpecial) {
      return { label: 'Strong', color: 'bg-emerald-500 w-full', textClass: 'text-emerald-600' };
    }
    return { label: 'Medium', color: 'bg-amber-500 w-2/3', textClass: 'text-amber-500' };
  };

  const strength = getPasswordStrength(recoveryPassword);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      {/* Login Card */}
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-6 relative shadow-lg z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex w-12 h-12 rounded-xl bg-blue-50 items-center justify-center border border-blue-100 mx-auto transition hover:scale-105 duration-200">
            <HostelFlowLogo className="w-8 h-8 text-blue-600" />
          </Link>
          <span className="block font-black text-sm tracking-tight text-slate-900 mt-2">
            Hostel<span className="text-blue-600">Flow</span>
          </span>
        </div>

        {recoveryStage === null ? (
          /* STANDARD LOGIN VIEW */
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900 pt-1 uppercase tracking-wide">Login to HostelFlow</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">Sign in to access your administrative dashboard</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="e.g. resident@hostelflow.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                />
                
                {/* Forgot Password Action Trigger */}
                <div className="flex justify-between items-center text-[10px] mt-2">
                  <span />
                  <button
                    type="button"
                    onClick={handleStartRecovery}
                    className="text-blue-600 hover:underline font-extrabold cursor-pointer bg-transparent border-0 p-0"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
            </form>

            {/* Links */}
            <div className="text-center text-[10px] text-slate-500 pt-1">
              Are you a new resident student?{' '}
              <Link to="/register" className="text-blue-600 hover:underline">
                Create new resident account
              </Link>
            </div>
          </div>

        ) : recoveryStage === 'email' ? (
          /* PASSWORD RECOVERY STEP 1: ENTER EMAIL */
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900 pt-1 uppercase tracking-wide">Forgot Password?</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">Enter your email address to receive a secure recovery code</p>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  required
                  placeholder="e.g. resident@hostelflow.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
              >
                {recoveryLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>

              <button
                type="button"
                onClick={() => setRecoveryStage(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-750 py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
            </form>
          </div>

        ) : recoveryStage === 'otp' ? (
          /* PASSWORD RECOVERY STEP 2: VERIFY OTP */
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900 pt-1 uppercase tracking-wide">Verify Code</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-relaxed">
                We sent a 6-digit verification code to <span className="text-slate-900 font-bold">{recoveryEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Verification Code (OTP)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={recoveryOtp}
                  onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="e.g. 123456"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-bold text-center text-sm tracking-[0.2em]"
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>Didn't receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-bold text-slate-400">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    className="text-blue-650 hover:underline font-bold bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
              >
                {recoveryLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={() => setRecoveryStage('email')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-750 py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </form>
          </div>

        ) : recoveryStage === 'reset' ? (
          /* PASSWORD RECOVERY STEP 3: CREATE NEW PASSWORD */
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900 pt-1 uppercase tracking-wide">Reset Password</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">Create a secure new password for your account</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-750 p-0.5"
                  >
                    {showRecoveryPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {recoveryPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className={`h-full transition-all duration-300 ${strength.color}`} />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-slate-400">Strength:</span>
                      <span className={strength.textClass}>{strength.label}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showRecoveryConfirmPassword ? 'text' : 'password'}
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryConfirmPassword(!showRecoveryConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-750 p-0.5"
                  >
                    {showRecoveryConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
              >
                {recoveryLoading ? 'Updating...' : 'Reset Password'}
              </button>
            </form>
          </div>

        ) : (
          /* PASSWORD RECOVERY STEP 4: SUCCESS CONFIRMATION */
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100 mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8 stroke-[2]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">Password Updated</h3>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed max-w-xs mx-auto">
                Your security credentials have been successfully updated. You can now log in using your new password.
              </p>
            </div>

            <button
              onClick={() => setRecoveryStage(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
            >
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
