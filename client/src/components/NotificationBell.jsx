import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Info, ArrowRight, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

// Reusable Helper to format date elegantly for ERP
const formatNotificationDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], timeOptions)}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], timeOptions)}`;
  } else {
    return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${date.toLocaleTimeString([], timeOptions)}`;
  }
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif) => {
    setIsOpen(false);
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Active Pulsing Ring */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative p-2.5 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-all duration-200"
      >
        <Bell size={20} className={`text-slate-700 ${unreadCount > 0 ? 'animate-[swing_1.5s_ease-in-out_infinite]' : ''}`} />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-white animate-ping opacity-60 pointer-events-none" />
          </>
        )}
      </button>

      {/* Styled Swing Keyframe style */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes swing {
          0%, 100% { transform: rotate(0); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
        }
      `}} />

      {/* Dropdown Panel - Mobile & WebView Responsive */}
      {isOpen && (
        <div className="absolute right-[-60px] sm:right-0 mt-3 w-[calc(100vw-32px)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[500px] animate-[slideDown_0.2s_ease-out]">
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}} />

          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-blue-500/20">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck size={14} /> Clear All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition sm:hidden"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[380px] scrollbar-thin scrollbar-thumb-slate-200">
            {notifications.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-3 text-slate-400">
                  <Bell size={22} />
                </div>
                <h4 className="font-bold text-xs text-slate-800 mb-1">All Caught Up!</h4>
                <p className="text-[10px] text-slate-400 font-semibold max-w-[200px] mx-auto leading-relaxed">
                  No real-time personalized updates received at this time.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                // Scoped styling parameters based on Priority
                let priorityBg = 'bg-slate-50 border-slate-200';
                let priorityIcon = <Bell size={14} className="text-slate-500" />;
                let priorityLabel = 'Normal';
                let priorityLabelClass = 'bg-slate-100 text-slate-600';

                if (notif.priority === 'EMERGENCY') {
                  priorityBg = 'bg-red-50/50 border-red-200';
                  priorityIcon = <AlertTriangle size={14} className="text-red-600" />;
                  priorityLabel = 'Emergency';
                  priorityLabelClass = 'bg-red-100 text-red-700 font-black animate-pulse';
                } else if (notif.priority === 'IMPORTANT') {
                  priorityBg = 'bg-amber-50/50 border-amber-200';
                  priorityIcon = <Info size={14} className="text-amber-600" />;
                  priorityLabel = 'Important';
                  priorityLabelClass = 'bg-amber-100 text-amber-700';
                }

                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition flex gap-3 text-left relative ${
                      !notif.isRead ? `${priorityBg} border-l-4 border-l-blue-600` : 'bg-white'
                    }`}
                  >
                    {/* Priority Icon Shield */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                      notif.priority === 'EMERGENCY' ? 'bg-red-100 border-red-200 text-red-600' :
                      notif.priority === 'IMPORTANT' ? 'bg-amber-100 border-amber-200 text-amber-600' :
                      'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {priorityIcon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Priority Tag & Time */}
                      <div className="flex justify-between items-center mb-1.5 gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${priorityLabelClass}`}>
                          {priorityLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {formatNotificationDate(notif.createdAt)}
                        </span>
                      </div>
                      
                      {/* Title & Description */}
                      <h4 className="font-extrabold text-xs text-slate-800 leading-snug mb-0.5">{notif.title}</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-2 line-clamp-2">{notif.message}</p>

                      {/* Optional Interactive CTA Trigger */}
                      {notif.actionUrl && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-bold transition">
                          <span>View Details</span>
                          <ArrowRight size={10} className="stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Single Mark As Read Button */}
                    {!notif.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif._id);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 self-start transition"
                        title="Mark as read"
                      >
                        <Check size={14} className="stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Optional Footer Link */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest select-none">
              HostelFlow Notification Hub
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
