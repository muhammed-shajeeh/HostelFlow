import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

export default function Rooms() {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState(user?.hostelId || '');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    hostelId: user?.hostelId || '',
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
      // For Wardens, selectedHostel is already initialized to user.hostelId,
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => {
            const occupancyPct = Math.round((room.occupiedBeds / room.capacity) * 100);
            return (
              <div key={room._id} className="bg-white p-6 rounded shadow border relative overflow-hidden">
                {/* Occupancy Indicator Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-200">
                  <div className={`h-full ${occupancyPct === 100 ? 'bg-red-500' : occupancyPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${occupancyPct}%` }}></div>
                </div>

                <div className="flex justify-between items-start mb-4 mt-2">
                  <div>
                    <h3 className="text-xl font-bold">Room {room.roomNumber}</h3>
                    <span className="text-xs text-gray-500">Floor {room.floor}</span>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">
                    {room.roomType}
                  </span>
                </div>
                
                <div className="text-sm mb-4 space-y-1">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Capacity:</span>
                    <span className="font-bold">{room.capacity} Beds</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Occupied:</span>
                    <span className="font-bold text-red-600">{room.occupiedBeds} Beds</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-bold text-green-600">{room.availableBeds} Beds</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-xs text-gray-500">{room.students.length} Students Assigned</span>
                  <button onClick={() => handleDelete(room._id)} className="text-red-600 text-sm font-bold hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && <div className="col-span-full text-center p-10 text-gray-500 bg-white shadow rounded">No rooms found in this hostel.</div>}
        </div>
      )}

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
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
