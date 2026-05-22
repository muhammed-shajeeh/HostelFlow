import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import toast from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import EmergencySOSManager from './components/EmergencySOSManager';

import NavbarLayout from './layouts/NavbarLayout';
import SidebarLayout from './layouts/SidebarLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import StudentRegister from './pages/StudentRegister';
import VerifyOtp from './pages/VerifyOtp';
import Landing from './pages/Landing';
import AdminDashboard from './pages/AdminDashboard';
import AdminHostels from './pages/AdminHostels';
import AdminWardens from './pages/AdminWardens';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminStudentTransfer from './pages/AdminStudentTransfer';
import WardenDashboard from './pages/WardenDashboard';
import Rooms from './pages/Rooms';
import PendingStudents from './pages/PendingStudents';
import StudentList from './pages/StudentList';
import StudentDashboard from './pages/StudentDashboard';

// Leave Management
import StudentLeaveRequest from './pages/StudentLeaveRequest';
import PendingLeaves from './pages/PendingLeaves';
import LeaveHistory from './pages/LeaveHistory';
import QRScanner from './pages/QRScanner';

// Attendance
import AttendanceMark from './pages/AttendanceMark';
import AttendanceSummary from './pages/AttendanceSummary';
import StudentAttendance from './pages/StudentAttendance';

// Profile
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';

// Complaints
import ComplaintCreate from './pages/ComplaintCreate';
import MyComplaints from './pages/MyComplaints';
import ComplaintManagement from './pages/ComplaintManagement';

// Notices
import Notices from './pages/Notices';
import NoticeCreate from './pages/NoticeCreate';
import NoticeManagement from './pages/NoticeManagement';

// Analytics
import AdminAnalytics from './pages/AdminAnalytics';
import WardenAnalytics from './pages/WardenAnalytics';
import StudentAnalytics from './pages/StudentAnalytics';

// Parent Portal
import ParentDashboard from './pages/ParentDashboard';
import ParentStudentView from './pages/ParentStudentView';
import ChangePassword from './pages/ChangePassword';

// Mess & Billing
import StudentBilling from './pages/StudentBilling';
import WardenMessManagement from './pages/WardenMessManagement';

// Security Gate Portal
import WardenSecurityGate from './pages/WardenSecurityGate';
import SecurityGateDashboard from './pages/SecurityGateDashboard';
import NotFound from './pages/NotFound';

const closeOpenOverlays = () => {
  // 1. Mobile Sidebar backdrop
  const sidebarBackdrop = document.querySelector('.sidebar-backdrop');
  if (sidebarBackdrop) {
    sidebarBackdrop.click();
    return true;
  }

  // 2. Modals and Dialogs (Reassign Room, Status Updates, Rejection modals)
  const modalBackdrop = document.querySelector('.fixed.inset-0.z-50, div[class*="fixed"][class*="inset-0"][class*="bg-black/60"], div[class*="fixed"][class*="inset-0"][class*="bg-slate-950/70"]');
  if (modalBackdrop) {
    // Try to find a close button inside the modal and click it
    const closeBtn = modalBackdrop.querySelector('button[class*="close"], button:has(svg[class*="lucide-x"]), button[class*="cancel"]');
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    // Try scanning for any button with an SVG close icon
    const svgCloseBtn = Array.from(modalBackdrop.querySelectorAll('button')).find(btn => btn.querySelector('svg'));
    if (svgCloseBtn) {
      svgCloseBtn.click();
      return true;
    }
    // Fallback: click backdrop overlay to trigger dismissal
    modalBackdrop.click();
    return true;
  }

  return false;
};

function HardwareBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastTime = 0;

    const backButtonHandler = CapacitorApp.addListener('backButton', () => {
      // 1. First priority: close mobile sidebar/modals/dialogs/drawers
      const wasOverlayOpen = closeOpenOverlays();
      if (wasOverlayOpen) {
        return;
      }

      // 2. Identify if the current route is considered a root page where exiting is expected
      const rootPaths = ['/', '/login', '/warden', '/student', '/admin', '/parent', '/security'];
      const isRootPath = rootPaths.includes(location.pathname);

      if (isRootPath) {
        // Exiting confirmation mechanism
        const now = Date.now();
        if (now - lastTime < 2000) {
          CapacitorApp.exitApp();
        } else {
          lastTime = now;
          toast('Press back again to exit', {
            icon: '🚪',
            duration: 2000,
            style: {
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '12px',
              border: '1px solid #1e293b'
            }
          });
        }
      } else {
        // Safe route back navigation
        navigate(-1);
      }
    });

    return () => {
      backButtonHandler.remove();
    };
  }, [location, navigate]);

  return null;
}

function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const updateStatusBar = async () => {
        try {
          const isDark = document.documentElement.classList.contains('dark');
          await StatusBar.setStyle({
            style: isDark ? Style.Dark : Style.Light
          });
          await StatusBar.setBackgroundColor({
            color: isDark ? '#090d16' : '#ffffff'
          });
        } catch (err) {
          console.warn('[StatusBar] Failed to style status bar:', err);
        }
      };

      updateStatusBar();

      // Listen for theme mutations
      const observer = new MutationObserver(() => updateStatusBar());
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      // Manually hide splash screen after App has mounted and DOM is fully laid out
      // A small timeout of 250ms ensures that React rendering cycle is complete and paints the WebView!
      setTimeout(async () => {
        try {
          await SplashScreen.hide({
            fadeOutDuration: 400
          });
          console.log('[Capacitor SplashScreen] Native splash screen dismissed smoothly.');
        } catch (err) {
          console.warn('[SplashScreen] Failed to dismiss splash screen:', err);
        }
      }, 250);

      return () => observer.disconnect();
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <EmergencySOSManager />
            <BrowserRouter>
            <HardwareBackHandler />
            <Toaster 
              position="top-right" 
              containerStyle={{
                top: 'calc(12px + env(safe-area-inset-top, 0px))',
                left: '12px',
                right: '12px'
              }}
            />
            <Routes>
              <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<StudentRegister />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* Standalone Gatekeeper Security Terminal with integrated PIN authentication */}
          <Route path="/security" element={<SecurityGateDashboard />} />
          
          {/* Protected Routes Wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route element={<SidebarLayout />}>
              {/* Role Specific Routes */}
              <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'WARDEN', 'STUDENT', 'PARENT']} />}>
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/edit" element={<EditProfile />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/hostels" element={<AdminHostels />} />
                <Route path="/admin/wardens" element={<AdminWardens />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                <Route path="/admin/student-transfer" element={<AdminStudentTransfer />} />
              </Route>
              
              <Route element={<RoleProtectedRoute allowedRoles={['WARDEN', 'ADMIN']} />}>
                <Route path="/warden" element={<WardenDashboard />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/students/pending" element={<PendingStudents />} />
                <Route path="/students/list" element={<StudentList />} />
                
                {/* Leave Management (Warden/Admin) */}
                <Route path="/leaves/pending" element={<PendingLeaves />} />
                <Route path="/leaves/history" element={<LeaveHistory />} />

                {/* Attendance (Warden/Admin) */}
                <Route path="/attendance/mark" element={<AttendanceMark />} />
                <Route path="/attendance/summary" element={<AttendanceSummary />} />

                {/* Complaints (Warden/Admin) */}
                <Route path="/complaints" element={<ComplaintManagement />} />

                {/* Notices (Warden/Admin) */}
                <Route path="/notices/manage" element={<NoticeManagement />} />
                <Route path="/notices/create" element={<NoticeCreate />} />

                {/* Analytics (Warden/Admin) */}
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/warden/analytics" element={<WardenAnalytics />} />

                {/* Mess Management (Warden/Admin) */}
                <Route path="/warden/mess" element={<WardenMessManagement />} />
                <Route path="/warden/mess-management" element={<WardenMessManagement />} />
                <Route path="/admin/mess" element={<WardenMessManagement />} />
                <Route path="/admin/billing" element={<WardenMessManagement />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['WARDEN']} />}>
                <Route path="/warden/security-gate" element={<WardenSecurityGate />} />
              </Route>
              
              <Route element={<RoleProtectedRoute allowedRoles={['PARENT']} />}>
                <Route path="/parent" element={<ParentDashboard />} />
                <Route path="/parent/student/:id" element={<ParentStudentView />} />
                <Route path="/parent/change-password" element={<ChangePassword />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['STUDENT']} />}>
                <Route path="/student" element={<StudentDashboard />} />
                
                {/* Leave Management (Student) */}
                <Route path="/student/leaves/request" element={<StudentLeaveRequest />} />
                <Route path="/student/leaves/history" element={<StudentLeaveRequest />} />
                
                {/* Attendance (Student) */}
                <Route path="/student/attendance" element={<StudentAttendance />} />

                {/* Complaints (Student) */}
                <Route path="/student/complaints" element={<MyComplaints />} />
                <Route path="/student/complaints/new" element={<ComplaintCreate />} />

                {/* Notices (Student) */}
                <Route path="/notices" element={<Notices />} />

                {/* Analytics (Student) */}
                <Route path="/student/analytics" element={<StudentAnalytics />} />

                {/* Mess & Fee Billing (Student) */}
                <Route path="/student/billing" element={<StudentBilling />} />
                <Route path="/student/mess" element={<StudentBilling />} />
                <Route path="/student/payments" element={<StudentBilling />} />
              </Route>
            </Route>
          </Route>
          
          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
}

export default App;
