import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function PendingStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();

    const handleRefresh = (e) => {
      console.log('[Pending Students] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStudents();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    window.addEventListener('erp:studentApproved', handleRefresh);

    return () => {
      window.removeEventListener('erp:refresh', handleRefresh);
      window.removeEventListener('erp:studentApproved', handleRefresh);
    };
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students/pending');
      setStudents(res.data.students);
    } catch (error) {
      toast.error('Failed to fetch pending students');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/students/${id}/approve`);
      toast.success(res.data.message);
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (id) => {
    if (window.confirm('Are you sure you want to reject this application?')) {
      try {
        await api.post(`/students/${id}/reject`);
        toast.success('Application rejected');
        fetchStudents();
      } catch (error) {
        toast.error('Rejection failed');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Pending Student Approvals</h2>
      
      {loading ? (
        <div className="text-center p-10">Loading pending requests...</div>
      ) : (
        <div className="space-y-4">
          {students.map(student => (
            <div key={student._id} className="bg-white p-6 rounded shadow border flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold">{student.fullName}</h3>
                <div className="text-sm text-gray-600 mt-1 space-y-1">
                  <div><strong>Email:</strong> {student.email}</div>
                  <div><strong>Department:</strong> {student.department} (Year: {student.year})</div>
                  <div><strong>Admission No:</strong> {student.admissionNumber}</div>
                  {student.studentPreferences?.specialNotes && (
                    <div className="text-yellow-600 bg-yellow-50 p-2 rounded mt-2 text-xs">
                      <strong>Notes:</strong> {student.studentPreferences.specialNotes}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleReject(student._id)}
                  className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded transition"
                >
                  Reject
                </button>
                <button 
                  onClick={() => handleApprove(student._id)}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-bold rounded transition shadow"
                >
                  Approve & Allocate Room
                </button>
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="text-center p-10 bg-white shadow border rounded text-gray-500">
              No pending approvals at the moment.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
