import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';

import NavbarLayout from './layouts/NavbarLayout';
import SidebarLayout from './layouts/SidebarLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import StudentRegister from './pages/StudentRegister';
import VerifyOtp from './pages/VerifyOtp';
import AdminDashboard from './pages/AdminDashboard';
import AdminHostels from './pages/AdminHostels';
import AdminWardens from './pages/AdminWardens';
import WardenDashboard from './pages/WardenDashboard';
import Rooms from './pages/Rooms';
import PendingStudents from './pages/PendingStudents';
import StudentList from './pages/StudentList';
import StudentDashboard from './pages/StudentDashboard';

// Leave Management
import StudentLeaveRequest from './pages/StudentLeaveRequest';
import StudentLeaveHistory from './pages/StudentLeaveHistory';
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

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route element={<NavbarLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<StudentRegister />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/" element={<div className="p-4 text-center mt-10 text-2xl font-bold">Welcome to Smart Hostel Management System</div>} />
          </Route>

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
                <Route path="/student/leaves/history" element={<StudentLeaveHistory />} />
                
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
          
        </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
