import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

// ── Priority badge config ──────────────────────────────
const PRIORITY_CONFIG = {
  EMERGENCY: {
    badge: 'bg-red-600 text-white',
    card: 'border-l-4 border-l-red-600 bg-red-50',
    icon: '🚨',
    label: 'EMERGENCY'
  },
  IMPORTANT: {
    badge: 'bg-orange-100 text-orange-800 border border-orange-300',
    card: 'border-l-4 border-l-orange-400 bg-orange-50',
    icon: '⚠️',
    label: 'IMPORTANT'
  },
  NORMAL: {
    badge: 'bg-gray-100 text-gray-600',
    card: 'border bg-white',
    icon: '',
    label: 'NORMAL'
  }
};

// ── Date formatter ─────────────────────────────────────
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Single Notice Card ─────────────────────────────────
function NoticeCard({ notice }) {
  const config = PRIORITY_CONFIG[notice.priority] || PRIORITY_CONFIG.NORMAL;
  const isExpiringSoon = notice.expiresAt && new Date(notice.expiresAt) - new Date() < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className={`rounded-lg shadow-sm p-5 mb-4 transition hover:shadow-md ${config.card} ${notice.isPinned ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {notice.isPinned && (
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-300">
              📌 Pinned
            </span>
          )}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badge}`}>
            {config.icon} {config.label}
          </span>
          {notice.targetType === 'GLOBAL' && (
            <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              🌐 Global
            </span>
          )}
          {isExpiringSoon && (
            <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              ⏳ Expires Soon
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400">{formatDate(notice.createdAt)}</div>
      </div>

      <h3 className={`font-bold text-lg mb-2 ${notice.priority === 'EMERGENCY' ? 'text-red-800' : 'text-gray-800'}`}>
        {notice.title}
      </h3>

      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{notice.content}</p>

      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs text-gray-400 gap-2">
        <span>
          By: <span className="font-medium text-gray-600">{notice.createdBy?.fullName || 'Admin'}</span>
          {notice.hostelId && ` · ${notice.hostelId.name}`}
        </span>
        {notice.expiresAt && (
          <span>Expires: {formatDate(notice.expiresAt)}</span>
        )}
      </div>
    </div>
  );
}

// ── Main Notices Page ──────────────────────────────────
export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const fetchNotices = async () => {
      setLoading(true);
      try {
        const res = await api.get('/notices');
        setNotices(res.data.notices);
      } catch (error) {
        toast.error('Failed to load notices');
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  // Separate emergency and pinned for special sections
  const emergencyNotices = notices.filter(n => n.priority === 'EMERGENCY');
  const pinnedNotices = notices.filter(n => n.isPinned && n.priority !== 'EMERGENCY');

  // Filtered view for the main list
  const filtered = filter === 'ALL'
    ? notices
    : filter === 'PINNED'
    ? notices.filter(n => n.isPinned)
    : notices.filter(n => n.priority === filter);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Noticeboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          {notices.length} active notice{notices.length !== 1 ? 's' : ''} •{' '}
          {emergencyNotices.length > 0 && (
            <span className="text-red-600 font-bold">{emergencyNotices.length} Emergency</span>
          )}
        </p>
      </div>

      {/* Emergency Banner */}
      {emergencyNotices.length > 0 && (
        <div className="mb-6">
          <div className="bg-red-600 text-white px-4 py-2 rounded-t-lg font-bold flex items-center gap-2">
            🚨 Emergency Announcements
          </div>
          <div className="rounded-b-lg overflow-hidden">
            {emergencyNotices.map(n => <NoticeCard key={n._id} notice={n} />)}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { key: 'ALL', label: `All (${notices.length})` },
          { key: 'PINNED', label: `📌 Pinned (${notices.filter(n => n.isPinned).length})` },
          { key: 'EMERGENCY', label: `🚨 Emergency` },
          { key: 'IMPORTANT', label: `⚠️ Important` },
          { key: 'NORMAL', label: `Normal` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
              filter === tab.key
                ? 'bg-gray-800 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notices List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg border p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-bold text-lg">No notices found</div>
          <p className="text-sm mt-1">
            {filter === 'ALL' ? 'No active notices at this time.' : `No ${filter} notices.`}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(notice => (
            <NoticeCard key={notice._id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}
