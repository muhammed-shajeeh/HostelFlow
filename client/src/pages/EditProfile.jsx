import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';

export default function EditProfile() {
  const { user, login, token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    department: '',
    year: '',
    semester: '',
    parentName: '',
    parentEmail: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        department: user.department || '',
        year: user.year || '',
        semester: user.semester || '',
        parentName: user.parentName || '',
        parentEmail: user.parentEmail || ''
      });
    }
  }, [user]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.put('/auth/profile', formData);
      toast.success('Profile updated successfully');
      login(token, res.data.user); // Update global context securely
      navigate('/profile');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Edit Profile</h2>
        <button 
          onClick={() => navigate('/profile')} 
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow border">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <h3 className="text-lg font-bold border-b pb-2 mb-4 text-gray-700">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleChange} 
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>
          </div>

          {user?.role === 'STUDENT' && (
            <>
              <div>
                <h3 className="text-lg font-bold border-b pb-2 mb-4 mt-6 text-gray-700">Academic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department / Course</label>
                    <input 
                      type="text" 
                      name="department" 
                      value={formData.department} 
                      onChange={handleChange} 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year of Study</label>
                    <NativeSelect 
                      name="year" 
                      value={formData.year} 
                      onChange={handleChange}
                      className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <input 
                      type="number" 
                      min="1"
                      max="10"
                      name="semester" 
                      value={formData.semester} 
                      onChange={handleChange} 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold border-b pb-2 mb-4 mt-6 text-gray-700">Parent / Guardian Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                    <input 
                      type="text" 
                      name="parentName" 
                      value={formData.parentName} 
                      onChange={handleChange} 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Email</label>
                    <input 
                      type="email" 
                      name="parentEmail" 
                      value={formData.parentEmail} 
                      onChange={handleChange} 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={submitting}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow font-bold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
