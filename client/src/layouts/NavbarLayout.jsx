import { useContext } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function NavbarLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
        <Link to="/" className="font-bold text-xl tracking-wide">Smart Hostel</Link>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Hello, {user.fullName}</span>
              <button 
                onClick={handleLogout}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-bold hover:bg-gray-100 transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <Link to="/login" className="hover:text-gray-200 transition">Login</Link>
              <Link to="/register" className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-bold hover:bg-gray-100 transition">Register</Link>
            </div>
          )}
        </div>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
