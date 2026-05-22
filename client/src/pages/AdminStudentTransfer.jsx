import { useState, useEffect } from 'react';
import { 
  Search, ArrowRight, Home, Bed, User, AlertCircle, CheckCircle, 
  RefreshCw, FileText, ChevronRight, Layers, Users 
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';

export default function AdminStudentTransfer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState([]);
  
  // Selected student & current state
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Hostels & Destination selection state
  const [hostels, setHostels] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingHostels, setLoadingHostels] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingOccupants, setLoadingOccupants] = useState(false);
  const [occupiedBeds, setOccupiedBeds] = useState([]);
  
  // Form selections
  const [destHostelId, setDestHostelId] = useState('');
  const [destRoomId, setDestRoomId] = useState('');
  const [destBedNumber, setDestBedNumber] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick reasons
  const QUICK_REASONS = [
    'Room upgrade',
    'Maintenance',
    'Discipline',
    'Medical',
    'Mutual exchange',
    'Administrative reassignment'
  ];

  // Load active hostels on mount
  useEffect(() => {
    fetchHostels();
  }, []);

  const fetchHostels = async () => {
    setLoadingHostels(true);
    try {
      const res = await api.get('/hostels');
      if (res.data.success) {
        setHostels(res.data.hostels.filter(h => h.isActive));
      }
    } catch (err) {
      toast.error('Failed to load hostels list');
    } finally {
      setLoadingHostels(false);
    }
  };

  // Search trigger
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/admin/students/search?query=${encodeURIComponent(searchQuery)}`);
      if (res.data.success) {
        setStudents(res.data.students);
        if (res.data.students.length === 0) {
          toast.error('No matching allocated students found');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search request failed');
    } finally {
      setSearching(false);
    }
  };

  // Handle student selection
  const selectStudent = (student) => {
    setSelectedStudent(student);
    setDestHostelId('');
    setDestRoomId('');
    setDestBedNumber('');
    setAvailableRooms([]);
    setOccupiedBeds([]);
  };

  // Load available rooms when destHostelId changes
  useEffect(() => {
    if (!destHostelId) {
      setAvailableRooms([]);
      return;
    }
    fetchRooms(destHostelId);
  }, [destHostelId]);

  const fetchRooms = async (hostelId) => {
    setLoadingRooms(true);
    try {
      // API call returns available rooms
      const res = await api.get(`/rooms/available/${hostelId}`);
      if (res.data.success) {
        setAvailableRooms(res.data.rooms);
      }
    } catch (err) {
      toast.error('Failed to load available rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  // Load occupied beds when destRoomId changes
  useEffect(() => {
    if (!destRoomId) {
      setOccupiedBeds([]);
      return;
    }
    fetchRoomOccupants(destRoomId);
  }, [destRoomId]);

  const fetchRoomOccupants = async (roomId) => {
    setLoadingOccupants(true);
    try {
      const res = await api.get(`/rooms/${roomId}`);
      if (res.data.success && res.data.room?.students) {
        // Collect currently occupied beds
        const occupied = res.data.room.students
          .map(s => s.bedNumber || s.bed)
          .filter(Boolean);
        setOccupiedBeds(occupied);
      }
    } catch (err) {
      toast.error('Failed to load room bed mappings');
    } finally {
      setLoadingOccupants(false);
    }
  };

  // Submit Hostel Transfer
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !destHostelId || !destRoomId || !destBedNumber) {
      toast.error('Please complete all selection steps.');
      return;
    }
    if (!transferReason.trim()) {
      toast.error('Please provide a transfer reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/admin/students/${selectedStudent._id}/transfer`, {
        newHostelId: destHostelId,
        newRoomId: destRoomId,
        newBedNumber: Number(destBedNumber),
        reason: transferReason
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Student transferred successfully!');
        
        // Reset state
        setSelectedStudent(null);
        setDestHostelId('');
        setDestRoomId('');
        setDestBedNumber('');
        setTransferReason('');
        setStudents([]);
        setSearchQuery('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed. Check bed status.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHostelData = hostels.find(h => h._id === destHostelId);
  const selectedRoomData = availableRooms.find(r => r._id === destRoomId);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 safe-bottom-padding">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <RefreshCw className="text-blue-500 animate-spin-slow" />
            Student Hostel Transfer
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Perform zero-downtime, atomically validated student reassignments between hostels, floors, rooms, and beds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search & Select Student */}
        <div className="lg:col-span-5 space-y-6">
          {/* Student Search Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            <h2 className="text-md font-bold mb-4 text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Search size={18} className="text-slate-400" />
              1. Search and Select Student
            </h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Name, admission no., room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 border rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1 cursor-pointer transition-all"
              >
                {searching ? <RefreshCw size={16} className="animate-spin" /> : 'Search'}
              </button>
            </form>

            {/* Students Search Results */}
            <div className="mt-4 space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {students.length > 0 ? (
                students.map((student) => (
                  <div
                    key={student._id}
                    onClick={() => selectStudent(student)}
                    className={`p-3 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${
                      selectedStudent?._id === student._id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-zinc-150">{student.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Adm: <span className="font-semibold">{student.admissionNumber || 'N/A'}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 flex items-center gap-1">
                        <Home size={12} />
                        {student.hostelId?.name || 'Unassigned'} • Room {student.roomId?.roomNumber || 'N/A'} (Bed {student.bedNumber || 'N/A'})
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                ))
              ) : searchQuery && !searching ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No matching active students found.
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                  Search by student name or admission number to load details.
                </div>
              )}
            </div>
          </div>

          {/* Current Allocation Information Panel */}
          {selectedStudent && (
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-inner">
              <h3 className="text-xs font-black tracking-wider text-slate-400 dark:text-zinc-500 uppercase mb-3">
                Current Allocation Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/50 dark:border-zinc-800/50">
                  <span className="text-slate-500 dark:text-zinc-400">Full Name</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-150">{selectedStudent.fullName}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/50 dark:border-zinc-800/50">
                  <span className="text-slate-500 dark:text-zinc-400">Admission No.</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-150">{selectedStudent.admissionNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/50 dark:border-zinc-800/50">
                  <span className="text-slate-500 dark:text-zinc-400">Current Hostel</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedStudent.hostelId?.name || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/50 dark:border-zinc-800/50">
                  <span className="text-slate-500 dark:text-zinc-400">Room & Floor</span>
                  <span className="font-bold text-slate-850 dark:text-zinc-100">
                    Room {selectedStudent.roomId?.roomNumber || 'N/A'} (Floor {selectedStudent.roomId?.floor || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-500 dark:text-zinc-400">Current Bed</span>
                  <span className="font-bold text-slate-850 dark:text-zinc-100">Bed #{selectedStudent.bedNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Destination & Transfer Details */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedStudent ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl min-h-[400px] text-center">
              <User size={48} className="text-slate-300 dark:text-zinc-700 animate-pulse mb-4" />
              <h3 className="text-md font-bold text-slate-700 dark:text-zinc-300">No Student Selected</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs mt-1">
                Select a student from the search list to configure their new hostel and room transfer details.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTransferSubmit} className="space-y-6">
              {/* Transfer Target Wizard */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
                <h2 className="text-md font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-zinc-800">
                  <Layers size={18} className="text-blue-500" />
                  2. Select New Destination Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Hostel */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-2">
                      Destination Hostel
                    </label>
                    <NativeSelect
                      value={destHostelId}
                      onChange={(e) => {
                        setDestHostelId(e.target.value);
                        setDestRoomId('');
                        setDestBedNumber('');
                      }}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">-- Choose Hostel --</option>
                      {hostels.map(hostel => (
                        <option key={hostel._id} value={hostel._id}>
                          {hostel.name} ({hostel.gender} block)
                        </option>
                      ))}
                    </NativeSelect>
                    {/* Gender mismatch notice */}
                    {selectedHostelData && selectedStudent.hostelId?.gender && selectedHostelData.gender !== selectedStudent.hostelId.gender && selectedHostelData.gender !== 'MIXED' && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Caution: Transferring between {selectedStudent.hostelId.gender} and {selectedHostelData.gender} blocks requires careful validation.</span>
                      </div>
                    )}
                  </div>

                  {/* Select Room */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-2">
                      Available Rooms
                    </label>
                    <NativeSelect
                      value={destRoomId}
                      onChange={(e) => {
                        setDestRoomId(e.target.value);
                        setDestBedNumber('');
                      }}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                      disabled={!destHostelId || loadingRooms}
                      required
                    >
                      <option value="">-- Choose Room --</option>
                      {availableRooms.map(room => (
                        <option key={room._id} value={room._id}>
                          Room {room.roomNumber} (Floor {room.floor} - {room.roomType}) [{room.availableBeds} beds left]
                        </option>
                      ))}
                    </NativeSelect>
                    {loadingRooms && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> Loading rooms...
                      </p>
                    )}
                  </div>
                </div>

                {/* Bed Selector grid */}
                {destRoomId && selectedRoomData && (
                  <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-850 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
                        Choose Available Bed
                      </span>
                      {loadingOccupants && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <RefreshCw size={10} className="animate-spin" /> Verifying...
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {Array.from({ length: selectedRoomData.capacity }).map((_, i) => {
                        const bedNum = i + 1;
                        const isCurrentBed = selectedStudent.roomId?._id === destRoomId && selectedStudent.bedNumber === bedNum;
                        const isOccupied = occupiedBeds.includes(bedNum);
                        
                        let btnStyle = "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 hover:border-blue-500";
                        if (isCurrentBed) {
                          btnStyle = "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 cursor-not-allowed";
                        } else if (isOccupied) {
                          btnStyle = "border-red-200 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 cursor-not-allowed opacity-60";
                        } else if (String(destBedNumber) === String(bedNum)) {
                          btnStyle = "border-blue-600 bg-blue-600 text-white font-black ring-2 ring-blue-200";
                        }

                        return (
                          <button
                            key={bedNum}
                            type="button"
                            disabled={isOccupied || isCurrentBed || loadingOccupants}
                            onClick={() => setDestBedNumber(String(bedNum))}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[50px] ${btnStyle}`}
                          >
                            <Bed size={14} />
                            <span>B-{bedNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Reason Select/Inputs */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
                    Reason for Transfer
                  </label>
                  
                  {/* Quick select buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_REASONS.map(reason => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setTransferReason(reason)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          transferReason === reason
                            ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400'
                            : 'bg-white border-slate-200 text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 hover:bg-slate-50'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Enter detailed reason for student hostel transfer..."
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Transfer Summary confirmation card */}
              {destHostelId && destRoomId && destBedNumber && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 md:p-6 text-white shadow-lg space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider opacity-90 flex items-center gap-1.5">
                    <CheckCircle size={16} />
                    Atomic Transfer Preview
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-4 text-center md:text-left">
                    <div className="md:col-span-5 bg-white/10 p-3.5 rounded-xl border border-white/10 backdrop-blur-xs">
                      <p className="text-[10px] uppercase font-bold opacity-60">Source Location</p>
                      <p className="font-extrabold text-sm mt-1 truncate">{selectedStudent.hostelId?.name || 'Unassigned'}</p>
                      <p className="text-xs font-semibold opacity-90 mt-0.5">
                        Room {selectedStudent.roomId?.roomNumber || 'N/A'} • Bed #{selectedStudent.bedNumber || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="md:col-span-1 flex justify-center">
                      <ArrowRight size={24} className="text-white/60 rotate-90 md:rotate-0" />
                    </div>

                    <div className="md:col-span-5 bg-white/15 p-3.5 rounded-xl border border-white/20 backdrop-blur-xs">
                      <p className="text-[10px] uppercase font-bold opacity-60">Destination Location</p>
                      <p className="font-extrabold text-sm mt-1 truncate">{selectedHostelData?.name}</p>
                      <p className="text-xs font-semibold opacity-90 mt-0.5">
                        Room {selectedRoomData?.roomNumber} • Bed #{destBedNumber}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-xs max-w-sm">
                      <span className="font-bold opacity-75">Reason:</span> <span className="opacity-95 italic">"{transferReason}"</span>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-6 py-2.5 bg-white text-blue-700 font-black rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm transition-all cursor-pointer shadow-md flex justify-center items-center gap-1.5"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin text-blue-700" />
                          Processing...
                        </>
                      ) : (
                        'Confirm Transfer'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
