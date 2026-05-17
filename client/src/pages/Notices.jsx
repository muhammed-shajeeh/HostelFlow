import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { 
  Bell, Calendar, Clock, MapPin, User, ShieldAlert, 
  RotateCcw, Sparkles, RefreshCw, AlertOctagon, HelpCircle 
} from 'lucide-react';

const PRIORITY_CONFIG = {
  EMERGENCY: {
    badge: 'bg-red-600 text-white animate-pulse',
    card: 'border border-red-200 bg-red-50/20 text-red-900',
    icon: <AlertOctagon size={14} className="text-red-600" />,
    label: 'EMERGENCY'
  },
  IMPORTANT: {
    badge: 'bg-amber-100 text-amber-800 border border-amber-300',
    card: 'border border-amber-200 bg-amber-50/20',
    icon: <ShieldAlert size={14} className="text-amber-600" />,
    label: 'IMPORTANT'
  },
  NORMAL: {
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    card: 'border border-slate-200 bg-white',
    icon: <Bell size={14} className="text-slate-400" />,
    label: 'NORMAL'
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ── Premium Single Notice Card ─────────────────────────────────
function NoticeCard({ notice }) {
  const config = PRIORITY_CONFIG[notice.priority] || PRIORITY_CONFIG.NORMAL;
  const isExpiringSoon = notice.expiresAt && (new Date(notice.expiresAt) - new Date() < 3 * 24 * 60 * 60 * 1000);

  return (
    <div className={`rounded-3xl p-5 mb-5 shadow-xs hover:shadow-md hover:scale-[1.005] transition-all duration-200 ${config.card} ${notice.isPinned ? 'ring-2 ring-blue-500/20 border-blue-200' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {notice.isPinned && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
              📌 PINNED
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${config.badge}`}>
            {config.icon} {config.label}
          </span>
          {notice.targetType === 'GLOBAL' ? (
            <span className="text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
              🌐 GLOBAL BROADCAST
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              🏠 HOSTEL NOTICE
            </span>
          )}
          {notice.isRecurring && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
              🔄 RECURRING {notice.recurrenceType}
            </span>
          )}
          {isExpiringSoon && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
              ⏳ EXPIRES SOON
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
          <Clock size={11} /> {formatDate(notice.publishAt || notice.createdAt)}
        </div>
      </div>

      <h3 className={`font-extrabold text-base mb-2 tracking-tight ${notice.priority === 'EMERGENCY' ? 'text-red-950' : 'text-slate-800'}`}>
        {notice.title}
      </h3>

      <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap font-medium">{notice.content}</p>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center text-[10px] text-slate-400 gap-2">
        <span className="flex items-center gap-1 font-bold">
          <User size={11} className="text-slate-400" />
          By: <span className="text-slate-600 font-extrabold">{notice.createdBy?.fullName || 'Warden'}</span>
          {notice.hostelId && ` · ${notice.hostelId.name}`}
        </span>
        {notice.expiresAt && (
          <span className="font-semibold text-slate-400">
            Expires: <span className="text-red-500 font-bold">{formatDate(notice.expiresAt)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Notices Board Page ────────────────────────────────────
export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices');
      setNotices(res.data.notices || []);
    } catch (error) {
      toast.error('Failed to load noticesboard announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // Separate emergency notices
  const emergencyNotices = notices.filter(n => n.priority === 'EMERGENCY');

  // Filtered lists
  const filtered = filter === 'ALL'
    ? notices
    : filter === 'PINNED'
    ? notices.filter(n => n.isPinned)
    : notices.filter(n => n.priority === filter);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell size={26} className="text-blue-600 animate-swing" />
            Noticeboard
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Active announcements, daily operations and safety alerts targeted for your hostel.
          </p>
        </div>
        <button
          onClick={fetchNotices}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer self-start md:self-auto"
        >
          <RotateCcw size={13} /> Refresh Feed
        </button>
      </div>

      {/* Emergency Announcements Segment */}
      {emergencyNotices.length > 0 && (
        <div className="mb-8">
          <div className="bg-red-600 text-white px-5 py-3 rounded-t-3xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-red-600/10">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
            🚨 EMERGENCY ALERTS (IMMEDIATE COMPLIANCE REQUIRED)
          </div>
          <div className="bg-red-50/30 border-x border-b border-red-200 rounded-b-3xl p-5 space-y-2 shadow-xs">
            {emergencyNotices.map(n => <NoticeCard key={n._id} notice={n} />)}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'ALL', label: `All Notices (${notices.length})` },
          { key: 'PINNED', label: `📌 Pinned` },
          { key: 'EMERGENCY', label: `🚨 Emergency` },
          { key: 'IMPORTANT', label: `⚠️ Important` },
          { key: 'NORMAL', label: `Normal` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === tab.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notices Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200 p-6 animate-pulse">
              <div className="h-2 bg-slate-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3"></div>
              <div className="h-2 bg-slate-100 rounded w-full mb-2"></div>
              <div className="h-2 bg-slate-100 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-4 text-slate-400">
            <Bell size={28} />
          </div>
          <h3 className="font-extrabold text-sm text-slate-800 mb-1">Noticeboard Clean</h3>
          <p className="text-xs text-slate-400 font-semibold max-w-sm">
            {filter === 'ALL' ? 'There are no active notices or announcements at this time.' : `No announcements matching "${filter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notice => (
            <NoticeCard key={notice._id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}
