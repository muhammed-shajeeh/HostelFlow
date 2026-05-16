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
          <div className="flex items-center gap-3 bg-gray-800 p-3 rounded-lg mb-6">
            <UserIcon className="text-gray-400" size={24} />
            <div>
              <div className="text-sm font-semibold truncate">{user?.fullName}</div>
              <div className="text-xs text-gray-400">{user?.role}</div>
            </div>
          </div>
          
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
