import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { 
  ShieldCheck, 
  GraduationCap, 
  Users, 
  User, 
  CreditCard, 
  Building2, 
  FileText, 
  ArrowRight, 
  LogOut, 
  Menu, 
  X,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

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

// High-fidelity brown and blue wooden bed illustration matching the user's sketch exactly
const CenterBedIllustration = () => (
  <svg viewBox="0 0 100 60" className="w-16 h-10 sm:w-20 sm:h-12" fill="none">
    {/* Wooden Bed Headboard & Posts */}
    <rect x="5" y="5" width="6" height="50" rx="2" fill="#b45309" /> {/* Left post */}
    <rect x="89" y="25" width="6" height="30" rx="2" fill="#b45309" /> {/* Right post */}
    <rect x="11" y="32" width="78" height="6" rx="1.5" fill="#b45309" /> {/* Frame */}
    
    {/* Pillow */}
    <rect x="13" y="22" width="18" height="9" rx="2" fill="#cbd5e1" />
    <rect x="14" y="23" width="16" height="7" rx="1.5" fill="#e2e8f0" />
    
    {/* Blue Mattress / Blanket */}
    <rect x="31" y="25" width="58" height="13" rx="2.5" fill="#1d4ed8" />
    <rect x="31" y="25" width="58" height="6" rx="1" fill="#3b82f6" />
    <rect x="11" y="28" width="20" height="10" rx="2" fill="#60a5fa" />
  </svg>
);

export default function Landing() {
  const auth = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const { user, login, logout } = auth || {};
  const navigate = useNavigate();

  // Authentication Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' or 'signup'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', formData);
      if (res.data.success) {
        login(res.data.token, res.data.user);
        toast.success(`Welcome back, ${res.data.user.fullName}!`);
        setIsAuthModalOpen(false);
        
        // Direct route redirect based on role
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

  const handleLogout = () => {
    if (logout) logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const getDashboardRoute = () => {
    if (!user) return '/';
    const roleRoutes = {
      ADMIN: '/admin',
      WARDEN: '/warden',
      STUDENT: '/student',
      PARENT: '/parent',
      SECURITY: '/security'
    };
    return roleRoutes[user.role] || '/';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Symmetrical single-orbit ecosystem nodes aligned in proper circular order (7 labels evenly distributed)
  const ecosystemNodes = [
    { label: 'Warden Staff', icon: User, radius: 170, angle: 0, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { label: 'Forms & Records', icon: FileText, radius: 170, angle: 51.4, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { label: 'Payments', icon: CreditCard, radius: 170, angle: 102.9, color: 'text-cyan-500 bg-cyan-50 border-cyan-100' },
    { label: 'University Admin', icon: Building2, radius: 170, angle: 154.3, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { label: 'Security', icon: ShieldCheck, radius: 170, angle: 205.7, color: 'text-slate-700 bg-slate-100 border-slate-200' },
    { label: 'Parents', icon: Users, radius: 170, angle: 257.1, color: 'text-rose-500 bg-rose-50 border-rose-150' },
    { label: 'Students', icon: GraduationCap, radius: 170, angle: 308.6, color: 'text-slate-800 bg-slate-100 border-slate-200' },
  ];

  const isDarkMode = 
    theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleToggleTheme = () => {
    toggleTheme(isDarkMode ? 'light' : 'dark');
  };

  const renderSharedAuthModal = () => {
    if (!isAuthModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] text-slate-900 dark:text-[#f0f6fc] rounded-2xl max-w-sm w-full p-6 space-y-6 relative shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
          
          {/* Modal Exit */}
          <button
            onClick={() => { setIsAuthModalOpen(false); setRecoveryStage(null); }}
            className="absolute top-4 right-4 p-1.5 text-slate-450 dark:text-gray-400 hover:text-slate-750 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>

          {recoveryStage === null ? (
            <>
              {/* Logo & Identity */}
              <div className="text-center space-y-2 pt-1">
                <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto" />
                <span className="block font-extrabold text-lg tracking-tight text-slate-900 dark:text-white mt-2 select-none">
                  Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white pt-1 uppercase tracking-wide">
                  {authTab === 'login' ? 'Login to HostelFlow' : 'Sign Up'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">
                  {authTab === 'login' 
                    ? 'Sign in to access your administrative dashboard' 
                    : 'Register a new account on HostelFlow'
                  }
                </p>
              </div>

              {/* Modal Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#0d1117] border border-transparent dark:border-[#30363d] rounded-lg text-xs font-bold">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`py-2 text-center rounded-md transition select-none cursor-pointer ${
                    authTab === 'login' 
                      ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow-sm font-black' 
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-250'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setAuthTab('signup')}
                  className={`py-2 text-center rounded-md transition select-none cursor-pointer ${
                    authTab === 'signup' 
                      ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow-sm font-black' 
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-250'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Unified Forms */}
              {authTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-bold text-slate-700 dark:text-gray-300 text-left">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-555 dark:text-gray-450 mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="e.g. resident@hostelflow.com"
                      className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-405 dark:placeholder:text-gray-600 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-555 dark:text-gray-450 mb-1">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-405 dark:placeholder:text-gray-600 font-semibold"
                    />
                    <div className="flex justify-between items-center text-[10px] mt-2">
                      <span />
                      <button
                        type="button"
                        onClick={handleStartRecovery}
                        className="text-blue-600 dark:text-blue-455 hover:underline font-extrabold cursor-pointer bg-transparent border-0 p-0"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
                  >
                    {loading ? 'Authenticating...' : 'Login'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 pt-1 text-xs text-left">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-500 text-center font-bold">
                    Select registration pathway
                  </span>
                  
                  <Link
                    to="/register"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg hover:border-blue-500 transition group text-left cursor-pointer"
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-850 dark:text-white">Resident Student Signup</h4>
                      <p className="text-[9px] text-slate-500 dark:text-gray-400 font-semibold mt-0.5">Link hostel roll number to initiate PWA account setup</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors" />
                  </Link>

                  <div className="p-3.5 bg-slate-50/50 dark:bg-[#0d1117]/50 border border-slate-200 dark:border-[#30363d] rounded-lg text-left">
                    <h4 className="font-extrabold text-slate-700 dark:text-gray-300">Guardians & Staff Pathways</h4>
                    <p className="text-[9px] text-slate-500 dark:text-gray-405 font-semibold mt-0.5 leading-relaxed">
                      Credentials allocation is automated during master administrative hostel intake. Please refer to notices sent to your registered address.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : recoveryStage === 'email' ? (
            /* PASSWORD RECOVERY STEP 1: ENTER EMAIL */
            <div className="space-y-5 text-left">
              <div className="text-center">
                <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto" />
                <span className="block font-black text-sm tracking-tight text-slate-900 dark:text-white mt-2 select-none">
                  Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white pt-1 uppercase tracking-wide">Forgot Password?</h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold mt-1">Enter your email address to receive a secure recovery code</p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4 text-xs font-bold text-slate-700 dark:text-gray-350">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-450 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                    placeholder="e.g. resident@hostelflow.com"
                    className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 dark:placeholder:text-gray-650 font-semibold"
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
                  className="w-full bg-slate-100 dark:bg-[#30363d] hover:bg-slate-200 dark:hover:bg-[#484f58] text-slate-750 dark:text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Login
                </button>
              </form>
            </div>

          ) : recoveryStage === 'otp' ? (
            /* PASSWORD RECOVERY STEP 2: VERIFY OTP */
            <div className="space-y-5 text-left">
              <div className="text-center">
                <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto" />
                <span className="block font-black text-sm tracking-tight text-slate-900 dark:text-white mt-2 select-none">
                  Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white pt-1 uppercase tracking-wide">Verify Code</h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold mt-1 leading-relaxed">
                  We sent a 6-digit verification code to <span className="text-slate-900 dark:text-white font-bold">{recoveryEmail}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs font-bold text-slate-700 dark:text-gray-350">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-450 mb-1">Verification Code (OTP)</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={recoveryOtp}
                    onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="e.g. 123456"
                    className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 dark:placeholder:text-gray-655 font-bold text-center text-sm tracking-[0.2em]"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-gray-450">
                  <span>Didn't receive the code?</span>
                  {resendCooldown > 0 ? (
                    <span className="font-bold text-slate-400 dark:text-gray-500">Resend OTP in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-blue-650 dark:text-blue-455 hover:underline font-bold bg-transparent border-0 p-0 cursor-pointer"
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
                  className="w-full bg-slate-100 dark:bg-[#30363d] hover:bg-slate-200 dark:hover:bg-[#484f58] text-slate-750 dark:text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </form>
            </div>

          ) : recoveryStage === 'reset' ? (
            /* PASSWORD RECOVERY STEP 3: CREATE NEW PASSWORD */
            <div className="space-y-5 text-left">
              <div className="text-center">
                <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto" />
                <span className="block font-black text-sm tracking-tight text-slate-900 dark:text-white mt-2 select-none">
                  Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white pt-1 uppercase tracking-wide">Reset Password</h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold mt-1">Create a secure new password for your account</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-bold text-slate-700 dark:text-gray-350">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-450 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showRecoveryPassword ? 'text' : 'password'}
                      value={recoveryPassword}
                      onChange={(e) => setRecoveryPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 pr-10 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 dark:placeholder:text-gray-655 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-755 p-0.5"
                    >
                      {showRecoveryPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {recoveryPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1 bg-slate-100 dark:bg-[#0d1117] rounded-full overflow-hidden flex">
                        <div className={`h-full transition-all duration-300 ${strength.color}`} />
                      </div>
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className="text-slate-400 dark:text-gray-500">Strength:</span>
                        <span className={strength.textClass}>{strength.label}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 dark:text-gray-455 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showRecoveryConfirmPassword ? 'text' : 'password'}
                      value={recoveryConfirmPassword}
                      onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg p-3 pr-10 text-slate-800 dark:text-white focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 dark:placeholder:text-gray-655 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryConfirmPassword(!showRecoveryConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-755 p-0.5"
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
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8 stroke-[2]" />
              </div>

              <div className="space-y-2">
                <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto" />
                <span className="block font-black text-sm tracking-tight text-slate-900 dark:text-white mt-2 select-none">
                  Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">Password Updated</h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-405 font-semibold leading-relaxed max-w-xs mx-auto">
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
  };

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] text-slate-900 dark:text-[#f0f6fc] font-sans flex flex-col justify-between p-6 relative overflow-hidden safe-top-padding">
        {/* Ambient background glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] pointer-events-none" />

        {/* Top Header/Toggle */}
        <div className="flex justify-between items-center z-10 w-full">
          <div className="flex items-center gap-2">
            <HostelFlowLogo className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            <span className="font-extrabold text-lg tracking-tight">HostelFlow</span>
          </div>
          <button
            onClick={handleToggleTheme}
            className="p-2.5 bg-white dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-[#30363d] border border-slate-200 dark:border-[#30363d] rounded-xl text-slate-500 dark:text-gray-400 transition cursor-pointer"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Center Section: App Branding & Hero Onboarding */}
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto space-y-8 z-10 py-10">
          <div className="w-20 h-20 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-3xl flex items-center justify-center shadow-2xl animate-pulse">
            <HostelFlowLogo className="w-12 h-12 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight">HostelFlow</h1>
            <p className="text-xs text-slate-550 dark:text-gray-400 leading-relaxed font-semibold">
              Secure institutional hostel portal for leave tracking, outpass codes, mess billing, and real-time alerts.
            </p>
          </div>

          <div className="w-full space-y-3.5 pt-4">
            {user ? (
              <Link
                to={getDashboardRoute()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 text-xs"
              >
                Go to Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setAuthTab('login'); setIsAuthModalOpen(true); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 text-xs cursor-pointer"
                >
                  Sign In to Account
                </button>
                <Link
                  to="/register"
                  className="w-full bg-white dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-[#30363d] border border-slate-200 dark:border-[#30363d] text-slate-800 dark:text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs"
                >
                  Register New Student Account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Bottom Section: Footer */}
        <div className="z-10 w-full max-w-sm mx-auto space-y-4">
          <div className="text-center text-[9px] text-slate-400 dark:text-gray-600 font-semibold pb-2 border-t border-slate-200 dark:border-[#30363d] pt-4">
            &copy; 2026 HostelFlow. Hardened App Build.
          </div>
        </div>

        {/* Modal Injector */}
        {renderSharedAuthModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-[#f0f6fc] font-sans selection:bg-blue-600 selection:text-white flex flex-col justify-between overflow-x-hidden">
      
      {/* Top Navbar */}
      <header className="relative border-b border-slate-200 dark:border-[#30363d] bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md z-40 sticky top-0 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Left Side: Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <HostelFlowLogo className="w-10 h-10 text-blue-600 dark:text-blue-500" />
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 select-none">
              Hostel<span className="text-blue-600 dark:text-blue-500">Flow</span>
            </span>
          </div>

          {/* Desktop Onboarding Menu */}
          <nav className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3.5 bg-slate-100/80 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] pl-4 pr-2.5 py-1.5 rounded-full">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black uppercase shadow-inner">
                    {getInitials(user.fullName)}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">Welcome back, {user.fullName.split(' ')[0]}</span>
                </div>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-[#30363d]" />
                <Link
                  to={getDashboardRoute()}
                  className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition shadow-sm"
                >
                  Continue to Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-full transition cursor-pointer"
                  title="Logout Session"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setAuthTab('login'); setIsAuthModalOpen(true); }}
                  className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthTab('signup'); setIsAuthModalOpen(true); }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
            {/* Theme Switcher Toggle */}
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#30363d] transition cursor-pointer ml-1"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </nav>

          {/* Mobile Hamburger Toggle */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#30363d] transition cursor-pointer"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-4 space-y-2.5">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#0d1117] rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black uppercase text-white">
                    {getInitials(user.fullName)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">{user.fullName}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase">{user.role}</p>
                  </div>
                </div>
                <Link
                  to={getDashboardRoute()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Continue to Dashboard <ArrowRight size={12} />
                </Link>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-slate-100 dark:bg-[#30363d] hover:bg-slate-200 dark:hover:bg-[#484f58] text-red-600 rounded-lg text-xs font-bold transition border border-slate-200 dark:border-[#30363d]"
                >
                  <LogOut size={12} />
                  Logout Session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); setAuthTab('login'); setIsAuthModalOpen(true); }}
                  className="py-2.5 text-center bg-slate-100 dark:bg-[#30363d] hover:bg-slate-200 dark:hover:bg-[#484f58] rounded-lg text-xs font-bold text-slate-700 dark:text-gray-300 transition cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setAuthTab('signup'); setIsAuthModalOpen(true); }}
                  className="py-2.5 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Hero Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center w-full relative">
        
        {/* Left Side: Headline */}
        <section className="lg:col-span-6 space-y-6 text-left flex flex-col justify-center">
          
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08] lg:leading-[1.12]">
            Hostel Management <br />
            <span className="text-blue-600 dark:text-blue-500">Software</span> for Universities, <br />
            Colleges & Schools
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-slate-500 dark:text-gray-400 leading-relaxed font-normal max-w-2xl">
            Centralized hostel operations platform for attendance, leave management, mess billing, security verification, analytics, and parent monitoring.
          </p>

          <div className="pt-2">
            {user ? (
              <Link
                to={getDashboardRoute()}
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-md shadow-blue-600/10 transition group"
              >
                Continue to Dashboard
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <button
                onClick={() => { setAuthTab('signup'); setIsAuthModalOpen(true); }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-md shadow-blue-600/10 transition group cursor-pointer"
              >
                Get started
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </section>

        {/* Right Side: Multi-Ring Symmetrical Infographic */}
        <section className="lg:col-span-6 w-full flex justify-center items-center py-4">
          <div className="relative w-[380px] h-[380px] sm:w-[460px] sm:h-[460px] lg:w-[490px] lg:h-[490px] flex items-center justify-center select-none">
            
            {/* Inner Decorative Accent Ring */}
            <div className="absolute w-[220px] h-[220px] rounded-full border border-dashed border-blue-200/40 dark:border-blue-500/20 pointer-events-none" />
            
            {/* Main Single Orbital Path Ring */}
            <div className="absolute w-[340px] h-[340px] rounded-full border border-dashed border-blue-200/80 dark:border-blue-500/40 pointer-events-none" />

            {/* Central Circle Node: Student Accommodation */}
            <div className="z-10 w-36 h-36 sm:w-40 sm:h-40 bg-white dark:bg-[#161b22] rounded-full border border-slate-200/80 dark:border-[#30363d] shadow-md flex flex-col items-center justify-center text-center p-3 hover:shadow-lg transition-all duration-300">
              <div className="w-18 h-10 flex items-center justify-center mb-1">
                <CenterBedIllustration />
              </div>
              <span className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider leading-tight">
                Student
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-gray-400 leading-tight">
                Accommodation
              </span>
            </div>

            {/* Concentric Multi-Ring Surrounding Nodes */}
            {ecosystemNodes.map((node, i) => {
              const rad = (node.angle * Math.PI) / 180;
              const x = Math.sin(rad) * node.radius;
              const y = -Math.cos(rad) * node.radius;
              const Icon = node.icon;

              return (
                <div
                  key={i}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  className="absolute z-20 flex flex-col items-center group"
                >
                  {/* Round Node Icon Container */}
                  <div className={`w-11 h-11 sm:w-13 sm:h-13 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-full flex items-center justify-center shadow-sm group-hover:border-blue-450 dark:group-hover:border-blue-500 group-hover:scale-110 transition-all duration-300 cursor-pointer ${node.color.split(' ')[0]}`}>
                    <Icon className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 stroke-[2]" />
                  </div>
                  {/* Node Label underneath the icon */}
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-gray-400 text-center tracking-tight leading-tight mt-1.5 select-none whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
                    {node.label}
                  </span>
                </div>
              );
            })}

          </div>
        </section>

      </main>

      {/* Clean institutional footer strip */}
      <footer className="border-t border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] py-6 text-center text-[10px] text-slate-400 dark:text-gray-500 z-10 w-full">
        <div className="max-w-7xl mx-auto px-6 flex justify-center items-center">
          <div>&copy; 2026 HostelFlow. All rights reserved.</div>
        </div>
      </footer>

      {/* Unified Professional Authentication Modal */}
      {renderSharedAuthModal()}

    </div>
  );
}
