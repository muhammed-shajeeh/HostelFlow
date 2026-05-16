import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

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
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-colors"
      >
        <Bell size={22} className="transition-transform active:scale-95 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border border-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-2xl border border-gray-100 z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check size={14} /> Clear All
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Bell className="mx-auto mb-2 text-gray-300" size={32} />
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition flex gap-3 text-left relative ${
                    !notif.isRead ? 'bg-blue-50/40 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className="font-bold text-xs text-gray-800 truncate">{notif.title}</h4>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                  </div>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif._id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600 self-center"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
