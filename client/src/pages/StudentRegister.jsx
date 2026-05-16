import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api'; // This uses the base URL configured in api/index.js
import toast from 'react-hot-toast';

export default function StudentRegister() {
  const navigate = useNavigate();
  
  // State for storing the list of hostels fetched from backend
  const [hostels, setHostels] = useState([]);
  
  // UI states for loading and error handling
  const [fetchingHostels, setFetchingHostels] = useState(true);
  const [hostelError, setHostelError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Main form state
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', 
    department: '', year: '1', semester: '1', 
    admissionNumber: '', parentName: '', parentEmail: '', 
    hostelId: '', // Will store the actual MongoDB _id
    sameDepartmentPreferred: false,
    sameBatchPreferred: false,
    preferredFloor: '',
    medicalNeeds: '',
    specialNotes: ''
  });

  // useEffect runs ONCE when the component mounts to fetch hostels
  useEffect(() => {
    let isMounted = true; // Optimization: prevent setting state on unmounted component

    const fetchHostels = async () => {
      try {
        setFetchingHostels(true);
        setHostelError('');
        
        // Fetch real backend data from MongoDB
        const res = await api.get('/hostels'); 
        
        if (isMounted) {
          if (res.data.hostels && res.data.hostels.length > 0) {
            setHostels(res.data.hostels);
            // Auto-select the first hostel to prevent empty submissions
            setFormData(prev => ({...prev, hostelId: res.data.hostels[0]._id}));
          } else {
            setHostelError('No hostels currently available.');
          }
        }
      } catch (err) {
        if (isMounted) {
          // Handle server unavailable or API failure securely
          console.error('Hostel fetch error:', err);
          setHostelError(
            err.response?.status === 401 
              ? 'Unauthorized to fetch hostels. Please contact administrator.' 
              : 'Failed to connect to the server. Please try again later.'
          );
          toast.error('Failed to load hostels');
        }
      } finally {
        if (isMounted) {
          setFetchingHostels(false);
        }
      }
    };

    fetchHostels();

    // Cleanup function
    return () => { isMounted = false; };
  }, []);

  // Universal change handler for inputs and checkboxes
  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  // Submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.hostelId) {
      return toast.error('Please select a valid hostel.');
    }

    setSubmitting(true);
    try {
      // Sends data to our student controller
      const res = await api.post('/students/register', formData);
      if (res.data.success) {
        toast.success(res.data.message);
        // Navigate to OTP page, passing the email via URL parameters
        navigate(`/verify-otp?email=${encodeURIComponent(formData.email)}`);
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        // Validation errors from express-validator
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        // Generic server error
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-10 min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded shadow-xl w-full max-w-2xl">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">Student Registration</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Full Name</label>
              <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Email</label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Password</label>
              <input required type="password" name="password" minLength="6" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Admission Number</label>
              <input required type="text" name="admissionNumber" value={formData.admissionNumber} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
          </div>

          {/* Academic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-bold mb-1">Department</label>
              <input required type="text" name="department" value={formData.department} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Year</label>
              <input required type="number" min="1" max="4" name="year" value={formData.year} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Semester</label>
              <input required type="number" min="1" max="8" name="semester" value={formData.semester} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
          </div>

          {/* Parent Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-bold mb-1">Parent Name</label>
              <input type="text" name="parentName" value={formData.parentName} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Parent Email</label>
              <input type="email" name="parentEmail" value={formData.parentEmail} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
            </div>
          </div>

          {/* Hostel Allocation Preferences Section */}
          <div className="border-t pt-4 bg-gray-50 p-4 rounded mt-4">
            <h3 className="text-lg font-bold mb-4">Hostel Allocation Preferences</h3>
            
            {/* Dynamic Hostel Selection */}
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Select Target Hostel</label>
              
              {fetchingHostels ? (
                // Loading spinner UI
                <div className="flex items-center gap-2 p-2 text-blue-600 bg-blue-50 rounded border border-blue-200">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Fetching available hostels...</span>
                </div>
              ) : hostelError ? (
                // Error handling UI
                <div className="p-3 text-red-700 bg-red-50 rounded border border-red-200 text-sm font-medium">
                  {hostelError}
                </div>
              ) : (
                // Success UI with real MongoDB data
                <select 
                  name="hostelId" 
                  value={formData.hostelId} 
                  onChange={handleChange} 
                  required 
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white transition"
                >
                  <option value="" disabled>-- Choose your Hostel --</option>
                  {hostels.map(h => (
                    // Using actual MongoDB _id values
                    <option key={h._id} value={h._id}>
                      {h.name} ({h.gender})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-6 mb-4 mt-6">
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer hover:text-blue-600 transition">
                <input type="checkbox" name="sameDepartmentPreferred" checked={formData.sameDepartmentPreferred} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
                Prefer Same Department Roommates
              </label>
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer hover:text-blue-600 transition">
                <input type="checkbox" name="sameBatchPreferred" checked={formData.sameBatchPreferred} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
                Prefer Same Year/Batch Roommates
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-bold mb-1">Preferred Floor (Optional)</label>
                <input type="number" min="1" name="preferredFloor" value={formData.preferredFloor} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Medical Needs</label>
                <input type="text" name="medicalNeeds" placeholder="e.g. Ground floor required due to injury" value={formData.medicalNeeds} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={submitting || fetchingHostels || hostels.length === 0} 
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting Application...
              </span>
            ) : 'Apply for Hostel'}
          </button>
          
          <div className="text-center text-sm mt-4">
            Already registered? <Link to="/login" className="text-blue-600 font-bold hover:underline">Login here</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
