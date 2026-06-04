import React, { useState, useMemo, useEffect } from 'react';
import type { Vendor, Booking, Region, LeaveDay, PublicHoliday, AppointmentSlotsConfig, BDM, Notification, User, Branding, Manager, NotificationPreferences, ManagerAppointment } from '../types';
import { Header } from './Header';
import CalendarView from './CalendarView';
import BookingModal from './BookingModal';
import MyBookingsList from './MyBookingsList';
import AnalyticsDashboard from './AnalyticsDashboard';
import RejectedBookingsList from './RejectedBookingsList';
import CallerPerformanceAnalytics from './CallerPerformanceAnalytics';
import StatusAnalytics from './StatusAnalytics';
import PerformanceLeadLog from './PerformanceLeadLog';
import { MagnifyingGlassIcon, ArrowDownTrayIcon, ChartBarIcon, DocumentTextIcon, PresentationChartLineIcon, XMarkIcon, Cog6ToothIcon, CalendarDaysIcon, PlusIcon, ExclamationTriangleIcon, ClockIcon } from './Icons';
import DateRangePicker from './DateRangePicker';
import { exportBookingsToCSV } from '../utils/exportUtils';
import { getRegionBackgroundColor } from '../utils/regionUtils';
import TrendAnalytics, { TimePeriod } from './TrendAnalytics';
import NotificationSettings from './NotificationSettings';
import UnifiedCalendar from './UnifiedCalendar';
import BdmBookingRequestModal from './BdmBookingRequestModal';
import ArchivedBookingsList from './ArchivedBookingsList';
import { sendEmailNotification } from '../utils/emailService';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../constants';
import { formatDDMMYY } from '../utils/dateUtils';
import { maskSoldText } from '../utils/statusUtils';
import { saveSingleBookingToFirebase } from '../services/firebaseService';
import { saveSingleBookingToFirebase, deleteSingleBookingFromFirebase } from '../services/firebaseService';

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};

interface DashboardProps {
  currentUser: Extract<User, { role: 'vendor' }>;
  onLogout: () => void;
  allBookings: Booking[];
  setAllBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  salespeopleCount: Record<Region, number>;
  publicHolidays: PublicHoliday[];
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  leaveDays: LeaveDay[];
  bdms: BDM[];
  vendors: Vendor[];
  managers: Manager[];
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  branding: Branding;
  regions: Region[];
  regionColors: Record<string, string>;
  onUpdateProfile: (user: User) => void;
  personalAppointments: ManagerAppointment[];
  setPersonalAppointments: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
  isSyncing: boolean;
}

const triggerSystemAlert = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-indigo-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] animate-bounceIn flex items-center gap-4 border-2 border-white/20';
    toast.innerHTML = `<div class="bg-white/20 p-2 rounded-lg">🔔</div><div><p class="font-bold text-xs uppercase tracking-widest opacity-70">System Alert</p><p class="text-sm font-medium">${message}</p></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-full'); setTimeout(() => document.body.removeChild(toast), 500); }, 5000);
};

interface SlotManagementInfo { date: Date; time: string; isCustom: boolean; region: Region; }

const Dashboard: React.FC<DashboardProps> = ({ 
    currentUser, onLogout, allBookings, setAllBookings, salespeopleCount, publicHolidays, 
    appointmentTimes, leaveDays, bdms, vendors, managers, notifications, setNotifications, 
    branding, regions, regionColors, onUpdateProfile, personalAppointments, setPersonalAppointments, isSyncing 
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'calendar' | 'performance' | 'settings'>('bookings');
  const [slotToManage, setSlotToManage] = useState<SlotManagementInfo | null>(null);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  
  const allowedRegions = useMemo(() => {
      if (currentUser.allowedRegions && currentUser.allowedRegions.length > 0) {
          return (regions || []).filter(r => currentUser.allowedRegions!.includes(r));
      }
      return regions || [];
  }, [currentUser, regions]);

  const [currentRegion, setCurrentRegion] = useState<Region>(allowedRegions[0] || regions[0] || 'NSW');

  useEffect(() => {
      if (!allowedRegions.includes(currentRegion) && allowedRegions.length > 0) {
          setCurrentRegion(allowedRegions[0]);
      }
  }, [allowedRegions, currentRegion]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
  const [analyticsDateRange, setAnalyticsDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
  const [analyticsTimePeriod, setAnalyticsTimePeriod] = useState<TimePeriod>('monthly');

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

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateProfile({ ...currentUser, ...settingsForm } as any);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleOpenSlotManager = (date: Date, time: string, isCustom: boolean, region: Region) => setSlotToManage({ date, time, isCustom, region });
  const handleEditFromList = (booking: Booking) => setBookingToEdit(booking);
  const handleDeleteBooking = (bookingId: number) => { 
    if (window.confirm('Delete booking?')) {
        const bookingToDelete = allBookings.find(b => b.id === bookingId);
        setAllBookings(prev => prev.filter(b => b.id !== bookingId && b.parentBookingId !== bookingId));
        
        // BACKGROUND SYNC: Delete from Firebase
        if (bookingToDelete && !bookingToDelete.isBlocker) {
            deleteSingleBookingFromFirebase(bookingId).catch(error => {
                console.error("Background sync failed for deletion:", bookingId, error);
            });
        }
        triggerSystemAlert("Booking deleted.");
    }
};
  const handleEditFromModal = (booking: Booking) => { setSlotToManage(null); setBookingToEdit(booking); };
  const closeModal = () => { setSlotToManage(null); setBookingToEdit(null); };

  const handleConfirmBooking = async (bookingDetails: Omit<Booking, 'id' | 'vendor' | 'status'>, slotsToRemove: string[]) => {
    const mainBookingId = Date.now();
    
    // Duplicate Check
    const normalizedWebsite = normalizeWebsite(bookingDetails.clientWebsite);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const existingMatch = allBookings.find(b => {
        if (b.isBlocker || b.status === 'rejected') return false;
        const bDate = new Date(b.date);
        if (bDate < oneYearAgo) return false;
        return normalizedWebsite && normalizeWebsite(b.clientWebsite) === normalizedWebsite;
    });

    const newBooking: Booking = { 
        ...bookingDetails, 
        id: mainBookingId, 
        createdAt: new Date().toISOString().split('T')[0], // Add createdAt
        vendor: currentUser, 
        status: 'active',
        isDuplicate: !!existingMatch,
        duplicateOfBookingId: existingMatch?.id
    };

    const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ 
        id: Date.now() + index + 1, 
        clientName: `Slot Blocked`, 
        businessName: `Conflict`, 
        clientWebsite: '', 
        clientPhone: '', 
        address: '', 
        callerName: 'System', 
        date: bookingDetails.date, 
        time: time, 
        vendor: currentUser, 
        region: bookingDetails.region, 
        isBlocker: true, 
        parentBookingId: mainBookingId, 
        status: 'active' 
    }));
    
    // NOTIFY MANAGERS VIA EMAIL (don't await - fire and forget)
    managers.forEach(m => {
        if (m.notificationPreferences?.newBooking && m.email) {
            sendEmailNotification(
                m.email,
                `New Booking: ${bookingDetails.businessName}${existingMatch ? ' (DUPLICATE)' : ''}`,
                newBooking,
                `Hello Admin, a new booking has been confirmed by ${currentUser.name} for ${bookingDetails.clientName} at ${bookingDetails.businessName}.${existingMatch ? ' WARNING: This appears to be a duplicate lead.' : ''}`,
                "NEW BOOKING CONFIRMED"
            );
        }
    });

    // OPTIMISTIC UI UPDATE: Update local state immediately
    setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: mainBookingId, message: `New Booking: ${bookingDetails.clientName} by ${currentUser.name}${existingMatch ? ' (Duplicate)' : ''}`, read: false, timestamp: new Date().toISOString() }]);
    setAllBookings(prev => [...prev, newBooking, ...newBlockers]);
    closeModal();
    triggerSystemAlert(existingMatch ? "Booking confirmed (Duplicate detected)." : "Booking confirmed. Admins notified.");
    
    // BACKGROUND SYNC: Save to Firebase without blocking UI
    saveSingleBookingToFirebase(newBooking).catch(error => {
        console.error("Background sync failed for booking:", newBooking.id, error);
        // Don't show error to user - will sync on next full sync
    });
};
  
  const handleUpdateBooking = (updatedDetails: any, slotsToRemove: string[]) => {
    if (!bookingToEdit) return;

    // RE-CHECK DUPLICATE
    const normalizedWebsite = normalizeWebsite(updatedDetails.clientWebsite || bookingToEdit.clientWebsite);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const existingMatch = allBookings.find(b => {
        if (b.id === bookingToEdit.id || b.isBlocker || b.status === 'rejected') return false;
        const bDate = new Date(b.date);
        if (bDate < oneYearAgo) return false;
        return normalizedWebsite && normalizeWebsite(b.clientWebsite) === normalizedWebsite;
    });

    setAllBookings(prevBookings => {
        const otherBookings = prevBookings.filter(b => b.id !== bookingToEdit.id && b.parentBookingId !== bookingToEdit.id);
        const updatedBooking: Booking = { 
            ...bookingToEdit, 
            ...updatedDetails,
            isDuplicate: !!existingMatch,
            duplicateOfBookingId: existingMatch?.id
        };
        const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ id: Date.now() + index + 1, clientName: `Slot Blocked`, businessName: `Conflict`, clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: updatedBooking.date, time: time, vendor: bookingToEdit.vendor, region: updatedBooking.region, isBlocker: true, parentBookingId: updatedBooking.id, status: 'active' }));
        return [...otherBookings, updatedBooking, ...newBlockers];
    });
    closeModal();
  };

  const handleRequestManualBooking = async (bookingDetails: Omit<Booking, 'id' | 'status'>) => {
    const requestId = Date.now();
    
    // Duplicate Check
    const normalizedWebsite = normalizeWebsite(bookingDetails.clientWebsite);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const existingMatch = allBookings.find(b => {
        if (b.isBlocker || b.status === 'rejected') return false;
        const bDate = new Date(b.date);
        if (bDate < oneYearAgo) return false;
        return normalizedWebsite && normalizeWebsite(b.clientWebsite) === normalizedWebsite;
    });

    const newBooking: Booking = { 
        ...bookingDetails, 
        id: requestId, 
        createdAt: new Date().toISOString().split('T')[0], // Add createdAt
        status: 'pending_approval',
        isDuplicate: !!existingMatch,
        duplicateOfBookingId: existingMatch?.id
    };
    
    // NOTIFY MANAGERS VIA EMAIL (fire and forget - don't await)
    managers.forEach(m => { 
        if (m.notificationPreferences?.bookingRequest && m.email) {
            sendEmailNotification(
                m.email,
                `ACTION REQUIRED: Manual Date Request${existingMatch ? ' (DUPLICATE)' : ''}`,
                newBooking,
                `Hello, ${currentUser.name} is requesting approval for a manual appointment date with ${bookingDetails.businessName}.${existingMatch ? ' WARNING: This contact info matches an existing lead.' : ''} Please review this in your dashboard.`,
                "MANUAL DATE REQUEST"
            );
        }
    });

    // OPTIMISTIC UI UPDATE: Update local state immediately
    setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: requestId, message: `Manual Request from ${currentUser.name}: ${bookingDetails.clientName}${existingMatch ? ' (Duplicate)' : ''}`, read: false, timestamp: new Date().toISOString() }]);
    setAllBookings(prev => [...prev, newBooking]);
    setIsRequestModalOpen(false); 
    triggerSystemAlert(existingMatch ? "Manual request sent (Duplicate detected)." : "Manual request sent to Admin.");
    
    // BACKGROUND SYNC: Save to Firebase without blocking UI
    saveSingleBookingToFirebase(newBooking).catch(error => {
        console.error("Background sync failed for manual request:", newBooking.id, error);
    });
};

  const handleRequestSms = (bookingId: number, type: string, message: string) => {
      const booking = allBookings.find(b => b.id === bookingId);
      setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, smsRequest: { type: type as any, message, status: 'pending', requestedAt: new Date().toISOString() } } : b));
      
      // EMAIL MANAGERS
      managers.forEach(m => { 
        if (m.notificationPreferences?.smsRequest && m.email) {
            sendEmailNotification(
                m.email,
                `SMS Request: ${type}`,
                booking || {},
                `Hello, ${currentUser.name} has requested an SMS be sent to ${booking?.clientName} (${booking?.businessName}). Context: ${message}`,
                "SMS ASSISTANCE REQUESTED"
            );
        }
      });

      setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: bookingId, message: `SMS Request from ${currentUser.name}: ${type}.`, read: false, timestamp: new Date().toISOString() }]);
      triggerSystemAlert("SMS request sent.");
  };

  // Exhaustive Search Helper
  const matchesGlobalSearch = (b: Booking, term: string) => {
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

  const myBookings = useMemo(() => 
    (allBookings || []).filter(b => 
      b && b.vendor && b.vendor.id === currentUser.id && 
      !b.callerName?.toLowerCase().includes('zeal digital')
    ), 
    [allBookings, currentUser.id]
  );
  
  const mappedMyBookings = useMemo(() => myBookings.map(booking => {
    const mapped = booking.status === 'sold' ? { ...booking, status: 'seen' as const } : booking;
    return {
      ...mapped,
      notes: maskSoldText(mapped.notes),
      bdmNote: maskSoldText(mapped.bdmNote),
      rejectionReason: maskSoldText(mapped.rejectionReason)
    };
  }), [myBookings]);
  
  // EXHAUSTIVE SEARCH FOR VENDORS
  const filteredVendorBookings = useMemo(() => {
    return mappedMyBookings.filter(booking => {
      if (booking.status === 'rejected' || booking.status === 'pending_approval') return false; 
      
      const bookingDate = new Date(booking.date);
      if (dateRange.startDate && bookingDate < new Date(dateRange.startDate)) return false;
      if (dateRange.endDate && bookingDate > new Date(dateRange.endDate)) return false;
      
      return matchesGlobalSearch(booking, searchTerm);
    });
  }, [searchTerm, mappedMyBookings, dateRange]);

  // PENDING MANUAL REQUESTS for current vendor
  const pendingRequests = useMemo(() => {
      return mappedMyBookings.filter(b => b.status === 'pending_approval' && !b.isBlocker)
        .sort((a, b) => b.id - a.id);
  }, [mappedMyBookings]);

  const analyticsBookings = useMemo(() => {
    // For individual callers, show ONLY their OWN bookings (by vendor ID AND caller name)
    return mappedMyBookings.filter(b => {
      if (b.isBlocker) return false;
      
      // 1. Must belong to this vendor/calling team
      if (b.vendor.id !== currentUser.id) return false;
      
      // 2. Must be booked by THIS SPECIFIC individual caller (case-insensitive)
      //    This ensures "Caller 1" only sees their own leads, not "Caller 2" or "Caller 3"
      if (!b.callerName || b.callerName.toLowerCase() !== currentUser.name.toLowerCase()) return false;
      
      if (allowedRegions.length > 0 && !allowedRegions.includes(b.region)) return false;
      const bDate = new Date(b.date);
      if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
      if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
      return true;
    });
  }, [mappedMyBookings, analyticsDateRange, allowedRegions, currentUser.id, currentUser.name]);

  const archivedBookings = useMemo(() => {
    const allArchived = mappedMyBookings.filter(b => ['seen', 'rescheduled', 'cancelled', 'dq', 'rescheduled_bdm'].includes(b.status));
    if (searchTerm.trim()) {
        return allArchived.filter(b => matchesGlobalSearch(b, searchTerm));
    }
    const today = new Date(); today.setHours(0,0,0,0); const cutoff = new Date(today); cutoff.setDate(today.getDate() - 14);
    return allArchived.filter(b => { const bDate = new Date(b.date); return bDate >= cutoff; });
  }, [mappedMyBookings, searchTerm]);

  const activeBookings = useMemo(() => filteredVendorBookings.filter(b => b.status === 'active'), [filteredVendorBookings]);
  
  const rejectedBookings = useMemo(() => {
      const list = mappedMyBookings.filter(b => b.status === 'rejected' && !b.isBlocker);
      return list.filter(b => matchesGlobalSearch(b, searchTerm));
  }, [mappedMyBookings, searchTerm]);

  const myNotifications = useMemo(() => (notifications || []).filter(n => n.vendorId === currentUser.id), [notifications, currentUser.id]);
  const calendarBookingsForRegion = useMemo(() => 
    (allBookings || []).filter(b => b.region.trim().toUpperCase() === currentRegion.trim().toUpperCase()), 
    [allBookings, currentRegion]
  );
  const blockedSlotsForEdit = useMemo(() => bookingToEdit ? (allBookings || []).filter(b => b.parentBookingId === bookingToEdit.id).map(b => b.time) : [], [bookingToEdit, allBookings]);
  const bgColor = getRegionBackgroundColor(currentRegion, regionColors);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: bgColor }}>
        <div> 
          <Header currentUser={currentUser} onLogout={onLogout} notifications={myNotifications} setNotifications={setNotifications} branding={branding} />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              
              <div className="mb-6 border-b border-gray-300/50">
                <nav className="flex flex-wrap gap-x-6 gap-y-2 -mb-px">
                    <button 
                        onClick={() => setActiveTab('bookings')} 
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'bookings' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <DocumentTextIcon className="w-5 h-5" /> 
                        <span>Booking Slots</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('calendar')} 
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'calendar' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <CalendarDaysIcon className="w-5 h-5" /> 
                        <span>My Calendar</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('performance')} 
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'performance' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <PresentationChartLineIcon className="w-5 h-5" /> 
                        <span>My Performance</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')} 
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'settings' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Cog6ToothIcon className="w-5 h-5" /> 
                        <span>Settings</span>
                    </button>
                </nav>
            </div>

              {activeTab === 'bookings' && (
                  <div className="animate-fadeIn">
                    {/* TOP SECTION: Pending Manual Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="mb-8 animate-fadeIn">
                            <div className="flex items-center gap-2 mb-4">
                                <ClockIcon className="w-4 h-4 text-indigo-600 animate-spin-slow" />
                                <h2 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Your Pending Manual Requests ({pendingRequests.length})</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className={`bg-white/80 backdrop-blur rounded-xl border p-3 shadow-sm flex flex-col justify-between ${req.isDuplicate && (new Date(req.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'border-amber-400 bg-amber-50/50' : (req.smsRequest?.status === 'pending' ? 'border-purple-400 bg-purple-50/50' : 'border-indigo-200')}`}>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1">
                                                    <div className="text-[10px] font-black text-indigo-600 uppercase">Pending Approval</div>
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
                            <div className="mt-2 text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">Managers have been notified. Please wait for confirmation.</div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div className="border-b border-gray-300 flex-grow">
                            <nav className="-mb-px flex space-x-8 overflow-x-auto">
                                {allowedRegions.map((region) => (
                                    <button key={region} onClick={() => setCurrentRegion(region)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${region === currentRegion ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{region}</button>
                                ))}
                            </nav>
                        </div>
                        <button 
                            onClick={() => setIsRequestModalOpen(true)}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 shadow-md transition-all font-bold uppercase text-xs tracking-widest whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" /> {isSyncing ? 'Syncing...' : 'Request Manual Date'}
                        </button>
                    </div>
                    {allowedRegions.length > 0 && (
                        <CalendarView allBookingsForRegion={calendarBookingsForRegion} onSelectSlot={handleOpenSlotManager} region={currentRegion} salespeopleCount={salespeopleCount} publicHolidays={publicHolidays} appointmentTimes={appointmentTimes} leaveDays={leaveDays} />
                    )}
                    <div className="mt-8 flex flex-col md:flex-row gap-4 md:items-end items-stretch">
                        <div className="flex-1">
                            <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-grow flex items-center">
                                <MagnifyingGlassIcon className="absolute left-3 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black" 
                                    placeholder="Search Leads..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <button onClick={() => exportBookingsToCSV(filteredVendorBookings, 'bookings')} className="px-4 py-2 bg-white border rounded-md text-sm font-bold hover:bg-gray-50">Export</button>
                        </div>
                    </div>
                    
                    {searchTerm.trim() !== '' ? (
                        <div className="mt-8 mb-8 animate-fadeIn">
                            <MyBookingsList bookings={filteredVendorBookings} onEditBooking={handleEditFromList} onDeleteBooking={handleDeleteBooking} searchTerm={searchTerm} onRequestSms={handleRequestSms} />
                        </div>
                    ) : (
                        <>
                            <div className="mt-8 space-y-8">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 mb-4">Your Recent Bookings</h2>
                                    < MyBookingsList bookings={activeBookings} onEditBooking={handleEditFromList} onDeleteBooking={handleDeleteBooking} searchTerm={searchTerm} onRequestSms={handleRequestSms} />
                                </div>
                            </div>

                            <div className="mt-12 space-y-8">
                                <ArchivedBookingsList bookings={archivedBookings} role="vendor" searchTerm={searchTerm} />
                            </div>

                            {rejectedBookings.length > 0 && (
                                <div className="mt-12 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fadeIn">
                                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-xl font-black text-[#0F172A] tracking-tight">Rejected Appointments ({rejectedBookings.length})</h3>
                                    </div>
                                    <RejectedBookingsList bookings={rejectedBookings} role="vendor" searchTerm={searchTerm} />
                                </div>
                            )}
                        </>
                    )}
                  </div>
              )}

              {activeTab === 'calendar' && (
                  <div className="animate-fadeIn">
                      <UnifiedCalendar 
                        bookings={mappedMyBookings.filter(b => !b.isBlocker)} 
                        currentUser={currentUser} 
                        appointments={personalAppointments}
                        setAppointments={setPersonalAppointments}
                      />
                  </div>
              )}

                {activeTab === 'performance' && (
                  <div className="animate-fadeIn mt-6 space-y-8">
                    {/* My Performance Header */}
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-2">My Performance Analytics</h3>
                      <p className="text-sm text-gray-500">View your personal performance metrics by caller name</p>
                      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <DateRangePicker 
                          startDate={analyticsDateRange.startDate} 
                          endDate={analyticsDateRange.endDate} 
                          onDateChange={setAnalyticsDateRange} 
                        />
                        {(analyticsDateRange.startDate || analyticsDateRange.endDate) && (
                          <button 
                            onClick={() => setAnalyticsDateRange({ startDate: null, endDate: null })}
                            className="px-3 py-2 text-xs font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Clear Date Filter
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Caller Performance - Individual Caller View */}
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                      <CallerPerformanceAnalytics bookings={mappedMyBookings.filter(b => {
                        if (b.isBlocker) return false;
                        if (b.vendor.id !== currentUser.id) return false;
                        if (!b.callerName || b.callerName.toLowerCase() !== currentUser.name.toLowerCase()) return false;
                        return true;
                      })} />
                    </div>
                    
                    {/* Personal Lead Log - All leads for this caller (NO date filter) */}
                    <PerformanceLeadLog 
                      bookings={mappedMyBookings.filter(b => {
                        if (b.isBlocker) return false;
                        if (b.vendor.id !== currentUser.id) return false;
                        if (!b.callerName || b.callerName.toLowerCase() !== currentUser.name.toLowerCase()) return false;
                        return true;
                      })} 
                      role="vendor" 
                      title="My Lead Activity Log" 
                      hideFilters={true}
                    />
                  </div>
                )}
              {activeTab === 'settings' && (
                  <div className="animate-fadeIn mt-6 max-w-2xl mx-auto">
                      <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
                          <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Settings</h2>
                          <form onSubmit={handleSaveSettings} className="space-y-6">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                                  <input 
                                    type="email" 
                                    value={settingsForm.email} 
                                    onChange={e => setSettingsForm({...settingsForm, email: e.target.value})} 
                                    className="w-full border border-gray-300 p-3 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                                    placeholder="Enter your email for alerts"
                                  />
                              </div>
                              <div className="pt-4 border-t border-gray-100">
                                  <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
                                  <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                                      <NotificationSettings preferences={settingsForm.notificationPreferences} onChange={(p) => setSettingsForm({...settingsForm, notificationPreferences: p})} role="vendor" />
                                  </div>
                              </div>
                              <div className="pt-6 flex justify-end">
                                  <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700">Save Changes</button>
                              </div>
                              {settingsSaved && <div className="bg-green-50 text-green-700 p-3 rounded text-center mt-4">✅ Settings saved successfully.</div>}
                          </form>
                      </div>
                  </div>
              )}
            </div>
          </main>
          {!!slotToManage && <BookingModal slotInfo={slotToManage} bookingToEdit={null} allBookings={allBookings} blockedSlotsForEdit={[]} vendor={currentUser} onClose={closeModal} onConfirmBooking={handleConfirmBooking} onUpdateBooking={handleUpdateBooking} onEditFromModal={handleEditFromModal} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} role="vendor" regions={regions} />}
          {!!bookingToEdit && <BookingModal slotInfo={null} bookingToEdit={bookingToEdit} allBookings={allBookings} blockedSlotsForEdit={blockedSlotsForEdit} vendor={currentUser} onClose={closeModal} onConfirmBooking={handleConfirmBooking} onUpdateBooking={handleUpdateBooking} onEditFromModal={handleEditFromModal} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} role="vendor" regions={regions} />}
          {isRequestModalOpen && (
              <BdmBookingRequestModal 
                currentUser={currentUser} 
                vendors={vendors} 
                onClose={() => setIsRequestModalOpen(false)} 
                onRequestBooking={handleRequestManualBooking} 
                regions={regions} 
                appointmentTimes={appointmentTimes}
                allBookings={allBookings}
              />
          )}
        </div>
    </div>
  );
};

export default Dashboard;
