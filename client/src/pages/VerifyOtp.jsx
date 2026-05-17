import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Key } from 'lucide-react';
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

export default function VerifyOtp() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  useEffect(() => {
    if (!email) {
      toast.error('Email parameter is missing');
      navigate('/register');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { email, otp });
      if (res.data.success) {
        toast.success(res.data.message);
        navigate('/login');
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      {/* Verify OTP Card */}
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-6 relative shadow-lg z-10 text-center">
        
        {/* Brand Header */}
        <div className="space-y-2">
          <Link to="/" className="inline-flex w-12 h-12 rounded-xl bg-blue-50 items-center justify-center border border-blue-100 mx-auto transition hover:scale-105 duration-200">
            <HostelFlowLogo className="w-8 h-8 text-blue-600" />
          </Link>
          <span className="block font-black text-sm tracking-tight text-slate-900 mt-2 select-none">
            Hostel<span className="text-blue-600">Flow</span>
          </span>
          <h3 className="text-base font-extrabold text-slate-900 pt-1 uppercase tracking-wide">Verify Your Email</h3>
          <p className="text-[11px] text-slate-500 font-semibold max-w-[280px] mx-auto leading-relaxed">
            We have dispatched a 6-digit OTP code to <strong className="text-slate-850">{email}</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type="text" 
              name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength="6"
              minLength="6"
              placeholder="0 0 0 0 0 0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-center tracking-[0.4em] text-2xl font-black text-slate-800 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-300 placeholder:tracking-normal font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-xs"
          >
            {loading ? 'Verifying OTP...' : 'Verify Email Address'}
          </button>
        </form>

        {/* Links */}
        <div className="text-center text-[10px] text-slate-500 pt-1 flex items-center justify-center gap-1.5">
          <ArrowLeft size={12} />
          <span>Back to</span>{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-bold">
            Student Registration
          </Link>
        </div>

      </div>
    </div>
  );
}
