import { useState, useEffect, useContext, useRef } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  LogOut, 
  User as UserIcon, 
  Menu, 
  X, 
  LayoutDashboard, 
  CheckSquare, 
  FileText, 
  Users, 
  Home, 
  AlertCircle, 
  Utensils, 
  Megaphone, 
  BarChart2, 
  ShieldAlert, 
  Download, 
  CreditCard,
  Settings,
  WifiOff
} from 'lucide-react';
import api from '../api';
import NotificationBell from '../components/NotificationBell';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';

export default function SidebarLayout() {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const { badgeSummary } = useSocket();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [parentStudents, setParentStudents] = useState([]);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (user && user.role === 'PARENT') {
      api.get('/parent/students')
        .then(res => setParentStudents(res.data.students || []))
        .catch(err => console.warn('Failed to load parent students list', err));
    }
  }, [user]);

  // Click outside listener to close profile settings overlay
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setIsOpen(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const firstStudentId = parentStudents[0]?._id || null;
  const initials = getInitials(user?.fullName);

  // Reusable notion/linear navigation item link component with modern rounded notification bubbles
  const NavLink = ({ to, icon: Icon, badge, badgeColor = 'red', children }) => {
    const active = window.location.pathname === to || window.location.pathname.startsWith(to + '/');
    
    // Choose beautiful high-fidelity ERP-style badge colors with proper dark mode compliance
    const getBadgeColors = () => {
      if (badgeColor === 'red') return 'bg-rose-500 text-white dark:bg-rose-600';
      if (badgeColor === 'orange') return 'bg-amber-500 text-slate-950 dark:bg-amber-600 dark:text-white';
      if (badgeColor === 'blue') return 'bg-blue-500 text-white dark:bg-blue-600';
      return 'bg-slate-400 text-white dark:bg-zinc-650';
    };

    return (
      <Link 
        to={to} 
        onClick={closeSidebar}
        className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 cursor-pointer min-h-[44px] ${
          active 
            ? 'bg-blue-600 text-white shadow-xs font-black' 
            : 'text-slate-650 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={active ? 'text-white' : 'text-slate-500 dark:text-zinc-400'} />
          <span>{children}</span>
        </div>
        {badge > 0 && (
          <span className={`px-2 py-0.5 text-[10px] font-black rounded-full min-w-[18px] text-center select-none shadow-xs transition-all duration-200 ${getBadgeColors()}`}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 font-sans transition-colors duration-150">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 flex flex-col border-r border-slate-200 dark:border-zinc-800 shadow-xl z-40 transition-transform duration-300 md:relative md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between font-black text-md tracking-wider uppercase bg-slate-50 dark:bg-zinc-950/40 text-blue-600 dark:text-blue-400 safe-top-padding">
          <span className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-blue-500 animate-pulse" />
            HostelFlow ERP
          </span>
          <button 
            onClick={closeSidebar}
            className="md:hidden p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation list */}
        <div className="flex-1 p-4 overflow-y-auto space-y-1">
          <nav className="space-y-1 text-sm flex flex-col">
            
            {/* Warden Navigation ordered by operational priority */}
            {user?.role === 'WARDEN' && (
              <>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/warden" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Operations</div>
                <NavLink to="/attendance/mark" icon={CheckSquare}>Attendance</NavLink>
                <NavLink to="/leaves/pending" icon={FileText} badge={badgeSummary?.pendingLeaves} badgeColor="orange">Leave Requests</NavLink>
                <NavLink to="/students/list" icon={Users} badge={badgeSummary?.pendingStudents} badgeColor="red">Students</NavLink>
                <NavLink to="/rooms" icon={Home}>Rooms</NavLink>
                <NavLink to="/complaints" icon={AlertCircle} badge={badgeSummary?.pendingComplaints} badgeColor="red">Complaints</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Utilities & Reports</div>
                <NavLink to="/warden/mess" icon={Utensils}>Mess & Billing</NavLink>
                <NavLink to="/notices/manage" icon={Megaphone}>Notices</NavLink>
                <NavLink to="/warden/analytics" icon={BarChart2}>Analytics</NavLink>
                <NavLink to="/warden/security-gate" icon={ShieldAlert}>Security Gate</NavLink>
              </>
            )}

            {/* Admin Navigation ordered by operational priority */}
            {user?.role === 'ADMIN' && (
              <>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/admin" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Management</div>
                <NavLink to="/admin/hostels" icon={Home}>Hostels</NavLink>
                <NavLink to="/admin/wardens" icon={Users}>Wardens</NavLink>
                <NavLink to="/students/list" icon={Users} badge={badgeSummary?.pendingStudents} badgeColor="red">Students</NavLink>
                <NavLink to="/complaints" icon={AlertCircle} badge={badgeSummary?.pendingComplaints} badgeColor="red">Complaints</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Finance & Notices</div>
                <NavLink to="/admin/billing" icon={Utensils}>Financials</NavLink>
                <NavLink to="/admin/analytics" icon={BarChart2}>Analytics</NavLink>
                <NavLink to="/notices/manage" icon={Megaphone}>Notices</NavLink>

                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Governance</div>
                <NavLink to="/admin/audit-logs" icon={ShieldAlert}>Audit Logs</NavLink>
              </>
            )}

            {/* Student Navigation ordered by operational priority */}
            {user?.role === 'STUDENT' && (
              <>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/student" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Requests & Logs</div>
                <NavLink to="/student/leaves/request" icon={FileText} badge={badgeSummary?.pendingLeaves} badgeColor="orange">Leave Requests</NavLink>
                <NavLink to="/student/attendance" icon={CheckSquare}>Attendance</NavLink>
                
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Utilities</div>
                <NavLink to="/student/billing" icon={CreditCard}>Mess & Billing</NavLink>
                <NavLink to="/student/complaints" icon={AlertCircle} badge={badgeSummary?.pendingComplaints} badgeColor="red">Complaints</NavLink>
                <NavLink to="/notices" icon={Megaphone}>Notices</NavLink>
                <NavLink to="/student/analytics" icon={BarChart2}>Analytics</NavLink>
              </>
            )}

            {/* Parent Navigation ordered by operational priority */}
            {user?.role === 'PARENT' && (
              <>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/parent" icon={LayoutDashboard}>Dashboard</NavLink>
                
                {parentStudents.length > 0 ? (
                  <>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Linked Children</div>
                    {parentStudents.map(student => (
                      <NavLink key={student._id} to={`/parent/student/${student._id}`} icon={UserIcon}>
                        {student.fullName}
                      </NavLink>
                    ))}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-zinc-500 italic p-3 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl mt-4">
                    Awaiting linked child credentials allocation
                  </div>
                )}
              </>
            )}

          </nav>
        </div>

        {/* ChatGPT/Slack-style Bottom Profile Component */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative" ref={dropdownRef}>
          {profileDropdownOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
              <div className="p-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40">
                <div className="px-3 py-1 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                  Terminal Control
                </div>
              </div>
              <div className="p-1 flex flex-col gap-0.5 text-xs font-bold">
                <Link
                  to="/profile"
                  onClick={() => { setProfileDropdownOpen(false); closeSidebar(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon size={14} />
                  My Profile
                </Link>
                <Link
                  to={user?.role === 'PARENT' ? '/parent/change-password' : '/profile/edit'}
                  onClick={() => { setProfileDropdownOpen(false); closeSidebar(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition flex items-center gap-2 cursor-pointer"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  onClick={() => { setProfileDropdownOpen(false); handleLogout(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-red-650 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  Logout
                </button>
                {deferredPrompt && (
                  <button
                    onClick={() => { setProfileDropdownOpen(false); handleInstallClick(); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-blue-650 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition flex items-center gap-2 cursor-pointer font-bold"
                  >
                    <Download size={14} />
                    Install App
                  </button>
                )}
                <div className="border-t border-slate-200 dark:border-zinc-800 my-1.5"></div>
                <div className="px-3 py-1 text-[9px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-widest">
                  Appearance
                </div>
                <div className="flex p-1 gap-1">
                  <button
                    onClick={() => toggleTheme('light')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      theme === 'light' 
                        ? 'bg-blue-600 text-white font-black shadow-inner' 
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => toggleTheme('dark')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-blue-600 text-white font-black shadow-inner' 
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => toggleTheme('system')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      theme === 'system' 
                        ? 'bg-blue-600 text-white font-black shadow-inner' 
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Sys
                  </button>
                </div>
              </div>
            </div>
          )}

          <div 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800/80 active:scale-[0.98] transition p-2.5 rounded-xl cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-xs text-white shadow-inner flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black truncate text-slate-800 dark:text-zinc-200 leading-tight">{user?.fullName}</div>
              <div className="text-[9px] text-blue-650 dark:text-blue-400 font-black uppercase tracking-wider mt-0.5">{user?.role}</div>
            </div>
            <div className="text-slate-400 dark:text-zinc-500 font-bold text-[9px] select-none pl-1">
              {profileDropdownOpen ? '▲' : '▼'}
            </div>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950">
        {/* Responsive Top Header */}
        <header className="bg-white dark:bg-zinc-900 shadow-xs border-b border-slate-200 dark:border-zinc-800 px-4 md:px-6 py-4 flex justify-between items-center z-10 safe-top-padding">
          <div className="flex items-center gap-3">
            {/* Hamburger menu button for mobile */}
            <button 
              onClick={() => setIsOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              {user ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ''} Portal
              {!isOnline && (
                <span className="text-[10px] font-black uppercase bg-red-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse select-none">
                  <WifiOff size={10} />
                  Offline
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        
        {/* Page Viewport Container */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto w-full bg-slate-50/50 dark:bg-zinc-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
