import React, { useMemo, useState, useEffect } from 'react';
import type { BDM, Booking, User, Notification, Vendor, Region, AppointmentSlotsConfig, Branding, Manager, NotificationPreferences, ManagerAppointment, PublicHoliday, LeaveDay } from '../types';
import { Header } from './Header';
import BdmUpdateStatusModal from './BdmUpdateStatusModal';
import { getStatusPill } from '../utils/statusUtils';
import BdmAnalyticsDashboard from './BdmAnalyticsDashboard';
import PerformanceLeadLog from './PerformanceLeadLog';
import { BellIcon, DocumentTextIcon, MagnifyingGlassIcon, PlusIcon, ArrowPathIcon, PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, PhoneIcon, ClockIcon, CalendarDaysIcon, XMarkIcon, ExclamationTriangleIcon, Cog6ToothIcon, PresentationChartLineIcon, MapPinIcon } from './Icons';
import BdmNoteReminderModal from './BdmNoteReminderModal';
import BdmBookingRequestModal from './BdmBookingRequestModal';
import DateRangePicker from './DateRangePicker';
import { exportBookingsToCSV } from '../utils/exportUtils';
import ExpandableNote from './ExpandableNote';
import { getRegionBackgroundColor } from '../utils/regionUtils';
import NotificationSettings from './NotificationSettings';
import UnifiedCalendar from './UnifiedCalendar';
import TrendAnalytics, { TimePeriod } from './TrendAnalytics';
import StatusAnalytics from './StatusAnalytics';
import RejectedBookingsList from './RejectedBookingsList';
import ArchivedBookingsList from './ArchivedBookingsList';
import { sendEmailNotification } from '../utils/emailService';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../constants';
import { formatDDMMYY } from '../utils/dateUtils';

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};

const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(' ');
    if (parts.length !== 2) return 0;
    const [time, modifier] = parts;
    const [hoursStr, minutesStr] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

interface BdmDashboardProps {
  currentUser: Extract<User, { role: 'bdm' }>;
  onLogout: () => void;
  allBookings: Booking[];
  setAllBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  vendors: Vendor[];
  managers: Manager[];
  salespeopleCount: Record<Region, number>;
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  branding: Branding;
  regions: Region[];
  regionColors: Record<string, string>;
  onUpdateProfile: (user: User) => void;
  personalAppointments: ManagerAppointment[];
  setPersonalAppointments: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
  publicHolidays: PublicHoliday[];
  leaveDays: LeaveDay[];
  isSyncing: boolean;
}

const ITEMS_PER_PAGE = 10;

const triggerSystemAlert = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-indigo-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] animate-bounceIn flex items-center gap-4 border-2 border-white/20';
    toast.innerHTML = `<div class="bg-white/20 p-2 rounded-lg">🔔</div><div><p class="font-bold text-xs uppercase tracking-widest opacity-70">System Alert</p><p class="text-sm font-medium">${message}</p></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-full'); setTimeout(() => document.body.removeChild(toast), 500); }, 4000);
};

const BdmDashboard: React.FC<BdmDashboardProps> = ({ 
    currentUser, onLogout, allBookings, setAllBookings, notifications, setNotifications, 
    vendors, managers, salespeopleCount, appointmentTimes, branding, regions, regionColors, 
    onUpdateProfile, personalAppointments, setPersonalAppointments, publicHolidays, leaveDays, isSyncing
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'performance' | 'settings'>('dashboard');
  const [bookingToUpdate, setBookingToUpdate] = useState<Booking | null>(null);
  const [bookingToManageNotes, setBookingToManageNotes] = useState<Booking | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestModalPrefill, setRequestModalPrefill] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
  const [analyticsDateRange, setAnalyticsDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
  const [analyticsTimePeriod, setAnalyticsTimePeriod] = useState<TimePeriod>('monthly');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [settingsForm, setSettingsForm] = useState({
      email: currentUser.email || '',
      notificationPreferences: currentUser.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
      setSettingsForm({
          email: currentUser.email || '',
          notificationPreferences: currentUser.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
      });
  }, [currentUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);

  const visibilityCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); 
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateProfile({ ...currentUser, ...settingsForm } as any);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
  };

  const myUniqueBookings = useMemo(() => {
    return (allBookings || []).filter(b => b.bdmId === currentUser.id && !b.isBlocker);
  }, [allBookings, currentUser.id]);

  // FIX: rescheduled_bdm is now treated as an ACTIVE status so it stays in the worklist until final outcome.
  const activeAssignedBookings = useMemo(() => 
    myUniqueBookings.filter(b => ['active', 'rescheduled_bdm'].includes(b.status)), 
  [myUniqueBookings]);

  // FIX: rescheduled_bdm is excluded from Archive so it doesn't move to history prematurely.
  const archivedAssignedBookings = useMemo(() => 
    myUniqueBookings.filter(b => !['active', 'rejected', 'pending_approval', 'rescheduled_bdm'].includes(b.status)), 
  [myUniqueBookings]);
  
  const pendingRequests = useMemo(() => {
    return (allBookings || []).filter(b => b.bdmId === currentUser.id && b.status === 'pending_approval' && !b.isBlocker)
        .sort((a, b) => b.id - a.id);
  }, [allBookings, currentUser.id]);

  const rejectedBookings = useMemo(() => {
    return (allBookings || []).filter(b => b.bdmId === currentUser.id && b.status === 'rejected' && !b.isBlocker)
        .sort((a, b) => b.id - a.id);
  }, [allBookings, currentUser.id]);

  const matchesSearch = (b: Booking, term: string) => {
      if (!term) return true;
      const s = term.trim().toLowerCase();
      return (
          b.clientName.toLowerCase().includes(s) ||
          b.businessName.toLowerCase().includes(s) ||
          b.clientPhone.toLowerCase().includes(s) ||
          b.clientWebsite.toLowerCase().includes(s) ||
          b.address.toLowerCase().includes(s) ||
          b.callerName.toLowerCase().includes(s) ||
          b.vendor.name.toLowerCase().includes(s) ||
          (b.notes?.toLowerCase().includes(s)) ||
          (b.bdmNote?.toLowerCase().includes(s)) ||
          b.date.includes(s) ||
          b.time.toLowerCase().includes(s) ||
          b.region.toLowerCase().includes(s) ||
          b.status.toLowerCase().includes(s)
      );
  };

  // Logic for the ACTIVE list
  const filteredActiveBookings = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const tStr = formatDate(today);
    const tmStr = formatDate(tomorrow);
    const daStr = formatDate(dayAfter);

    const getPriority = (date: string) => {
        if (date === tStr) return 0;
        if (date === tmStr) return 1;
        if (date === daStr) return 2;
        return 3;
    };

    const search = searchTerm.trim().toLowerCase();

    return activeAssignedBookings.filter(booking => {
      if (dateRange.startDate && booking.date < dateRange.startDate) return false;
      if (dateRange.endDate && booking.date > dateRange.endDate) return false;
      
      if (!search) return true;
      return (
          booking.clientName.toLowerCase().includes(search) ||
          booking.businessName.toLowerCase().includes(search) ||
          booking.clientPhone.toLowerCase().includes(search) ||
          booking.clientWebsite.toLowerCase().includes(search) ||
          booking.address.toLowerCase().includes(search) ||
          booking.callerName.toLowerCase().includes(search) ||
          booking.vendor.name.toLowerCase().includes(search) ||
          (booking.notes?.toLowerCase() || '').includes(search) ||
          (booking.bdmNote?.toLowerCase() || '').includes(search) ||
          booking.date.includes(search) ||
          booking.time.toLowerCase().includes(search) ||
          booking.region.toLowerCase().includes(search) ||
          booking.status.toLowerCase().includes(search)
      );
    }).sort((a, b) => {
        const pA = getPriority(a.date);
        const pB = getPriority(b.date);

        if (pA !== pB) return pA - pB;
        
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return -dateDiff;
        
        const timeDiff = parseTime(a.time) - parseTime(b.time);
        if (timeDiff !== 0) return timeDiff;
        
        return b.id - a.id;
    });
  }, [searchTerm, activeAssignedBookings, dateRange]);

  // Logic for the ARCHIVED list
  const filteredArchivedBookings = useMemo(() => {
      const search = searchTerm.trim().toLowerCase();
      return archivedAssignedBookings.filter(booking => {
          const isSearching = search !== '' || dateRange.startDate || dateRange.endDate;
          const [y, m, d] = booking.date.split('-').map(Number);
          const bookingDate = new Date(y, m - 1, d); 
          if (!isSearching && bookingDate < visibilityCutoff) return false;
          if (dateRange.startDate && booking.date < dateRange.startDate) return false;
          if (dateRange.endDate && booking.date > dateRange.endDate) return false;
          
          if (!search) return true;
          return (
              booking.clientName.toLowerCase().includes(search) ||
              booking.businessName.toLowerCase().includes(search) ||
              booking.clientPhone.toLowerCase().includes(search) ||
              booking.clientWebsite.toLowerCase().includes(search) ||
              booking.address.toLowerCase().includes(search) ||
              booking.callerName.toLowerCase().includes(search) ||
              booking.vendor.name.toLowerCase().includes(search) ||
              (booking.notes?.toLowerCase() || '').includes(search) ||
              (booking.bdmNote?.toLowerCase() || '').includes(search) ||
              booking.date.includes(search) ||
              booking.time.toLowerCase().includes(search) ||
              booking.region.toLowerCase().includes(search) ||
              booking.status.toLowerCase().includes(search)
          );
      }).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [searchTerm, archivedAssignedBookings, dateRange, visibilityCutoff]);

  const analyticsBookings = useMemo(() => {
    return myUniqueBookings.filter(b => {
      const bDate = new Date(b.date);
      if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
      if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
      return true;
    });
  }, [myUniqueBookings, analyticsDateRange]);

  const totalPagesActive = Math.max(1, Math.ceil(filteredActiveBookings.length / ITEMS_PER_PAGE));
  const paginatedActiveBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActiveBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActiveBookings, currentPage]);

  const groupedActiveBookings = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    paginatedActiveBookings.forEach(b => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    return groups;
  }, [paginatedActiveBookings]);

  const sortedDateKeysActive = useMemo(() => Object.keys(groupedActiveBookings).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedActiveBookings]);

  const handleUpdateBookingStatus = (bookingId: number, newStatus: Booking['status'], note: string) => {
    let updatedBooking: Booking | undefined;
    setAllBookings(prev => { const newBookings = prev.map(b => { if (b.id === bookingId) { updatedBooking = { ...b, status: newStatus, bdmNote: note }; return updatedBooking; } return b; }); return newBookings; });
    
    if (updatedBooking) {
        if (updatedBooking.vendor.notificationPreferences?.statusChange && updatedBooking.vendor.email) {
            sendEmailNotification(
              updatedBooking.vendor.email, 
              `Lead Status Update: ${updatedBooking.businessName}`, 
              updatedBooking, 
              `Hello, BDM ${currentUser.name} has updated the status of ${updatedBooking.businessName} to ${newStatus.toUpperCase()}. Note: ${note}`,
              "LEAD STATUS UPDATED"
            );
        }
        managers.forEach(m => {
            if (m.notificationPreferences?.bdmStatusUpdate && m.email) {
                sendEmailNotification(
                  m.email, 
                  `BDM Update: ${updatedBooking?.businessName}`, 
                  updatedBooking || {}, 
                  `BDM ${currentUser.name} marked ${updatedBooking?.businessName} as ${newStatus.toUpperCase()}.`,
                  "LEAD STATUS UPDATED"
                );
            }
        });
    }

    if (updatedBooking) { const notificationStatus = newStatus === 'sold' ? 'seen' : newStatus; const newNotification: Notification = { id: Date.now(), vendorId: updatedBooking.vendor.id, bookingId: updatedBooking.id, message: `Your appointment for ${updatedBooking.clientName} has been updated to "${notificationStatus.charAt(0).toUpperCase() + notificationStatus.slice(1)}".`, read: false, timestamp: new Date().toISOString() }; setNotifications(prev => [...prev, newNotification]); }
    setBookingToUpdate(null); 
    triggerSystemAlert("Lead status updated and team notified.");
  };
  
  const handleSaveNoteAndReminder = (bookingId: number, note: string, reminder: string | null) => { 
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bdmPrivateNote: note || undefined, bdmReminder: reminder || undefined } : b)); 
    setBookingToManageNotes(null); 
  };

  const handleOpenRequestModal = (prefill: Booking | null = null) => { setRequestModalPrefill(prefill); setIsRequestModalOpen(true); };
  
  const handleRequestBooking = (bookingDetails: Omit<Booking, 'id' | 'status'>, _slotsToBlock: string[], originalId?: number) => {
      const requestId = originalId || Date.now();
      
      const normalizedWebsite = normalizeWebsite(bookingDetails.clientWebsite);
      
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const existingMatch = allBookings.find(b => {
          if (b.id === requestId || b.isBlocker || b.status === 'rejected') return false;
          const bDate = new Date(b.date);
          if (bDate < oneYearAgo) return false;
          return normalizedWebsite && normalizeWebsite(b.clientWebsite) === normalizedWebsite;
      });

      const newBooking: Booking = { 
          ...bookingDetails, 
          id: requestId, 
          status: 'pending_approval',
          isDuplicate: !!existingMatch,
          duplicateOfBookingId: existingMatch?.id,
          bookedAt: new Date().toISOString()
      };

      managers.forEach(m => { 
        if (m.notificationPreferences?.bookingRequest && m.email) {
            sendEmailNotification(
                m.email, 
                `BDM ${originalId ? 'Reschedule' : 'Request'}: Approval Required${existingMatch ? ' (DUPLICATE)' : ''}`, 
                newBooking, 
                `BDM ${currentUser.name} is requesting ${originalId ? 'a reschedule' : 'approval'} for a booking with ${bookingDetails.businessName}.${existingMatch ? ' WARNING: This appears to be a duplicate lead.' : ''} Please review it in your dashboard.`,
                "REBOOKING REQUEST"
            );
        }
      });
      const managerNotif: Notification = { id: Date.now(), vendorId: 0, bookingId: requestId, message: `${originalId ? 'Reschedule' : 'New'} Request from BDM ${currentUser.name}: ${bookingDetails.clientName}${existingMatch ? ' (Duplicate)' : ''}`, read: false, timestamp: new Date().toISOString() };
      setNotifications(prev => [...prev, managerNotif]);
      
      if (originalId) {
          setAllBookings(prev => prev.map(b => b.id === originalId ? newBooking : b));
      } else {
          setAllBookings(prev => [...prev, newBooking]);
      }
      
      setIsRequestModalOpen(false); 
      triggerSystemAlert(originalId ? "Reschedule request sent to Managers." : (existingMatch ? "Request sent (Duplicate detected)." : "Booking request sent to Managers."));
  };
  
  const bgColor = getRegionBackgroundColor(currentUser.region, regionColors);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: bgColor }}>
      <div>
        <Header currentUser={currentUser} onLogout={onLogout} branding={branding} notifications={(notifications || []).filter(n => n.vendorId === currentUser.id)} setNotifications={setNotifications} />
        <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
            <div className="mb-6 border-b border-gray-300/50 overflow-x-auto">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><DocumentTextIcon className="w-5 h-5" /> Appointments List</button>
                    <button onClick={() => setActiveTab('calendar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'calendar' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><CalendarDaysIcon className="w-5 h-5" /> My Calendar</button>
                    <button onClick={() => setActiveTab('performance')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'performance' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><PresentationChartLineIcon className="w-5 h-5" /> My Performance</button>
                    <button onClick={() => setActiveTab('settings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'settings' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Cog6ToothIcon className="w-5 h-5" /> Settings</button>
                </nav>
            </div>

            {activeTab === 'dashboard' && (
                <div className="animate-fadeIn">
                    {pendingRequests.length > 0 && (
                        <div className="mb-8 animate-fadeIn">
                            <div className="flex items-center gap-2 mb-4"><ClockIcon className="w-4 h-4 text-indigo-600 animate-spin-slow" /><h2 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Pending Rebooking Approvals ({pendingRequests.length})</h2></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className={`bg-white/80 backdrop-blur rounded-xl border p-3 shadow-sm flex flex-col justify-between ${req.isDuplicate && (new Date(req.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'border-amber-400 bg-amber-50/50' : (req.smsRequest?.status === 'pending' ? 'border-purple-400 bg-purple-50/50' : 'border-indigo-200')}`}>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1">
                                                    <div className="text-[10px] font-black text-indigo-600 uppercase">Pending Review</div>
                                                    {req.isDuplicate && (new Date(req.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) && <span className="text-[8px] bg-amber-200 text-amber-800 px-1 rounded font-black">DUPLICATE</span>}
                                                    {req.smsRequest?.status === 'pending' && <span className="text-[8px] bg-purple-200 text-purple-800 px-1 rounded font-black">SMS REQUESTED</span>}
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">{req.region}</div>
                                            </div>
                                            <div className="font-bold text-gray-900 text-sm leading-tight truncate">{req.businessName}</div>
                                            <div className="text-[11px] text-gray-500 truncate mb-2">{req.clientName}</div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600">
                                                <CalendarDaysIcon className="w-3 h-3 text-gray-400" />
                                                {formatDDMMYY(req.date)}
                                                <span className="text-gray-300">|</span>
                                                <ClockIcon className="w-3 h-3 text-gray-400" />
                                                {req.time}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Active Appointments</h1>
                            <p className="text-sm text-gray-500 font-medium">Confirmed leads waiting for their meeting.</p>
                        </div>
                        <button 
                            onClick={() => handleOpenRequestModal(null)} 
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 shadow-md transition-all font-bold uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" /> {isSyncing ? 'Syncing...' : 'Request Booking'}
                        </button>
                    </div>
                    
                    <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end items-stretch">
                        <div className="flex-1">
                            <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-grow flex items-center">
                                <MagnifyingGlassIcon className="absolute left-3 w-5 h-5 text-gray-400" />
                                <input type="text" className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black" placeholder="Search leads..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full"><XMarkIcon className="w-5 h-5" /></button>)}
                            </div>
                            <button onClick={() => exportBookingsToCSV(filteredActiveBookings, 'bdm_active_leads')} className="px-4 py-2 bg-white border rounded-md font-bold text-sm">Export</button>
                        </div>
                    </div>

                    <div className="space-y-12 pb-12">
                        {/* ACTIVE SECTION */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-black"><tr><th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Client & Business</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Calling Team</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Notes</th><th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th></tr></thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedDateKeysActive.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No active appointments matching your criteria.</td></tr>
                                        ) : (
                                            sortedDateKeysActive.map(dateKey => (
                                                <React.Fragment key={dateKey}>
                                                    <tr className="bg-gray-50 border-y border-gray-200"><td colSpan={6} className="px-6 py-3 text-sm font-bold text-gray-700 uppercase tracking-tight">{formatDDMMYY(dateKey)}</td></tr>
                                                    {groupedActiveBookings[dateKey].map(booking => (
                                                        <tr key={booking.id} className={`hover:bg-blue-50/30 transition-colors ${booking.isDuplicate && (new Date(booking.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'bg-amber-50 border-l-4 border-amber-400' : (booking.smsRequest?.status === 'pending' ? 'bg-purple-50 border-l-4 border-purple-400' : '')}`}>
                                                            <td className="px-6 py-5 align-top">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="text-base font-bold text-gray-900">{booking.clientName}</div>
                                                                    {booking.isDuplicate && (new Date(booking.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) && (
                                                                        <span className="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">DUPLICATE</span>
                                                                    )}
                                                                    {booking.smsRequest?.status === 'pending' && (
                                                                        <span className="text-[9px] font-black bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">SMS REQUESTED</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    {booking.clientWebsite && (
                                                                        <a href={booking.clientWebsite.startsWith('http') ? booking.clientWebsite : `https://${booking.clientWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline font-medium break-all">
                                                                            {booking.clientWebsite}
                                                                        </a>
                                                                    )}
                                                                    {booking.clientPhone && (
                                                                        <a href={`tel:${booking.clientPhone}`} className="text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium">
                                                                            {booking.clientPhone}
                                                                        </a>
                                                                    )}
                                                                    {booking.address && (
                                                                        <div className="mt-1 pt-1 border-t border-gray-100 flex items-start gap-1.5">
                                                                            <MapPinIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                                                            <div className="flex-1">
                                                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Meeting Address</p>
                                                                                <a 
                                                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium block leading-tight transition-colors"
                                                                                >
                                                                                    {booking.address}
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td><td className="px-6 py-5 align-top whitespace-nowrap text-sm text-gray-600 font-medium pt-7">{booking.vendor.name}</td><td className="px-6 py-5 align-top whitespace-nowrap pt-7"><div className="text-sm font-black text-gray-900">{booking.time}</div></td><td className="px-6 py-5 align-top pt-6">{getStatusPill(booking.status)}</td><td className="px-6 py-5 align-top text-sm text-gray-500 max-w-xs pt-7"><ExpandableNote text={booking.bdmNote || booking.notes} /></td><td className="px-6 py-5 align-top whitespace-nowrap text-sm font-medium pt-6">
                                                                <div className="flex justify-end gap-2">
                                                                    {booking.status === 'rescheduled_bdm' && (
                                                                    <button 
                                                                        onClick={() => handleOpenRequestModal(booking)} 
                                                                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md border border-orange-200" 
                                                                        title="Request Reschedule Approval"
                                                                    >
                                                                        <ArrowPathIcon className="w-4 h-4" />
                                                                    </button>
                                                                    )}
                                                                    <button onClick={() => setBookingToUpdate(booking)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md border border-indigo-200" title="Update Lead Result / Status">
                                                                    <PencilSquareIcon className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => setBookingToManageNotes(booking)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md border border-indigo-200" title="Private Notes & Reminders">
                                                                    <BellIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td></tr>
                                                    ))}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-gray-200">
                                {sortedDateKeysActive.length === 0 ? (
                                    <div className="px-6 py-12 text-center text-gray-500 italic">No active appointments matching your criteria.</div>
                                ) : (
                                    sortedDateKeysActive.map(dateKey => (
                                        <div key={dateKey}>
                                            <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 uppercase tracking-tight border-y border-gray-200">
                                                {formatDDMMYY(dateKey)}
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {groupedActiveBookings[dateKey].map(booking => (
                                                    <div key={booking.id} className={`p-4 ${booking.isDuplicate && (new Date(booking.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'bg-amber-50 border-l-4 border-amber-400' : (booking.smsRequest?.status === 'pending' ? 'bg-purple-50 border-l-4 border-purple-400' : '')}`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <div className="text-base font-bold text-gray-900">{booking.clientName}</div>
                                                                    {booking.isDuplicate && (new Date(booking.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) && (
                                                                        <span className="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">DUPLICATE</span>
                                                                    )}
                                                                    {booking.smsRequest?.status === 'pending' && (
                                                                        <span className="text-[9px] font-black bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">SMS REQUESTED</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500 font-medium mb-1">{booking.businessName}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm font-black text-gray-900">{booking.time}</div>
                                                                <div className="mt-1">{getStatusPill(booking.status)}</div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Calling Team</p>
                                                                <p className="text-xs text-gray-600 font-medium">{booking.vendor.name}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Contact</p>
                                                                {booking.clientPhone && (
                                                                    <a href={`tel:${booking.clientPhone}`} className="text-xs text-indigo-600 font-medium block">
                                                                        {booking.clientPhone}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {booking.address && (
                                                            <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                    <MapPinIcon className="w-3 h-3" /> Meeting Address
                                                                </p>
                                                                <a 
                                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-indigo-600 hover:underline font-medium block leading-tight"
                                                                >
                                                                    {booking.address}
                                                                </a>
                                                            </div>
                                                        )}

                                                        <div className="mb-4">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                                                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                                                <ExpandableNote text={booking.bdmNote || booking.notes} />
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button onClick={() => setBookingToUpdate(booking)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm">
                                                                <PencilSquareIcon className="w-4 h-4" /> Update Status
                                                            </button>
                                                            <button onClick={() => setBookingToManageNotes(booking)} className="px-3 py-2 bg-white border border-gray-200 text-gray-400 rounded-lg hover:text-indigo-600 transition-colors shadow-sm">
                                                                <BellIcon className="w-4 h-4" />
                                                            </button>
                                                            {booking.status === 'rescheduled_bdm' && (
                                                                <button 
                                                                    onClick={() => handleOpenRequestModal(booking)} 
                                                                    className="px-3 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors shadow-sm"
                                                                >
                                                                    <ArrowPathIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{filteredActiveBookings.length} active records</span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(1)} 
                                        disabled={currentPage === 1} 
                                        className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                        First
                                    </button>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                        disabled={currentPage === 1} 
                                        className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-xs font-bold text-gray-600">Page {currentPage} of {totalPagesActive}</span>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPagesActive, p + 1))} 
                                        disabled={currentPage === totalPagesActive} 
                                        className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                        Next
                                    </button>
                                    <button 
                                        onClick={() => setCurrentPage(totalPagesActive)} 
                                        disabled={currentPage === totalPagesActive} 
                                        className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ARCHIVED SECTION */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Archived Appointments & History</h2>
                                    <p className="text-sm text-gray-500 font-medium">History of processed leads and outcomes.</p>
                                </div>
                                {!searchTerm && !dateRange.startDate && (
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100">Showing last 7 days only</p>
                                )}
                            </div>
                            <ArchivedBookingsList 
                              bookings={filteredArchivedBookings} 
                              role="bdm" 
                              searchTerm={searchTerm} 
                              onEditBooking={setBookingToUpdate} 
                            />
                        </div>

                        {rejectedBookings.length > 0 && (<div className="mt-12 animate-fadeIn"><div className="flex items-center gap-2 mb-4"><ExclamationTriangleIcon className="w-5 h-5 text-red-600" /><h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Rejected Booking Requests</h2></div><div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"><RejectedBookingsList bookings={rejectedBookings} role="bdm" searchTerm={searchTerm} /></div></div>)}
                    </div>
                </div>
            )}
            {activeTab === 'calendar' && <div className="animate-fadeIn"><UnifiedCalendar bookings={myUniqueBookings} currentUser={currentUser} appointments={personalAppointments} setAppointments={setPersonalAppointments} allBookingsForAvailability={allBookings} salespeopleCount={salespeopleCount} publicHolidays={publicHolidays} appointmentTimes={appointmentTimes} leaveDays={leaveDays} region={currentUser.region} bdms={bdms} /></div>}
            {activeTab === 'performance' && (<div className="animate-fadeIn mt-6 space-y-8"><div className="bg-white p-6 rounded-lg shadow border border-gray-200"><h3 className="text-lg font-bold text-gray-800 mb-4">Analytics Controls</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"><DateRangePicker startDate={analyticsDateRange.startDate} endDate={analyticsDateRange.endDate} onDateChange={setAnalyticsDateRange} /><div className="flex flex-col"><label className="block text-sm font-medium text-gray-700 mb-1">Trend Grouping</label><div className="flex flex-wrap rounded-md shadow-sm">{['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setAnalyticsTimePeriod(p as any)} className={`flex-1 min-w-[70px] py-2 text-sm border capitalize transition-all ${analyticsTimePeriod === p ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{p}</button>)}</div></div></div></div><BdmAnalyticsDashboard bookings={analyticsBookings} /><TrendAnalytics bookings={analyticsBookings} period={analyticsTimePeriod} /><div className="mt-12"><div className="mb-4"><h2 className="text-2xl font-black text-gray-900 tracking-tight">Your Full Assignment History</h2><p className="text-sm text-gray-500 font-medium">Complete record of every lead assigned to your profile.</p></div><PerformanceLeadLog bookings={analyticsBookings} role="bdm" title="Full Assignment Performance Log" /></div></div>)}
            {activeTab === 'settings' && (<div className="animate-fadeIn mt-6 max-w-2xl mx-auto"><div className="bg-white p-8 rounded-lg shadow-md border border-gray-200"><h2 className="text-2xl font-black text-gray-900 mb-6">Settings</h2><form onSubmit={handleSaveSettings} className="space-y-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Contact Email</label><input type="email" value={settingsForm.email} onChange={e => setSettingsForm({...settingsForm, email: e.target.value})} className="w-full border border-gray-300 p-3 rounded-md" /></div><NotificationSettings preferences={settingsForm.notificationPreferences} onChange={(p) => setSettingsForm({...settingsForm, notificationPreferences: p})} role="bdm" /><div className="pt-6 flex justify-end"><button type="submit" className="px-8 py-3 bg-black text-white font-black rounded-lg uppercase tracking-widest text-xs">Save Changes</button></div></form></div></div>)}
            </div>
        </main>
        {bookingToUpdate && <BdmUpdateStatusModal booking={bookingToUpdate} onClose={() => setBookingToUpdate(null)} onSave={handleUpdateBookingStatus} />}
        {bookingToManageNotes && <BdmNoteReminderModal booking={bookingToManageNotes} onClose={() => setBookingToManageNotes(null)} onSave={handleSaveNoteAndReminder} />}
        {isRequestModalOpen && <BdmBookingRequestModal currentUser={currentUser} vendors={vendors} onClose={() => setIsRequestModalOpen(false)} onRequestBooking={handleRequestBooking} prefillData={requestModalPrefill} regions={regions} appointmentTimes={appointmentTimes} allBookings={allBookings} />}
      </div>
    </div>
  );
};

export default BdmDashboard;
