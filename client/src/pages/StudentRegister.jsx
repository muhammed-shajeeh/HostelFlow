import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Layers, 
  Users, 
  Home, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  ArrowRight,
  Info,
  DollarSign,
  Clock,
  Mail,
  AlertCircle
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';
import DateTimePicker from '../components/DateTimePicker';

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

export default function StudentRegister() {
  const navigate = useNavigate();
  
  // UI states for loading and success confirmation
  const [hostels, setHostels] = useState([]);
  const [fetchingHostels, setFetchingHostels] = useState(true);
  const [hostelError, setHostelError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Dynamic rooms list linked to selected hostel
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Form input state
  const [formData, setFormData] = useState({
    fullName: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    phoneNumber: '',
    gender: 'MALE',
    dob: '',
    department: '', 
    year: '1', 
    semester: '1', 
    admissionNumber: '', 
    parentName: '', 
    parentEmail: '',
    parentPhone: '',
    parentRelationship: 'Father',
    emergencyPhone: '',
    hostelId: '', 
    preferredRoom: '',
    foodPreference: 'Vegetarian',
    sameDepartmentPreferred: false,
    sameBatchPreferred: false,
    preferredFloor: '',
    medicalNeeds: '',
    specialNotes: ''
  });

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch Hostels on mount
  useEffect(() => {
    let isMounted = true;
    const fetchHostels = async () => {
      try {
        setFetchingHostels(true);
        setHostelError('');
        const res = await api.get('/hostels'); 
        if (isMounted) {
          if (res.data.hostels && res.data.hostels.length > 0) {
            setHostels(res.data.hostels);
            setFormData(prev => ({...prev, hostelId: res.data.hostels[0]._id}));
          } else {
            setHostelError('No hostels currently available.');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Hostel fetch error:', err);
          setHostelError('Failed to fetch available hostels.');
          toast.error('Failed to load hostels');
        }
      } finally {
        if (isMounted) {
          setFetchingHostels(false);
        }
      }
    };
    fetchHostels();
    return () => { isMounted = false; };
  }, []);

  // Fetch Rooms dynamically when hostel selection changes
  useEffect(() => {
    if (!formData.hostelId) {
      setRooms([]);
      return;
    }
    let isMounted = true;
    const fetchRoomsOfHostel = async () => {
      setLoadingRooms(true);
      try {
        const res = await api.get(`/rooms/hostel/${formData.hostelId}`);
        if (isMounted) {
          setRooms(res.data.rooms || []);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      } finally {
        if (isMounted) {
          setLoadingRooms(false);
        }
      }
    };
    fetchRoomsOfHostel();
    return () => { isMounted = false; };
  }, [formData.hostelId]);

  // Input change handler
  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  // Form validation checks
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: '', color: 'bg-slate-200', width: 'w-0' };
    if (pwd.length < 6) return { label: 'Too short', color: 'bg-rose-500', width: 'w-1/4' };
    
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[^a-zA-Z0-9]/.test(pwd);
    
    if (pwd.length >= 8 && hasLetter && hasNumber && hasSymbol) {
      return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
    }
    if (pwd.length >= 6 && hasLetter && hasNumber) {
      return { label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' };
    }
    return { label: 'Weak', color: 'bg-rose-400', width: 'w-1/3' };
  };

  const isEmailValid = (em) => {
    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(em);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.fullName || formData.fullName.length < 3) {
      return toast.error('Full name must be at least 3 characters.');
    }
    if (!isEmailValid(formData.email)) {
      return toast.error('Please enter a valid email address.');
    }
    if (formData.password.length < 6) {
      return toast.error('Password must be at least 6 characters.');
    }
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    if (!formData.admissionNumber) {
      return toast.error('Admission number is required.');
    }
    if (!formData.hostelId) {
      return toast.error('Please select a valid hostel.');
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        department: formData.department,
        year: formData.year,
        semester: formData.semester,
        admissionNumber: formData.admissionNumber,
        parentName: formData.parentName,
        parentEmail: formData.parentEmail,
        hostelId: formData.hostelId,
        studentPreferences: {
          sameDepartmentPreferred: formData.sameDepartmentPreferred,
          sameBatchPreferred: formData.sameBatchPreferred,
          preferredFloor: formData.preferredFloor ? parseInt(formData.preferredFloor) : null,
          medicalNeeds: formData.medicalNeeds,
          specialNotes: formData.specialNotes || `Food preference: ${formData.foodPreference}. Preferred room: ${formData.preferredRoom}`
        }
      };

      const res = await api.post('/students/register', payload);
      if (res.data.success) {
        toast.success(res.data.message);
        setRegisteredSuccess(true);
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        
        {/* Top Branding Header */}
        <div className="text-center space-y-3 mb-10">
          <Link to="/" className="inline-flex w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center border border-blue-100 mx-auto transition hover:scale-105 duration-200">
            <HostelFlowLogo className="w-10 h-10 text-blue-600" />
          </Link>
          <span className="block font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 mt-2 select-none">
            Hostel<span className="text-blue-600">Flow</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Resident Student Onboarding</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
            Centralized portal to submit your hostel accommodation preferences and details.
          </p>
        </div>

        {registeredSuccess ? (
          /* Confirmation Success Screen */
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl animate-fadeIn">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100 mx-auto shadow-sm">
              <Mail className="w-9 h-9 stroke-[2]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">Email Verification Required</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold max-w-sm mx-auto">
                Your application has been received, but your account is currently <span className="text-amber-600 font-bold">UNVERIFIED</span>.
              </p>
            </div>

            {/* Mandatory Verification Banner */}
            <div className="p-4 bg-amber-50 border border-amber-250 rounded-2xl text-left flex gap-3 items-start text-xs font-bold text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-extrabold uppercase tracking-wide text-[10px] text-amber-950">Verification is Mandatory</h5>
                <p className="text-[10px] text-amber-700 font-semibold leading-relaxed mt-0.5">
                  To prevent unauthorized accounts, you must verify your email address. You will <span className="underline">NOT</span> be able to sign in or be visible to warden approval flows until you verify your email.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 text-left text-xs font-bold text-slate-700 space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200 pb-2">Application Summary</h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant Name:</span>
                <span className="text-slate-800">{formData.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant Email:</span>
                <span className="text-slate-800">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admission number:</span>
                <span className="text-slate-800">{formData.admissionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verification Status:</span>
                <span className="text-amber-600 font-extrabold">PENDING OTP VERIFICATION</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate(`/verify-otp?email=${encodeURIComponent(formData.email)}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 text-xs cursor-pointer"
              >
                Proceed to Verify Email <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Main Guided Form - Cleaned Single-Column Layout (Phase 5) */
          <div className="max-w-5xl mx-auto space-y-5">
            
            <form onSubmit={handleSubmit} className="w-full space-y-5">
              
              {/* SECTION 1 — STUDENT INFORMATION */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <User className="w-5.5 h-5.5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">01. Student Information</h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Enter your primary contact, academic, and identity details.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs font-bold text-slate-700">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. j.doe@university.edu"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Phone Number</label>
                    <input
                      required
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Gender</label>
                    <NativeSelect
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Date of Birth</label>
                    <DateTimePicker
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Course / Department</label>
                    <input
                      required
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Year</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="4"
                        name="year"
                        value={formData.year}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Semester</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="8"
                        name="semester"
                        value={formData.semester}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Student ID / Admission No.</label>
                    <input
                      required
                      type="text"
                      name="admissionNumber"
                      value={formData.admissionNumber}
                      onChange={handleChange}
                      placeholder="e.g. HF-2026-903"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2 — PARENT / GUARDIAN INFORMATION */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Users className="w-5.5 h-5.5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">02. Parent / Guardian Information</h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Required to automatically create and link your parent monitoring account.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs font-bold text-slate-700">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Parent / Guardian Name</label>
                    <input
                      required
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleChange}
                      placeholder="e.g. Robert Doe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Parent Email Address</label>
                    <input
                      required
                      type="email"
                      name="parentEmail"
                      value={formData.parentEmail}
                      onChange={handleChange}
                      placeholder="e.g. guardian@parentportal.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Parent Phone Number</label>
                    <input
                      required
                      type="tel"
                      name="parentPhone"
                      value={formData.parentPhone}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876540000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Relationship to Student</label>
                    <NativeSelect
                      name="parentRelationship"
                      value={formData.parentRelationship}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Legal Guardian</option>
                    </NativeSelect>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Emergency Contact Number</label>
                    <input
                      required
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876541111"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3 — HOSTEL & ROOM PREFERENCES */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Home className="w-5.5 h-5.5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">03. Hostel & Room Preferences</h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Choose target residences. Room options filter dynamically by hostel.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs font-bold text-slate-700">
                  
                  {/* Dynamic Hostel Selection */}
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Select Target Hostel</label>
                    {fetchingHostels ? (
                      <div className="flex items-center gap-2 p-3 text-blue-600 bg-blue-50/50 rounded-lg border border-blue-100">
                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-bold">Fetching available hostels...</span>
                      </div>
                    ) : hostelError ? (
                      <div className="p-3 text-rose-700 bg-rose-50 rounded-lg border border-rose-100 text-[10px] font-bold">
                        {hostelError}
                      </div>
                    ) : (
                      <NativeSelect 
                        name="hostelId" 
                        value={formData.hostelId} 
                        onChange={handleChange} 
                        required 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                      >
                        <option value="" disabled>-- Choose target hostel --</option>
                        {hostels.map(h => (
                          <option key={h._id} value={h._id}>
                            {h.name} ({h.gender})
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </div>

                  {/* Dynamic Rooms Selection */}
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Preferred Room Choice</label>
                    {loadingRooms ? (
                      <div className="flex items-center gap-2 p-3 text-blue-600 bg-blue-50/50 rounded-lg border border-blue-100">
                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-bold">Filtering available rooms...</span>
                      </div>
                    ) : rooms.length === 0 ? (
                      <NativeSelect 
                        disabled
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-400 focus:outline-none cursor-not-allowed font-semibold"
                      >
                        <option>Auto-allocated upon Warden approval</option>
                      </NativeSelect>
                    ) : (
                      <NativeSelect 
                        name="preferredRoom"
                        value={formData.preferredRoom} 
                        onChange={handleChange} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                      >
                        <option value="">-- Choose specific room or Auto --</option>
                        {rooms.map(r => (
                          <option key={r._id} value={r.roomNumber}>
                            Room {r.roomNumber} ({r.availableBeds} beds left)
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Food Preference</label>
                    <NativeSelect
                      name="foodPreference"
                      value={formData.foodPreference}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition font-semibold"
                    >
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Non-Vegetarian">Non-Vegetarian</option>
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Preferred Floor (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      name="preferredFloor"
                      value={formData.preferredFloor}
                      onChange={handleChange}
                      placeholder="e.g. 1"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-2 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition select-none">
                    <input 
                      type="checkbox" 
                      name="sameDepartmentPreferred" 
                      checked={formData.sameDepartmentPreferred} 
                      onChange={handleChange} 
                      className="w-4 h-4 accent-blue-600 rounded border-slate-200" 
                    />
                    Prefer Same Department Roommates
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition select-none">
                    <input 
                      type="checkbox" 
                      name="sameBatchPreferred" 
                      checked={formData.sameBatchPreferred} 
                      onChange={handleChange} 
                      className="w-4 h-4 accent-blue-600 rounded border-slate-200" 
                    />
                    Prefer Same Year/Batch Roommates
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs font-bold text-slate-700">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Medical Needs</label>
                    <input
                      type="text"
                      name="medicalNeeds"
                      value={formData.medicalNeeds}
                      onChange={handleChange}
                      placeholder="e.g. Ground floor required due to knee injury"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Special Notes / Requests</label>
                    <input
                      type="text"
                      name="specialNotes"
                      value={formData.specialNotes}
                      onChange={handleChange}
                      placeholder="e.g. Quiet room preferred"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4 — ACCOUNT SECURITY (Phase 6 simplified labels) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Lock className="w-5.5 h-5.5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">04. Account Security</h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Establish credentials to access your secure resident portal.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs font-bold text-slate-700">
                  
                  {/* Password Input */}
                  <div className="relative">
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Password</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Password Strength:</span>
                          <span className={`font-black ${
                            passwordStrength.label === 'Strong' ? 'text-emerald-600' :
                            passwordStrength.label === 'Medium' ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        required
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-850 focus:outline-none focus:border-blue-600 transition placeholder:text-slate-400 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Password Matching Feedback */}
                    {formData.confirmPassword && (
                      <div className="mt-1 flex justify-end text-[9px] font-bold">
                        {formData.password === formData.confirmPassword ? (
                          <span className="text-emerald-600 flex items-center gap-0.5">✓ Passwords Match</span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-0.5">✗ Passwords Mismatch</span>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={submitting || fetchingHostels || hostels.length === 0} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting Application...
                  </span>
                ) : 'Submit Accommodation Request'}
              </button>

              <div className="text-center text-xs text-slate-500 pt-2">
                Already registered? <Link to="/login" className="text-blue-600 font-bold hover:underline">Sign In here</Link>
              </div>

            </form>

            {/* Minimal Collapsible Onboarding Guidelines & Fee Policies (Phase 5 Relocation) */}
            <details className="group bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-200">
              <summary className="flex items-center justify-between p-5 font-extrabold text-slate-800 cursor-pointer select-none hover:bg-slate-50 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600">
                    <Info size={16} />
                  </div>
                  <span className="text-xs uppercase tracking-wide">View Hostel Fees, Guidelines & Approval Process</span>
                </div>
                <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200 text-xs">▼</span>
              </summary>
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-6 text-xs font-bold text-slate-700">
                
                {/* 2-Column Responsive Strip for Fees and Process */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card 1: Estimated Hostel Fees */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <h4 className="font-extrabold text-slate-900 uppercase tracking-wide text-[10px]">Estimates & Fees</h4>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-slate-500">Security Deposit:</span>
                        <span className="text-slate-800">₹5,000</span>
                      </div>
                      <div className="flex justify-between bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-slate-500">Annual Hostel Rent:</span>
                        <span className="text-slate-800">₹24,000 - ₹36,000</span>
                      </div>
                      <div className="flex justify-between bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-slate-500">Monthly Mess Bill:</span>
                        <span className="text-slate-800">₹4,000 / month</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Approval Process */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <h4 className="font-extrabold text-slate-900 uppercase tracking-wide text-[10px]">Approval Process</h4>
                    </div>
                    <div className="space-y-3 pl-3 border-l border-slate-100 relative">
                      <div className="relative">
                        <div className="absolute -left-[16px] top-1 w-2 h-2 rounded-full bg-blue-600 border border-white" />
                        <h5 className="text-[10px] text-slate-900 font-extrabold">1. Submit Application</h5>
                        <p className="text-[9px] text-slate-400 font-semibold leading-tight">Preferences logged & OTP email verification sent.</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[16px] top-1 w-2 h-2 rounded-full bg-slate-300 border border-white" />
                        <h5 className="text-[10px] text-slate-900 font-extrabold">2. Warden Review</h5>
                        <p className="text-[9px] text-slate-400 font-semibold leading-tight">Staff audits applicant data and cohort matches.</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[16px] top-1 w-2 h-2 rounded-full bg-slate-300 border border-white" />
                        <h5 className="text-[10px] text-slate-900 font-extrabold">3. Bed Allocation</h5>
                        <p className="text-[9px] text-slate-400 font-semibold leading-tight">System allocates optimal room and roommate groups.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Policies Notice */}
                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-left flex gap-2.5 items-start">
                  <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-slate-900 uppercase tracking-wider text-[9px]">Administrative Intake Policy Notice</h5>
                    <p className="text-[9px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                      Mess rates are dynamically computed based on food preferences (Vegetarian vs Non-Vegetarian) and actual dining calendar cycles. Minor ledger adjustments up to ₹500 can be locked prior to warden locks.
                    </p>
                  </div>
                </div>

              </div>
            </details>

          </div>
        )}

      </div>
    </div>
  );
}
