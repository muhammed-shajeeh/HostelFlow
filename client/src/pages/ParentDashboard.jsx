import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

export default function ParentDashboard() {
  const { user } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Phase 9: Redirect if password change is forced
    if (user?.mustChangePassword) {
      navigate('/parent/change-password');
      return;
    }

    const fetchStudents = async () => {
      try {
        const res = await api.get('/parent/students');
        setStudents(res.data.students);
      } catch (error) {
        toast.error('Failed to load linked students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [user, navigate]);

  if (loading) return <div className="p-10 text-center">Loading Guardian Dashboard...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Guardian Dashboard</h2>
          <p className="text-gray-500">Welcome, {user?.fullName}. You are monitoring {students.length} student(s).</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-blue-50 p-10 rounded-xl text-center border-2 border-dashed border-blue-200">
          <h3 className="text-xl font-bold text-blue-800 mb-2">No Students Linked</h3>
          <p className="text-blue-600">Please contact the hostel administration if you believe this is an error.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => (
            <div key={student._id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl uppercase shadow-inner">
                    {student.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{student.fullName}</h3>
                    <p className="text-blue-100 text-sm">{student.admissionNumber}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase font-bold">Hostel</p>
                    <p className="font-bold text-gray-800 truncate">{student.hostelId?.name || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase font-bold">Room</p>
                    <p className="font-bold text-gray-800">{student.roomId?.roomNumber || 'TBA'}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <Link 
                    to={`/parent/student/${student._id}`}
                    className="block w-full text-center bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition"
                  >
                    View Monitoring Data
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency Leave Notice */}
      <div className="mt-10 bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm">
        <div className="flex gap-4">
          <div className="text-red-500 text-3xl">🚨</div>
          <div>
            <h4 className="text-lg font-bold text-red-800">Emergency Protocol</h4>
            <p className="text-red-700">Any emergency leave requests submitted by your children will appear here for your immediate approval. Your approval is mandatory before the Warden can finalize the exit pass.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
