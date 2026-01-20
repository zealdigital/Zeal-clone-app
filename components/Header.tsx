
import React from 'react';
import { CalendarDaysIcon, Cog6ToothIcon } from './Icons';
import type { User, Notification, Branding } from '../types';
import NotificationBell from './NotificationBell';

interface HeaderProps {
    currentUser?: User;
    onLogout?: () => void;
    notifications?: Notification[];
    setNotifications?: React.Dispatch<React.SetStateAction<Notification[]>>;
    branding?: Branding;
    onOpenSettings?: () => void; // New prop for opening settings modal
}

export const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, notifications, setNotifications, branding, onOpenSettings }) => {
  const companyName = branding?.companyName || 'Calling Team Booking Portal';
  
  return (
    <header className="bg-white shadow-md transition-all border-b-4 border-indigo-600 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-6 gap-4">
          {/* Brand Section - Big Banner Style */}
          <div className="flex items-center gap-5">
            {branding?.logoUrl ? (
                <img 
                    src={branding.logoUrl} 
                    alt="Company Logo" 
                    className="h-20 w-auto object-contain"
                />
            ) : (
                <CalendarDaysIcon className="h-16 w-16 text-indigo-600" />
            )}
            <span className="text-3xl font-extrabold tracking-tight text-gray-900">{companyName}</span>
          </div>

          {/* User Controls */}
          {currentUser && onLogout && (
            <div className="flex items-center gap-5 self-end sm:self-center mt-2 sm:mt-0">
                {/* Notification Bell - Visible for ALL roles now */}
                {notifications && setNotifications && (
                    <div className="transform scale-110">
                        <NotificationBell notifications={notifications} setNotifications={setNotifications} />
                    </div>
                )}
                
                {/* Settings Button for Vendors/BDMs (Manager has settings tab) */}
                {(currentUser.role === 'vendor' || currentUser.role === 'bdm') && onOpenSettings && (
                    <button 
                        onClick={onOpenSettings}
                        className="text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="Settings & Notifications"
                    >
                        <Cog6ToothIcon className="w-6 h-6" />
                    </button>
                )}

                <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-gray-800 leading-tight">{currentUser.name}</p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {currentUser.role === 'bdm' ? 'BDM' : currentUser.role === 'vendor' ? 'Calling Team' : currentUser.role}
                    </p>
                </div>
                <button 
                    onClick={onLogout}
                    className="px-5 py-2.5 text-sm font-semibold text-indigo-600 border-2 border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors uppercase tracking-wide"
                >
                    Logout
                </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
