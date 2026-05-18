import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Edit2, Trash2, Key, Users, Home } from 'lucide-react';

export default function AdminWardens() {
  const [wardens, setWardens] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWarden, setSelectedWarden] = useState(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    hostelId: ''
  });

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    password: '',
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

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/create-warden', formData);
      toast.success('Warden created & credentials email sent successfully');
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

  const handleEditClick = (warden) => {
    setSelectedWarden(warden);
    setEditFormData({
      fullName: warden.fullName,
      email: warden.email,
      password: '',
      hostelId: warden.hostelId?._id || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        fullName: editFormData.fullName,
        email: editFormData.email,
        hostelId: editFormData.hostelId || null
      };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }
      await api.put(`/admin/wardens/${selectedWarden._id}`, payload);
      toast.success('Warden account updated successfully');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (warden) => {
    const confirm = window.confirm(`Are you absolutely sure you want to permanently delete warden "${warden.fullName}"?\n\nAll student profiles, room layouts, billing invoices, and attendance logs under their assigned hostel will remain 100% intact.`);
    if (!confirm) return;

    try {
      await api.delete(`/admin/wardens/${warden._id}`);
      toast.success('Warden account deleted. Hostel data preserved.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Users className="text-blue-500" size={24} />
            Warden Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Safely assign, edit credentials, reassign, or delete warden roles with zero hostel data loss.
          </p>
        </div>
        <button 
          onClick={() => {
            if (hostels.length === 0) {
              toast.error('Please create a hostel without a warden first!');
              return;
            }
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md cursor-pointer flex items-center gap-2"
        >
          + Assign New Warden
        </button>
      </div>

      {loading ? (
        <div className="text-center p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-slate-550 dark:text-zinc-400 font-bold">
          Loading warden directories...
        </div>
      ) : (
        <div className="overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
              <thead className="bg-slate-50 dark:bg-zinc-950/40">
                <tr className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4 text-left">Warden Name</th>
                  <th className="px-6 py-4 text-left">Email Address</th>
                  <th className="px-6 py-4 text-left">Assigned Hostel</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300">
                {wardens.map(warden => (
                  <tr key={warden._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-black text-slate-900 dark:text-white">{warden.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-zinc-400">{warden.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {warden.hostelId ? (
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-650 dark:text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-blue-100 dark:border-blue-500/20">
                          <Home size={10} />
                          {warden.hostelId.name} ({warden.hostelId.hostelCode})
                        </span>
                      ) : (
                        <span className="inline-flex bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-450 px-2.5 py-1 rounded-lg text-[10px] font-black border border-rose-100 dark:border-rose-500/20">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(warden)}
                          className="p-1.5 text-blue-600 dark:text-blue-450 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-transparent hover:border-blue-100 dark:hover:border-blue-500/20 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                          title="Edit Account Details"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(warden)}
                          className="p-1.5 text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                          title="Permanently Terminate Warden"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {wardens.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-450 dark:text-zinc-500 font-bold italic">
                      No wardens mapped in the directory. Create and assign one to get started!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150 text-slate-800 dark:text-zinc-100">
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="text-blue-500" size={20} />
              Create & Assign Warden
            </h3>
            <p className="text-[11px] text-slate-450 dark:text-zinc-400 mt-1 mb-5">
              Creates a secure profile and dispatches an institutional welcome email with temporary credentials automatically.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Full Name</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium" placeholder="Warden Staff Name" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Email Address</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium" placeholder="staff@hostelflow.edu" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Hostel Allocation</label>
                <select name="hostelId" value={formData.hostelId} onChange={handleChange} required className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-bold">
                  {hostels.map(h => (
                    <option key={h._id} value={h._id}>{h.name} ({h.hostelCode})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 cursor-pointer">
                  {submitting ? 'Creating...' : 'Assign Warden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Update Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150 text-slate-800 dark:text-zinc-100">
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="text-blue-500" size={18} />
              Update Warden Settings
            </h3>
            <p className="text-[11px] text-slate-455 dark:text-zinc-400 mt-1 mb-5">
              Modify account attributes, force password updates, or adjust hostel re-assignments seamlessly.
            </p>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Full Name</label>
                <input required type="text" name="fullName" value={editFormData.fullName} onChange={handleEditChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Email Address</label>
                <input required type="email" name="email" value={editFormData.email} onChange={handleEditChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Key size={12} className="text-slate-400" />
                  Reset Password <span className="text-[10px] text-slate-450 font-medium">(Leave blank to keep current)</span>
                </label>
                <input type="password" name="password" value={editFormData.password} onChange={handleEditChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium" placeholder="••••••••" minLength={6} />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 mb-1">Hostel Allocation</label>
                <select name="hostelId" value={editFormData.hostelId} onChange={handleEditChange} className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-bold">
                  <option value="">-- Unassigned (Free Floating) --</option>
                  {[
                    ...(selectedWarden?.hostelId ? [selectedWarden.hostelId] : []),
                    ...hostels
                  ].map(h => (
                    <option key={h._id} value={h._id}>{h.name} ({h.hostelCode})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 cursor-pointer">
                  {submitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
