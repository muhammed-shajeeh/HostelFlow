import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeftRight, History, X, RefreshCw, AlertCircle, CheckSquare, ShieldCheck, HelpCircle, Users, Archive, UserX, RotateCcw, Download } from 'lucide-react';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Reassignment Modal States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History Modal States
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // High-performance search and filtering state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Active Tab & Archival Workflow States
  const [activeTab, setActiveTab] = useState('current');
  const [archivedStudents, setArchivedStudents] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [selectedVacateStudent, setSelectedVacateStudent] = useState(null);
  const [vacateReason, setVacateReason] = useState('');
  const [selectedRestoreStudent, setSelectedRestoreStudent] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchArchivedStudents();
  }, []);

  useEffect(() => {
    const handleRoomTransferred = (e) => {
      const transfer = e.detail;
      setStudents(prev => {
        return prev.map(s => {
          if (s._id === transfer.studentId) {
            return {
              ...s,
              roomId: s.roomId ? {
                ...s.roomId,
                _id: transfer.newRoomId,
                roomNumber: transfer.newRoomNumber
              } : {
                _id: transfer.newRoomId,
                roomNumber: transfer.newRoomNumber
              },
              bedNumber: transfer.newBedNumber
            };
          }
          return s;
        });
      });
    };

    const handleStudentApproved = (e) => {
      const student = e.detail;
      setStudents(prev => {
        if (prev.some(s => s._id === student.studentId)) return prev;
        return [...prev, {
          _id: student.studentId,
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          hostelId: student.hostelId,
          roomId: {
            _id: student.roomId,
            roomNumber: student.roomNumber
          },
          bedNumber: student.bedNumber,
          approvalStatus: 'APPROVED'
        }];
      });
    };

    const handleRefresh = (e) => {
      fetchStudents();
      fetchArchivedStudents();
    };

    window.addEventListener('erp:roomTransferred', handleRoomTransferred);
    window.addEventListener('erp:studentApproved', handleStudentApproved);
    window.addEventListener('erp:refresh', handleRefresh);
    return () => {
      window.removeEventListener('erp:roomTransferred', handleRoomTransferred);
      window.removeEventListener('erp:studentApproved', handleStudentApproved);
      window.removeEventListener('erp:refresh', handleRefresh);
    };
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

  const fetchArchivedStudents = async () => {
    setLoadingArchived(true);
    try {
      const res = await api.get('/students/archived/list');
      setArchivedStudents(res.data.students || []);
    } catch (error) {
      toast.error('Failed to fetch archived students');
    } finally {
      setLoadingArchived(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setDepartmentFilter('');
  };

  const handleVacateSubmit = async (e) => {
    e.preventDefault();
    if (!vacateReason.trim()) {
      toast.error('Please input a vacation reason');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/students/${selectedVacateStudent._id}/vacate`, {
        reason: vacateReason
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Resident vacated and archived successfully.');
        setSelectedVacateStudent(null);
        fetchStudents();
        fetchArchivedStudents();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to vacate student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/students/${selectedRestoreStudent._id}/restore`);
      if (res.data.success) {
        toast.success(res.data.message || 'Resident restored successfully.');
        setSelectedRestoreStudent(null);
        fetchStudents();
        fetchArchivedStudents();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to restore student');
    } finally {
      setSubmitting(false);
    }
  };

  const exportArchivedToCSV = () => {
    if (archivedStudents.length === 0) {
      toast.error('No archived residents available to export.');
      return;
    }
    
    const headers = [
      'Full Name',
      'Email',
      'Admission Number',
      'Department',
      'Year',
      'Semester',
      'Parent Email',
      'Date Vacated',
      'Vacated By',
      'Vacate Reason'
    ];
    
    const rows = archivedStudents.map(student => {
      const vacatedDate = student.vacatedAt 
        ? new Date(student.vacatedAt).toLocaleString() 
        : 'N/A';
      const vacatedByName = student.vacatedBy?.fullName || 'N/A';
      const reason = student.vacateReason ? `"${student.vacateReason.replace(/"/g, '""')}"` : 'N/A';
      
      return [
        student.fullName,
        student.email,
        student.admissionNumber,
        student.department || 'N/A',
        student.year || 'N/A',
        student.semester || 'N/A',
        student.parentEmail || 'N/A',
        vacatedDate,
        vacatedByName,
        reason
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HostelFlow_Archived_Residents_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archived records exported successfully.');
  };

  // Fetch only available, inactive-filtered rooms for reassignment
  const fetchAvailableRooms = async (hostelId) => {
    if (!hostelId) return;
    setLoadingRooms(true);
    try {
      const res = await api.get(`/rooms/available/${hostelId}`);
      setRooms(res.data.rooms || []);
    } catch (error) {
      toast.error('Failed to load available rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const openReassignModal = (student) => {
    setSelectedStudent(student);
    setTargetRoomId('');
    setTransferReason('');
    fetchAvailableRooms(student.hostelId);
  };

  const handleReassignmentSubmit = async (e) => {
    e.preventDefault();
    if (!targetRoomId) {
      toast.error('Please select a target room');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/students/${selectedStudent._id}/change-room`, {
        newRoomId: targetRoomId,
        reason: transferReason
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Room shifted successfully!');
        setSelectedStudent(null);
        fetchStudents();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign student room');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchTransferHistory = async () => {
    setLoadingHistory(true);
    setShowHistory(true);
    try {
      const res = await api.get('/students/room-transfers/history');
      setHistoryList(res.data.history || []);
    } catch (error) {
      toast.error('Failed to load transfer history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // High-performance memoized list filtering to ensure 60FPS renders on 1000+ datasets
  const filteredStudents = useMemo(() => {
    const list = activeTab === 'current' ? students : archivedStudents;
    return list.filter(student => {
      const targetQuery = searchQuery.trim().toLowerCase();
      const matchesSearch = !targetQuery ||
        student.fullName.toLowerCase().includes(targetQuery) ||
        student.admissionNumber.toLowerCase().includes(targetQuery) ||
        student.email.toLowerCase().includes(targetQuery) ||
        (student.roomId?.roomNumber && student.roomId.roomNumber.toLowerCase().includes(targetQuery));

      const matchesDept = !departmentFilter || student.department === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [activeTab, students, archivedStudents, searchQuery, departmentFilter]);

  // Extract unique departments for institutional filters
  const uniqueDepartments = useMemo(() => {
    const list = activeTab === 'current' ? students : archivedStudents;
    const depts = list.map(s => s.department).filter(Boolean);
    return [...new Set(depts)].sort();
  }, [activeTab, students, archivedStudents]);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100">
            {activeTab === 'current' ? 'Current Residents' : 'Archived Residents'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {activeTab === 'current' 
              ? 'Manage room placements and track shifting audit logs' 
              : 'Review historical vacated student archives and restoration records'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'current' ? (
            <button
              onClick={fetchTransferHistory}
              className="flex items-center gap-2 bg-slate-800 dark:bg-zinc-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <History size={15} /> Room Shift Logs
            </button>
          ) : (
            <button
              onClick={exportArchivedToCSV}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-850 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Download size={15} /> Export Archives (CSV)
            </button>
          )}
        </div>
      </div>

      {/* Interactive Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => handleTabChange('current')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition duration-150 cursor-pointer ${
            activeTab === 'current'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Users size={15} />
          Current Residents
        </button>
        <button
          onClick={() => handleTabChange('archived')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition duration-150 cursor-pointer ${
            activeTab === 'archived'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Archive size={15} />
          Archived Residents
        </button>
      </div>

      {/* Modern High-Fidelity ERP Search & Filtering Control Bar */}
      {!(loading || (activeTab === 'archived' && loadingArchived)) && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input Container */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'current' 
                    ? "Search by resident name, admission number, or room number..." 
                    : "Search by resident name, admission number, or email..."
                }
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl pl-4 pr-10 py-2.5 text-xs font-semibold focus:outline-none transition-all duration-150"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-650 dark:hover:text-zinc-350 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter dropdown */}
            <div className="w-full sm:w-56">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none transition-all duration-150 cursor-pointer"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Operational metrics summary */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider pl-1 select-none">
            <span>
              Showing {filteredStudents.length} of {activeTab === 'current' ? students.length : archivedStudents.length} {activeTab === 'current' ? 'active' : 'archived'} residents
            </span>
            {(searchQuery || departmentFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setDepartmentFilter(''); }}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-black"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {loading || (activeTab === 'archived' && loadingArchived) ? (
        <div className="text-center p-12 text-slate-500 font-bold dark:text-zinc-400">
          <RefreshCw className="animate-spin inline-block mr-2 text-blue-500" size={24} />
          {activeTab === 'current' ? 'Retrieving approved resident profiles...' : 'Retrieving archived resident profiles...'}
        </div>
      ) : isMobile ? (
        <div className="space-y-4">
          {filteredStudents.map(student => (
            <div key={student._id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition text-slate-800 dark:text-zinc-150">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{student.fullName}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">{student.email}</p>
                  </div>
                  {activeTab === 'current' ? (
                    student.roomId ? (
                      <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                        Room: {student.roomId.roomNumber}
                      </span>
                    ) : (
                      <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                        Not Allocated
                      </span>
                    )
                  ) : (
                    <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                      Vacated
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 dark:border-zinc-850 text-xs text-slate-650 dark:text-zinc-400">
                  <div>
                    <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Admission No</span>
                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{student.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Department</span>
                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{student.department}</span>
                  </div>
                  {activeTab === 'current' && student.roomId && (
                    <>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Bed Number</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">Bed {student.bedNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Floor Level</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">Floor {student.roomId.floor}</span>
                      </div>
                    </>
                  )}
                  {activeTab === 'archived' && (
                    <>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Date Vacated</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200 font-mono">
                          {student.vacatedAt ? new Date(student.vacatedAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Vacated By</span>
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">
                          {student.vacatedBy?.fullName || 'Warden'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {activeTab === 'archived' && student.vacateReason && (
                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-850">
                    <span className="block text-[10px] text-slate-450 dark:text-zinc-500 font-black uppercase tracking-wider mb-0.5">Archival Reason</span>
                    <p className="text-xs italic text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-850 font-semibold leading-relaxed">
                      "{student.vacateReason}"
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                {activeTab === 'current' ? (
                  <>
                    <button
                      onClick={() => openReassignModal(student)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-55 hover:bg-blue-100 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      <ArrowLeftRight size={13} /> Reassign Room
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVacateStudent(student);
                        setVacateReason('');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 dark:hover:bg-rose-950/40 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      <UserX size={13} /> Vacate Resident
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedRestoreStudent(student)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    <RotateCcw size={13} /> Restore Resident
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-455 dark:text-zinc-500 font-bold italic">
              No matching hostel residents found.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-100 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-850">
              <thead className="bg-slate-50 dark:bg-zinc-950">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Name & Account</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Admission No</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Department</th>
                  {activeTab === 'current' ? (
                    <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Room Placement</th>
                  ) : (
                    <>
                      <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Date Vacated</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Archival Reason</th>
                    </>
                  )}
                  <th className="px-6 py-3.5 text-right text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 bg-white dark:bg-zinc-900">
                {filteredStudents.map(student => (
                  <tr key={student._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-zinc-150">{student.fullName}</div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500">{student.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-zinc-400">
                      {student.admissionNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-655 dark:text-zinc-400 font-bold">
                      {student.department} <span className="opacity-60">| Y{student.year} (S{student.semester})</span>
                    </td>
                    {activeTab === 'current' ? (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.roomId ? (
                          <div className="text-xs">
                            <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                              Room Room {student.roomId.roomNumber}
                            </span>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 pl-0.5">
                              Bed {student.bedNumber} | Floor {student.roomId.floor}
                            </div>
                          </div>
                        ) : (
                          <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase">
                            Not Allocated
                          </span>
                        )}
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-700 dark:text-zinc-350">
                            {student.vacatedAt ? new Date(student.vacatedAt).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                            By: {student.vacatedBy?.fullName || 'Warden'}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs whitespace-normal">
                          <div className="text-xs italic text-slate-500 dark:text-zinc-400 line-clamp-2" title={student.vacateReason}>
                            "{student.vacateReason || 'N/A'}"
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {activeTab === 'current' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openReassignModal(student)}
                            className="inline-flex items-center gap-1.5 bg-blue-55 hover:bg-blue-100 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <ArrowLeftRight size={13} /> Reassign Room
                          </button>
                          <button
                            onClick={() => {
                              setSelectedVacateStudent(student);
                              setVacateReason('');
                            }}
                            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <UserX size={13} /> Vacate Resident
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedRestoreStudent(student)}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <RotateCcw size={13} /> Restore Resident
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'current' ? "5" : "6"} className="px-6 py-12 text-center text-slate-455 dark:text-zinc-500 font-bold italic">
                      No matching hostel residents found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REASSIGNMENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/40">
              <div>
                <h3 className="font-black text-md text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-blue-600 dark:text-blue-400" />
                  Shift Resident Room
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase font-mono">
                  Resident: {selectedStudent.fullName}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleReassignmentSubmit} className="p-6 space-y-5">
              
              {/* Current Room Placement */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 text-xs space-y-2">
                <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-1">Current Placement</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Room Number</span>
                    <strong className="text-slate-700 dark:text-zinc-200 font-bold">
                      {selectedStudent.roomId?.roomNumber ? `Room ${selectedStudent.roomId.roomNumber}` : 'Unassigned'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Bed Position</span>
                    <strong className="text-slate-700 dark:text-zinc-200 font-bold">
                      {selectedStudent.bedNumber ? `Bed ${selectedStudent.bedNumber}` : 'Unassigned'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Target Room Selection Dropdown */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 pl-0.5">Target Room Assignment</label>
                {loadingRooms ? (
                  <div className="text-xs text-slate-400 py-2.5">Querying available hostel rooms...</div>
                ) : (
                  <select
                    required
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-900 text-sm font-bold text-slate-800 dark:text-zinc-150"
                  >
                    <option value="">-- Select Available Room --</option>
                    {rooms.map(room => (
                      <option key={room._id} value={room._id}>
                        Room {room.roomNumber} — Floor {room.floor} ({room.availableBeds} beds remaining)
                      </option>
                    ))}
                  </select>
                )}
                {rooms.length === 0 && !loadingRooms && (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-2 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> No available rooms with free capacity inside this hostel.
                  </p>
                )}
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 pl-0.5">Shift & Transfer Reason</label>
                <textarea
                  required
                  rows="3"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="E.g. Roommate conflict, room upgrade, medical shift request..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-zinc-900"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="w-1/2 p-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-650 dark:text-zinc-300 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetRoomId}
                  className="w-1/2 p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Shifting...' : 'Confirm Transfer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VACATE RESIDENT CONFIRMATION MODAL */}
      {selectedVacateStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-rose-50/50 dark:bg-rose-950/10">
              <div>
                <h3 className="font-black text-md text-rose-700 dark:text-rose-455 flex items-center gap-2">
                  <UserX size={18} />
                  Vacate & Archive Account
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase font-mono">
                  Resident: {selectedVacateStudent.fullName}
                </p>
              </div>
              <button
                onClick={() => setSelectedVacateStudent(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleVacateSubmit} className="p-6 space-y-5">
              
              {/* Warning box */}
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs text-rose-700 dark:text-rose-300 space-y-2 flex gap-3">
                <AlertCircle size={20} className="shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <strong className="font-black block mb-1">Critical Security & Database Safeguards:</strong>
                  <ul className="list-disc pl-4 space-y-1 font-semibold">
                    <li>This will <strong>NOT</strong> permanently delete student logs, leaves, complaints, or mess billing records (fully audit-safe soft delete).</li>
                    <li>The allocated room bed <strong>({selectedVacateStudent.roomId?.roomNumber ? `Room ${selectedVacateStudent.roomId.roomNumber}` : 'N/A'}, Bed {selectedVacateStudent.bedNumber || 'N/A'})</strong> will be immediately released.</li>
                    <li>Linked parent monitor accounts (if only child) will be safely deactivated to prevent unmonitored portal access.</li>
                  </ul>
                </div>
              </div>

              {/* Vacate Reason */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 pl-0.5">Vacation & Archival Reason</label>
                <textarea
                  required
                  rows="3"
                  value={vacateReason}
                  onChange={(e) => setVacateReason(e.target.value)}
                  placeholder="E.g. Completed course graduation, formal hostel withdrawal request, disciplinary exit..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-rose-500 outline-none text-sm dark:bg-zinc-900 text-slate-800 dark:text-zinc-150"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVacateStudent(null)}
                  className="w-1/2 p-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-650 dark:text-zinc-300 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 p-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Archiving...' : 'Confirm Vacate'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* RESTORE RESIDENT CONFIRMATION MODAL */}
      {selectedRestoreStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/10">
              <div>
                <h3 className="font-black text-md text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <RotateCcw size={18} />
                  Restore Resident Account
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase font-mono">
                  Resident: {selectedRestoreStudent.fullName}
                </p>
              </div>
              <button
                onClick={() => setSelectedRestoreStudent(null)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              
              {/* Info box */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300 space-y-2 flex gap-3">
                <AlertCircle size={20} className="shrink-0 text-blue-500 mt-0.5" />
                <div>
                  <strong className="font-black block mb-1">Restoration Guidelines:</strong>
                  <ul className="list-disc pl-4 space-y-1 font-semibold font-sans">
                    <li>This will reactivate the student account (`isActive: true`).</li>
                    <li>The student will be returned to the **Pending Approvals** list.</li>
                    <li>This routes them cleanly back to the Warden’s **Smart Room Allocation Engine** workflow to assign a room and bed.</li>
                    <li>The linked parent monitor account will be automatically reactivated if it was previously deactivated.</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRestoreStudent(null)}
                  className="w-1/2 p-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-650 dark:text-zinc-300 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreSubmit}
                  disabled={submitting}
                  className="w-1/2 p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Restoring...' : 'Confirm Restore'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* SHIFT LOGS HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity">
          <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800 dark:text-zinc-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/40">
              <div>
                <h3 className="font-black text-md text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <History size={18} className="text-blue-600 dark:text-blue-400" />
                  Room Shifting Audit History
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 uppercase">
                  Official hostel room transfer logs for traceability
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
              {loadingHistory ? (
                <div className="text-center py-10 font-bold text-slate-400">Loading audit history...</div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                  <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
                  No student room shifting records found.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {historyList.map(log => (
                    <div key={log._id} className="p-4 border border-slate-100 dark:border-zinc-850 rounded-2xl bg-slate-50/50 dark:bg-zinc-950/10 space-y-3 text-xs">
                      
                      {/* Top Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <strong className="text-slate-800 dark:text-zinc-100 text-sm font-black block">
                            {log.studentId?.fullName || 'Resident'}
                          </strong>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            Admission: {log.studentId?.admissionNumber || 'N/A'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 px-2 py-0.5 rounded-lg">
                          {new Date(log.transferredAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* Room change comparison */}
                      <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-850/60 font-bold">
                        <div className="text-slate-400 uppercase text-[9px] tracking-widest pl-1">Shift</div>
                        <div className="bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-zinc-300">
                          {log.oldRoomId ? `Room ${log.oldRoomId.roomNumber}` : 'Unassigned'}
                        </div>
                        <span className="text-slate-400 font-bold">&rarr;</span>
                        <div className="bg-blue-600 text-white px-2.5 py-0.5 rounded text-[10px]">
                          Room {log.newRoomId?.roomNumber || 'Room'}
                        </div>
                      </div>

                      {/* Log details */}
                      <div className="grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
                        <div>
                          <span className="text-slate-400 block">Authorized By</span>
                          <strong className="text-slate-650 dark:text-zinc-400 font-bold">
                            {log.transferredBy?.fullName || 'Warden'} ({log.transferredBy?.role})
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Reason</span>
                          <em className="text-slate-650 dark:text-zinc-400 not-italic font-semibold block line-clamp-2">
                             "{log.reason}"
                          </em>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
