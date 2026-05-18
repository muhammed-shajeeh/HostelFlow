import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

export default function Rooms() {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  // user.hostelId is a populated object {_id, name, ...} after getMe populate().
  // We must extract ._id for use in API URLs and state comparisons.
  const [selectedHostel, setSelectedHostel] = useState(user?.hostelId?._id || '');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    hostelId: user?.hostelId?._id || '', // Extract ._id from populated object,
    roomNumber: '',
    floor: 1,
    capacity: 2,
    roomType: 'DOUBLE',
    gender: 'BOYS'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitData();
  }, []);

  useEffect(() => {
    if (selectedHostel) fetchRooms(selectedHostel);

    const handleRefresh = (e) => {
      console.log('[Room Management] Live Real-time Refresh Event Triggered:', e.detail);
      if (selectedHostel) fetchRooms(selectedHostel);
    };

    window.addEventListener('erp:refresh', handleRefresh);
    window.addEventListener('erp:roomTransferred', handleRefresh);
    window.addEventListener('erp:studentApproved', handleRefresh);

    return () => {
      window.removeEventListener('erp:refresh', handleRefresh);
      window.removeEventListener('erp:roomTransferred', handleRefresh);
      window.removeEventListener('erp:studentApproved', handleRefresh);
    };
  }, [selectedHostel]);

  const fetchInitData = async () => {
    try {
      if (user.role === 'ADMIN') {
        const hRes = await api.get('/hostels');
        setHostels(hRes.data.hostels);
        if (hRes.data.hostels.length > 0 && !selectedHostel) {
          setSelectedHostel(hRes.data.hostels[0]._id);
          setFormData(prev => ({ ...prev, hostelId: hRes.data.hostels[0]._id }));
        }
      }
      // For Wardens, selectedHostel is already initialized to user.hostelId._id (the string ID),
      // so the second useEffect will handle the initial fetch automatically.
    } catch (error) {
      toast.error('Failed to initialize data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async (hostelId) => {
    setLoading(true);
    try {
      const res = await api.get(`/rooms/hostel/${hostelId}`);
      setRooms(res.data.rooms);
    } catch (error) {
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/rooms', formData);
      toast.success('Room created successfully');
      setShowModal(false);
      fetchRooms(selectedHostel);
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
    if (window.confirm('Are you sure you want to delete this room?')) {
      try {
        await api.delete(`/rooms/${id}`);
        toast.success('Room deleted successfully');
        fetchRooms(selectedHostel);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Room Management</h2>
        <button 
          onClick={() => {
            if (!selectedHostel) return toast.error('Select a hostel first');
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Add New Room
        </button>
      </div>

      {user.role === 'ADMIN' && (
        <div className="mb-6 bg-white p-4 rounded shadow border flex items-center gap-4">
          <label className="font-bold text-gray-700">Select Hostel:</label>
          <select 
            value={selectedHostel} 
            onChange={(e) => {
              setSelectedHostel(e.target.value);
              setFormData(prev => ({ ...prev, hostelId: e.target.value }));
            }}
            className="p-2 border rounded focus:ring-2 focus:ring-blue-500 flex-1"
          >
            {hostels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center p-10">Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center p-10 text-gray-500 bg-white shadow rounded border">No rooms found in this hostel.</div>
      ) : (
        <div className="space-y-8">
          {[...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b).map(floor => (
            <div key={floor} className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="bg-gray-800 text-white p-4 font-bold text-lg flex justify-between items-center">
                <span>Floor {floor}</span>
                <span className="text-sm bg-gray-700 px-3 py-1 rounded">
                  {rooms.filter(r => r.floor === floor).length} Rooms
                </span>
              </div>
              <div className="p-6 bg-gray-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.filter(r => r.floor === floor).map(room => {
                  const occupancyPct = Math.round((room.occupiedBeds / room.capacity) * 100);
                  return (
                    <div key={room._id} className="bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition relative overflow-hidden">
                      {/* Occupancy Indicator Bar */}
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
                        <div className={`h-full ${occupancyPct === 100 ? 'bg-red-500' : occupancyPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${occupancyPct}%` }}></div>
                      </div>

                      <div className="flex justify-between items-start mb-4 mt-2">
                        <div>
                          <h3 className="text-2xl font-black text-gray-800">Room {room.roomNumber}</h3>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">{room.gender} • {room.roomType}</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${occupancyPct === 100 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {occupancyPct === 100 ? 'FULL' : 'AVAILABLE'}
                        </span>
                      </div>
                      
                      <div className="text-sm mb-4 space-y-2 bg-gray-50 p-3 rounded">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-bold">{room.capacity} Beds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Occupied:</span>
                          <span className="font-bold text-red-600">{room.occupiedBeds} Beds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Available:</span>
                          <span className="font-bold text-green-600">{room.availableBeds} Beds</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t pt-4">
                        <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">{room.students.length} Assigned</span>
                        <button onClick={() => handleDelete(room._id)} className="text-red-500 text-sm font-bold hover:text-red-700 transition">
                          Delete Room
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Room</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Room Number</label>
                <input required type="text" name="roomNumber" value={formData.roomNumber} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Floor</label>
                  <input required type="number" min="1" name="floor" value={formData.floor} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Capacity</label>
                  <input required type="number" min="1" max="10" name="capacity" value={formData.capacity} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Room Type</label>
                  <select name="roomType" value={formData.roomType} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none">
                    <option value="SINGLE">Single</option>
                    <option value="DOUBLE">Double</option>
                    <option value="TRIPLE">Triple</option>
                    <option value="DORMITORY">Dormitory</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Gender Focus</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:outline-none">
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100 cancel">Cancel</button>
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
