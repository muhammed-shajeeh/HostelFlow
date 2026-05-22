import { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Calendar, Search, Filter, Clock, User,
  DollarSign, AlertCircle, AlertOctagon, MessageSquare,
  Bell, RotateCcw, ShieldCheck, HelpCircle, ArrowRight, Loader2
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import NativeSelect from '../components/NativeSelect';
import { useSocket } from '../context/SocketContext';

// Helper to format date cleanly for human timelines
const formatTimelineDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Map EntityTypes to beautiful Lucide icons
const getEntityIcon = (entityType) => {
  switch (entityType) {
    case 'USER': return <User size={15} />;
    case 'LEAVE': return <ArrowRight size={15} />;
    case 'PAYMENT': return <DollarSign size={15} />;
    case 'BILLING': return <DollarSign size={15} />;
    case 'COMPLAINT': return <MessageSquare size={15} />;
    case 'NOTICE': return <Bell size={15} />;
    case 'SECURITY': return <ShieldCheck size={15} />;
    default: return <HelpCircle size={15} />;
  }
};

export default function AdminAuditLogs() {
  const { socket } = useSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Real-time flash effect ID reference
  const [newLogIds, setNewLogIds] = useState(new Set());

  // Dynamic Filters State
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [severity, setSeverity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [hostels, setHostels] = useState([]);

  // Fetch hostels for isolation selector
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const res = await api.get('/hostels');
        setHostels(res.data.hostels || []);
      } catch (err) {
        console.error('Failed to load hostels list for filter dropdown.', err);
      }
    };
    fetchHostels();
  }, []);

  // Fetch operational logs from API
  const fetchLogs = async (pageNum = 1, forceRefresh = false) => {
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit: 15,
        search,
        entityType,
        severity,
        startDate,
        endDate,
        hostelId
      };

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.logs || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
    } catch (error) {
      toast.error('Failed to load system audit timeline.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when parameters or pagination updates
  useEffect(() => {
    fetchLogs(1);
  }, [entityType, severity, startDate, endDate, hostelId]);

  // Real-time Socket.IO event listener for active timeline synchronization
  useEffect(() => {
    if (!socket) return;

    const handleNewAuditLog = (newLog) => {
      // Prepend to current active list if on the first page
      if (currentPage === 1) {
        setLogs(prev => {
          // Avoid duplicate prepend checks
          if (prev.some(log => log._id === newLog._id)) return prev;

          // Trigger highlights flash
          setNewLogIds(prevIds => {
            const nextIds = new Set(prevIds);
            nextIds.add(newLog._id);
            return nextIds;
          });

          // Dim the flash after 4 seconds
          setTimeout(() => {
            setNewLogIds(prevIds => {
              const nextIds = new Set(prevIds);
              nextIds.delete(newLog._id);
              return nextIds;
            });
          }, 4000);

          return [newLog, ...prev.slice(0, 14)];
        });
        setTotalCount(prev => prev + 1);
      } else {
        // Just toast notification in background if admin is on page 2+
        toast(() => (
          <div className="flex flex-col text-left gap-1">
            <span className="font-bold text-xs text-blue-600">New Audit Log Recorded</span>
            <span className="text-[10px] text-slate-500">{newLog.title}</span>
          </div>
        ), { icon: '🛡️', duration: 4000 });
      }
    };

    socket.on('NEW_AUDIT_LOG', handleNewAuditLog);
    return () => {
      socket.off('NEW_AUDIT_LOG', handleNewAuditLog);
    };
  }, [socket, currentPage]);

  const handleResetFilters = () => {
    setSearch('');
    setEntityType('');
    setSeverity('');
    setStartDate('');
    setEndDate('');
    setHostelId('');
    setCurrentPage(1);
    fetchLogs(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert size={28} className="text-blue-600" />
            System Audit Timeline
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Operational activity tracking, security overrides, and financial governance logging ledger.
          </p>
        </div>
        <button
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer self-start md:self-auto"
        >
          <RotateCcw size={14} /> Reset Filters
        </button>
      </div>

      {/* Grid: Left Filters, Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left Side Filters Bar */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Filter size={16} className="text-slate-500" /> Filters
            </h3>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative mt-2">
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition"
              />
              <Search className="absolute left-2.5 top-3.5 text-slate-400" size={14} />
            </form>

            {/* Severity filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Severity Level</label>
              <NativeSelect
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 cursor-pointer font-bold"
                placeholder="All Severities"
              >
                <option value="">All Severities</option>
                <option value="INFO">INFO</option>
                <option value="IMPORTANT">IMPORTANT</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
              </NativeSelect>
            </div>

            {/* Entity Type filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Event Module</label>
              <NativeSelect
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 cursor-pointer font-bold"
                placeholder="All Modules"
              >
                <option value="">All Modules</option>
                <option value="USER">USER</option>
                <option value="ATTENDANCE">ATTENDANCE</option>
                <option value="LEAVE">LEAVE</option>
                <option value="BILLING">BILLING</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="SECURITY">SECURITY</option>
                <option value="COMPLAINT">COMPLAINT</option>
                <option value="NOTICE">NOTICE</option>
                <option value="SYSTEM">SYSTEM</option>
              </NativeSelect>
            </div>

            {/* Hostel Scope filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hostel isolation</label>
              <NativeSelect
                value={hostelId}
                onChange={(e) => setHostelId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 cursor-pointer font-bold"
                placeholder="All Hostels"
              >
                <option value="">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h._id} value={h._id}>{h.name}</option>
                ))}
              </NativeSelect>
            </div>

            {/* Date Filters */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Date range</label>
              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 cursor-pointer"
                />
                <span className="text-[9px] text-center font-bold text-slate-400">TO</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Timeline Grid */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
              <span className="text-xs text-slate-500 font-bold">Querying ledger records...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-20 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-4 text-slate-400">
                <ShieldAlert size={28} />
              </div>
              <h3 className="font-extrabold text-sm text-slate-800 mb-1">No Audit Logs Found</h3>
              <p className="text-xs text-slate-400 font-semibold max-w-sm leading-relaxed">
                There are no matching operational activity timeline logs. Adjust your search criteria or filters.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">

              {/* Dynamic stats preview */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Showing <strong>{logs.length}</strong> entries out of <strong>{totalCount}</strong> total actions</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Sync Enabled</span>
              </div>

              {/* The Timeline Thread */}
              <div className="relative border-l-2 border-slate-200 ml-5 pl-8 space-y-6">

                {logs.map((log) => {
                  const isNew = newLogIds.has(log._id);

                  // Scoped styling tags depending on Severity
                  let severityTag = 'bg-slate-100 text-slate-600';
                  let iconBg = 'bg-slate-100 text-slate-500 border-slate-200';
                  let logBorder = 'border-slate-100';

                  if (log.severity === 'CRITICAL') {
                    severityTag = 'bg-red-100 text-red-700 font-black';
                    iconBg = 'bg-red-500 text-white border-red-500';
                    logBorder = 'border-red-200 bg-red-50/10';
                  } else if (log.severity === 'WARNING') {
                    severityTag = 'bg-amber-100 text-amber-700 font-black';
                    iconBg = 'bg-amber-500 text-white border-amber-500';
                    logBorder = 'border-amber-200 bg-amber-50/10';
                  } else if (log.severity === 'IMPORTANT') {
                    severityTag = 'bg-blue-100 text-blue-700';
                    iconBg = 'bg-blue-500 text-white border-blue-500';
                    logBorder = 'border-blue-100';
                  }

                  return (
                    <div
                      key={log._id}
                      className={`relative transition-all duration-700 ${isNew ? 'scale-[1.01] translate-x-1 shadow-md shadow-green-500/10 bg-green-50/40 border border-green-300 rounded-2xl p-0.5' : ''
                        }`}
                    >
                      {/* Floating Absolute Indicator Node */}
                      <span className={`absolute left-[-49px] top-4 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-colors duration-500 ${isNew ? 'bg-green-500 text-white border-green-500 animate-bounce' : iconBg
                        }`}>
                        {log.severity === 'CRITICAL' ? <AlertOctagon size={14} /> :
                          log.severity === 'WARNING' ? <AlertCircle size={14} /> :
                            getEntityIcon(log.entityType)}
                      </span>

                      {/* Card layout */}
                      <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${logBorder}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${severityTag}`}>
                              {log.severity}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                              {log.entityType}
                            </span>
                            {log.hostelId && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                                {log.hostelId.name || 'Scope Hostel'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock size={11} />
                            {formatTimelineDate(log.createdAt)}
                          </span>
                        </div>

                        {/* Title & Detail */}
                        <h4 className="font-extrabold text-sm text-slate-800 leading-snug mb-1">{log.title}</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">{log.description}</p>

                        {/* Actor details & IP */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5 font-bold">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                              <User size={10} />
                            </div>
                            <span>
                              {log.actorName} <span className="font-medium text-slate-400">({log.actorRole})</span>
                            </span>
                          </div>
                          {log.ipAddress && (
                            <span className="font-semibold font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                              IP: {log.ipAddress}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pb-10">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                      fetchLogs(currentPage - 1);
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500 font-bold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(prev => Math.min(totalPages, prev + 1));
                      fetchLogs(currentPage + 1);
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
