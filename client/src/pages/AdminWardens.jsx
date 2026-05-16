import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function AdminWardens() {
  const [wardens, setWardens] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    hostelId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [wardenRes, hostelRes] = await Promise.all([
        api.get('/admin/wardens'),
        api.get('/hostels')
      ]);
      setWardens(wardenRes.data.wardens);
      
      // Only show hostels that don't have a warden
      const availableHostels = hostelRes.data.hostels.filter(h => !h.warden);
      setHostels(availableHostels);
      
      if (availableHostels.length > 0) {
        setFormData(prev => ({ ...prev, hostelId: availableHostels[0]._id }));
      }
    } catch (error) {
      toast.error('Failed to fetch data');
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
      await api.post('/admin/create-warden', formData);
      toast.success('Warden created & email sent successfully');
      setShowModal(false);
      setFormData({ fullName: '', email: '', hostelId: hostels[0]?._id || '' });
      fetchData(); // Refresh list
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Warden Management</h2>
        <button 
          onClick={() => {
            if (hostels.length === 0) {
              toast.error('Please create a hostel without a warden first!');
              return;
            }
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Assign New Warden
        </button>
      </div>

      {loading ? (
        <div className="text-center p-10">Loading wardens...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Hostel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {wardens.map(warden => (
                <tr key={warden._id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{warden.fullName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{warden.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {warden.hostelId ? (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">
                        {warden.hostelId.name} ({warden.hostelId.hostelCode})
                      </span>
                    ) : (
                      <span className="text-red-500 font-bold">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                  </td>
                </tr>
              ))}
              {wardens.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-gray-500">No wardens found. Assign one!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create & Assign Warden</h3>
            <p className="text-sm text-gray-500 mb-4">An email with temporary credentials will be sent.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Assign to Hostel</label>
                <select name="hostelId" value={formData.hostelId} onChange={handleChange} required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {hostels.map(h => (
                    <option key={h._id} value={h._id}>{h.name} ({h.hostelCode})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Warden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
