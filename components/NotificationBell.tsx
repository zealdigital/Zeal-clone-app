
import React, { useState, useMemo } from 'react';
import type { Notification } from '../types';
import { BellIcon } from './Icons';

interface NotificationBellProps {
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, setNotifications }) => {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const sortedNotifications = useMemo(() => [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [notifications]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={handleToggle} className="relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none">
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="origin-top-left absolute left-0 sm:left-auto sm:right-0 sm:origin-top-right mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="menu-button"
        >
          <div className="py-1">
            <div className="flex justify-between items-center px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
              {notifications.length > 0 && (
                 <button onClick={handleMarkAllAsRead} disabled={unreadCount === 0} className="text-xs text-indigo-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">
                    Mark all as read
                </button>
              )}
            </div>
            {sortedNotifications.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">You have no new notifications.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {sortedNotifications.map(notification => (
                  <li key={notification.id} className={`px-4 py-3 ${!notification.read ? 'bg-indigo-50' : 'bg-white'}`}>
                    <p className="text-sm text-gray-700">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(notification.timestamp).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
