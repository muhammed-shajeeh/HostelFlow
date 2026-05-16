import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function RoleProtectedRoute({ allowedRoles }) {
  const { user, token } = useContext(AuthContext);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect unauthorized users to their respective dashboard
    const roleRoutes = {
      ADMIN: '/admin',
      WARDEN: '/warden',
      STUDENT: '/student',
      PARENT: '/parent'
    };
    return <Navigate to={roleRoutes[user.role] || '/'} replace />;
  }

  return <Outlet />;
}
