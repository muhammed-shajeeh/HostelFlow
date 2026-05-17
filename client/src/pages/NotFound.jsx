import { Link } from 'react-router-dom';

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

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      {/* Main Card */}
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-8 text-center space-y-6 relative shadow-lg z-10 animate-fadeIn">
        
        {/* Brand Header */}
        <div className="space-y-2">
          <Link to="/" className="inline-flex w-12 h-12 rounded-xl bg-blue-50 items-center justify-center border border-blue-100 mx-auto transition hover:scale-105 duration-200">
            <HostelFlowLogo className="w-8 h-8 text-blue-600" />
          </Link>
          <span className="block font-black text-sm tracking-tight text-slate-900 mt-2 select-none">
            Hostel<span className="text-blue-600">Flow</span>
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">404</h2>
          <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wide">Resource Not Found</h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-xs mx-auto">
            The requested module could not be located, or your account clearance does not authorize direct navigation to this pathway.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer"
          >
            Go to Home
          </Link>
          <Link
            to="/login"
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border border-slate-200 text-xs"
          >
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}
