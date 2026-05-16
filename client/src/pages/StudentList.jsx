import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      // Filter out pending and rejected for this view
      const approved = res.data.students.filter(s => s.approvalStatus === 'APPROVED');
      setStudents(approved);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Current Residents</h2>

      {loading ? (
        <div className="text-center p-10">Loading students...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map(student => (
                <tr key={student._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{student.fullName}</div>
                    <div className="text-xs text-gray-500">{student.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{student.admissionNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{student.department} (Y{student.year})</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {student.roomId ? (
                      <div className="text-sm">
                        <span className="font-bold text-blue-600">Room {student.roomId.roomNumber}</span>
                        <br/>
                        <span className="text-xs text-gray-500">Bed {student.bedNumber} | Floor {student.roomId.floor}</span>
                      </div>
                    ) : (
                      <span className="text-red-500 text-sm">Not Allocated</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Resident</span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-500">No approved residents found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
