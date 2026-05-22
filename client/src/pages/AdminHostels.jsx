import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';

export default function AdminHostels() {
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    hostelCode: '',
    gender: 'BOYS',
    description: '',
    totalFloors: 1
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHostels();
  }, []);

  const fetchHostels = async () => {
    try {
      const res = await api.get('/hostels');
      setHostels(res.data.hostels);
    } catch (error) {
      toast.error('Failed to fetch hostels');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/hostels', formData);
      toast.success('Hostel created successfully');
      setShowModal(false);
      setFormData({ name: '', hostelCode: '', gender: 'BOYS', description: '', totalFloors: 1 });
      fetchHostels();
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Creation failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this hostel?')) {
      try {
        await api.delete(`/hostels/${id}`);
        toast.success('Hostel deleted successfully');
        fetchHostels();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Hostel Management</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Add New Hostel
        </button>
      </div>

      {loading ? (
        <div className="text-center p-10">Loading hostels...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hostels.map(hostel => (
            <div key={hostel._id} className="bg-white p-6 rounded shadow border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{hostel.name}</h3>
                  <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-700">{hostel.hostelCode}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  hostel.gender === 'BOYS' ? 'bg-blue-100 text-blue-800' :
                  hostel.gender === 'GIRLS' ? 'bg-pink-100 text-pink-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {hostel.gender}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">{hostel.description || 'No description provided.'}</p>
              <div className="text-sm mb-4">
                <strong>Floors:</strong> {hostel.totalFloors} <br/>
                <strong>Rooms:</strong> {hostel.totalRooms} <br/>
                <strong>Warden:</strong> {hostel.warden ? hostel.warden.fullName : <span className="text-red-500 font-bold">Not Assigned</span>}
              </div>
              <div className="flex justify-end border-t pt-4">
                <button 
                  onClick={() => handleDelete(hostel._id)}
                  className="text-red-600 text-sm font-bold hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {hostels.length === 0 && <div className="col-span-full text-center p-10 text-gray-500 bg-white shadow rounded">No hostels found. Create one!</div>}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Hostel</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hostel Name</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hostel Code (e.g. H1)</label>
                <input required type="text" name="hostelCode" value={formData.hostelCode} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <NativeSelect name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="BOYS">Boys</option>
                  <option value="GIRLS">Girls</option>
                  <option value="MIXED">Mixed</option>
                </NativeSelect>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Floors</label>
                <input required type="number" min="1" name="totalFloors" value={formData.totalFloors} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
