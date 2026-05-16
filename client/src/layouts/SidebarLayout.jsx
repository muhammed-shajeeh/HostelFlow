import { useContext } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function SidebarLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
        <div className="p-4 border-b border-gray-700 flex items-center justify-center font-bold text-lg">
          Smart Hostel
        </div>
        
        <div className="flex-1 p-4">
          <Link to="/profile" className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 transition p-3 rounded-lg mb-6 cursor-pointer">
            <UserIcon className="text-gray-400" size={24} />
            <div>
              <div className="text-sm font-semibold truncate">{user?.fullName}</div>
              <div className="text-xs text-gray-400">{user?.role}</div>
            </div>
          </Link>
          
          <nav className="space-y-2 text-sm flex flex-col">
            <Link to={`/${user?.role?.toLowerCase()}`} className="bg-blue-600 text-white p-2 rounded cursor-pointer text-center font-medium shadow hover:bg-blue-700 transition">
              Dashboard
            </Link>
            
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/admin/hostels" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Manage Hostels
                </Link>
                <Link to="/admin/wardens" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Manage Wardens
                </Link>
              </>
            )}

            {(user?.role === 'ADMIN' || user?.role === 'WARDEN') && (
              <>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Operations</div>
                <Link to="/rooms" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Manage Rooms
                </Link>
                <Link to="/students/pending" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Pending Approvals
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Attendance</div>
                <Link to="/attendance/mark" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Mark Attendance
                </Link>
                <Link to="/attendance/summary" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Daily Summary
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Leave Management</div>
                <Link to="/leaves/pending" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-yellow-500">
                  Leave Approvals
                </Link>
                <Link to="/leaves/scanner" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-green-500">
                  QR Scanner
                </Link>
                <Link to="/leaves/history" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Leave History
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Complaints</div>
                <Link to="/complaints" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-orange-400">
                  Manage Complaints
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Noticeboard</div>
                <Link to="/notices/manage" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-indigo-400">
                  Manage Notices
                </Link>
                <Link to="/notices/create" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Post Notice
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Reports & Analytics</div>
                <Link to={user?.role === 'ADMIN' ? '/admin/analytics' : '/warden/analytics'} className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-cyan-400">
                  Detailed Analytics
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Mess Operations</div>
                <Link to="/warden/mess" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-yellow-500">
                  Mess & Billing Portal
                </Link>
              </>
            )}

            {user?.role === 'STUDENT' && (
              <>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">My Daily Record</div>
                <Link to="/student/attendance" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-green-500">
                  My Attendance
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">My Leaves</div>
                <Link to="/student/leaves/request" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-blue-500">
                  Apply for Leave
                </Link>
                <Link to="/student/leaves/history" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-purple-500">
                  My Leave History
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Complaints</div>
                <Link to="/student/complaints" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-orange-400">
                  My Complaints
                </Link>
                <Link to="/student/complaints/new" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Submit Complaint
                </Link>

                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Noticeboard</div>
                <Link to="/notices" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-indigo-400">
                  View Notices
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Reports & Analytics</div>
                <Link to="/student/analytics" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-cyan-400">
                  My Performance
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Finance & Bills</div>
                <Link to="/student/billing" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-emerald-500">
                  My Fees & Bills
                </Link>
              </>
            )}
            {user?.role === 'PARENT' && (
              <>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Monitoring</div>
                <Link to="/parent/dashboard" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition border-l-4 border-indigo-400">
                  Guardian Dashboard
                </Link>
                <div className="text-xs text-gray-500 uppercase font-bold mt-4 mb-1 pl-2">Account</div>
                <Link to="/parent/change-password" className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded transition">
                  Change Password
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-700">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded transition"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center z-10">
          <h1 className="text-xl font-bold text-gray-800">
            {user ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ''} Portal
          </h1>
        </header>
        
        {/* Page Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
