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
  Settings
} from 'lucide-react';
import api from '../api';
import NotificationBell from '../components/NotificationBell';

export default function SidebarLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [parentStudents, setParentStudents] = useState([]);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // Reusable notion/linear navigation item link component
  const NavLink = ({ to, icon: Icon, children }) => {
    const active = window.location.pathname === to || window.location.pathname.startsWith(to + '/');
    return (
      <Link 
        to={to} 
        onClick={closeSidebar}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer min-h-[44px] ${
          active 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10 font-black scale-[1.01]' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
        }`}
      >
        <Icon size={18} className={active ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
        <span>{children}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-gray-50 font-sans">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-950 text-white flex flex-col shadow-xl z-40 transition-transform duration-300 md:relative md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-gray-900/80 flex items-center justify-between font-black text-md tracking-wider uppercase bg-gray-950/40 text-blue-400">
          <span className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-blue-500 animate-pulse" />
            HostelFlow ERP
          </span>
          <button 
            onClick={closeSidebar}
            className="md:hidden p-2 text-gray-400 hover:text-white focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
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
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/warden" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Operations</div>
                <NavLink to="/attendance/mark" icon={CheckSquare}>Attendance</NavLink>
                <NavLink to="/leaves/pending" icon={FileText}>Leave Requests</NavLink>
                <NavLink to="/students/list" icon={Users}>Students</NavLink>
                <NavLink to="/rooms" icon={Home}>Rooms</NavLink>
                <NavLink to="/complaints" icon={AlertCircle}>Complaints</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Utilities & Reports</div>
                <NavLink to="/warden/mess" icon={Utensils}>Mess & Billing</NavLink>
                <NavLink to="/notices/manage" icon={Megaphone}>Notices</NavLink>
                <NavLink to="/warden/analytics" icon={BarChart2}>Analytics</NavLink>
                <NavLink to="/warden/security-gate" icon={ShieldAlert}>Security Gate</NavLink>
              </>
            )}

            {/* Admin Navigation ordered by operational priority */}
            {user?.role === 'ADMIN' && (
              <>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/admin" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Management</div>
                <NavLink to="/admin/hostels" icon={Home}>Hostels</NavLink>
                <NavLink to="/admin/wardens" icon={Users}>Wardens</NavLink>
                <NavLink to="/students/list" icon={Users}>Students</NavLink>
                <NavLink to="/complaints" icon={AlertCircle}>Complaints</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Finance & Notices</div>
                <NavLink to="/admin/billing" icon={Utensils}>Financials</NavLink>
                <NavLink to="/admin/analytics" icon={BarChart2}>Analytics</NavLink>
                <NavLink to="/notices/manage" icon={Megaphone}>Notices</NavLink>
              </>
            )}

            {/* Student Navigation ordered by operational priority */}
            {user?.role === 'STUDENT' && (
              <>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/student" icon={LayoutDashboard}>Dashboard</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Requests & Logs</div>
                <NavLink to="/student/leaves/request" icon={FileText}>Leave Requests</NavLink>
                <NavLink to="/student/attendance" icon={CheckSquare}>Attendance</NavLink>
                
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Utilities</div>
                <NavLink to="/student/billing" icon={CreditCard}>Mess & Billing</NavLink>
                <NavLink to="/student/complaints" icon={AlertCircle}>Complaints</NavLink>
                <NavLink to="/notices" icon={Megaphone}>Notices</NavLink>
                <NavLink to="/student/analytics" icon={BarChart2}>Analytics</NavLink>
              </>
            )}

            {/* Parent Navigation ordered by operational priority */}
            {user?.role === 'PARENT' && (
              <>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 pl-2">Main Menu</div>
                <NavLink to="/parent" icon={LayoutDashboard}>Dashboard</NavLink>
                
                {parentStudents.length > 0 ? (
                  <>
                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-4 mb-2 pl-2">Linked Children</div>
                    {parentStudents.map(student => (
                      <NavLink key={student._id} to={`/parent/student/${student._id}`} icon={UserIcon}>
                        {student.fullName}
                      </NavLink>
                    ))}
                  </>
                ) : (
                  <div className="text-xs text-gray-500 italic p-3 text-center border border-dashed border-gray-800 rounded-xl mt-4">
                    Awaiting linked child credentials allocation
                  </div>
                )}
              </>
            )}

          </nav>
        </div>

        {/* ChatGPT/Slack-style Bottom Profile Component */}
        <div className="p-4 border-t border-gray-900 bg-slate-950/80 relative" ref={dropdownRef}>
          {profileDropdownOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
              <div className="p-2 border-b border-gray-800 bg-slate-950/40">
                <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  Terminal Control
                </div>
              </div>
              <div className="p-1 flex flex-col gap-0.5 text-xs">
                <Link
                  to="/profile"
                  onClick={() => { setProfileDropdownOpen(false); closeSidebar(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition flex items-center gap-2 cursor-pointer font-bold"
                >
                  <UserIcon size={14} />
                  My Profile
                </Link>
                <Link
                  to={user?.role === 'PARENT' ? '/parent/change-password' : '/profile/edit'}
                  onClick={() => { setProfileDropdownOpen(false); closeSidebar(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition flex items-center gap-2 cursor-pointer font-bold"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  onClick={() => { setProfileDropdownOpen(false); handleLogout(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition flex items-center gap-2 cursor-pointer font-bold"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}

          <div 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-3 bg-gray-900/40 border border-gray-900 hover:bg-gray-900/80 active:scale-[0.98] transition p-2.5 rounded-xl cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-xs text-white shadow-inner flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black truncate text-gray-250 leading-tight">{user?.fullName}</div>
              <div className="text-[9px] text-blue-400 font-black uppercase tracking-wider mt-0.5">{user?.role}</div>
            </div>
            <div className="text-gray-400 font-bold text-[9px] select-none pl-1">
              {profileDropdownOpen ? '▲' : '▼'}
            </div>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Responsive Top Header */}
        <header className="bg-white shadow-sm border-b px-4 md:px-6 py-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger menu button for mobile */}
            <button 
              onClick={() => setIsOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
              {user ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ''} Portal
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        
        {/* Page Viewport Container */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto w-full bg-slate-50/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
