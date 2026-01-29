
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
import { MagnifyingGlassIcon, ArrowDownTrayIcon, ChartBarIcon, DocumentTextIcon, PresentationChartLineIcon, XMarkIcon, Cog6ToothIcon, CalendarDaysIcon, PlusIcon, ExclamationTriangleIcon } from './Icons';
import DateRangePicker from './DateRangePicker';
import { exportBookingsToCSV } from '../utils/exportUtils';
import { getRegionBackgroundColor } from '../utils/regionUtils';
import TrendAnalytics, { TimePeriod } from './TrendAnalytics';
import NotificationSettings from './NotificationSettings';
import UnifiedCalendar from './UnifiedCalendar';
import BdmBookingRequestModal from './BdmBookingRequestModal';
import ArchivedBookingsList from './ArchivedBookingsList';
import { sendEmailNotification } from '../utils/emailService';

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
    branding, regions, regionColors, onUpdateProfile, personalAppointments, setPersonalAppointments 
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'calendar' | 'performance' | 'settings'>('bookings');
  const [slotToManage, setSlotToManage] = useState<SlotManagementInfo | null>(null);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  
  const allowedRegions = useMemo(() => {
      if (currentUser.allowedRegions && currentUser.allowedRegions.length > 0) {
          return regions.filter(r => currentUser.allowedRegions!.includes(r));
      }
      return regions;
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
      notificationPreferences: currentUser.notificationPreferences || { newBooking: true, statusChange: true, bookingRequest: true, requestDecision: true, smsRequest: true, smsSent: true, bdmStatusUpdate: false, newAssignment: false }
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateProfile({ ...currentUser, ...settingsForm } as any);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleOpenSlotManager = (date: Date, time: string, isCustom: boolean, region: Region) => setSlotToManage({ date, time, isCustom, region });
  const handleEditFromList = (booking: Booking) => setBookingToEdit(booking);
  const handleDeleteBooking = (bookingId: number) => { if (window.confirm('Delete booking?')) setAllBookings(prev => prev.filter(b => b.id !== bookingId && b.parentBookingId !== bookingId)); };
  const handleEditFromModal = (booking: Booking) => { setSlotToManage(null); setBookingToEdit(booking); };
  const closeModal = () => { setSlotToManage(null); setBookingToEdit(null); };

  const handleConfirmBooking = (bookingDetails: Omit<Booking, 'id' | 'vendor' | 'status'>, slotsToRemove: string[] = []) => {
    const mainBookingId = Date.now();
    const newBooking: Booking = { ...bookingDetails, id: mainBookingId, vendor: currentUser, status: 'active' };
    const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ id: mainBookingId + index + 1, clientName: `Slot Blocked`, businessName: `Conflict`, clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: bookingDetails.date, time: time, vendor: currentUser, region: bookingDetails.region, isBlocker: true, parentBookingId: mainBookingId, status: 'active' }));
    
    // NOTIFY MANAGERS VIA EMAIL
    managers.forEach(m => {
        if (m.notificationPreferences?.newBooking && m.email) {
            sendEmailNotification(
                m.email,
                `New Booking: ${bookingDetails.businessName}`,
                newBooking,
                `Hello Admin, a new booking has been confirmed by ${currentUser.name} for ${bookingDetails.clientName} at ${bookingDetails.businessName}.`
            );
        }
    });

    setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: mainBookingId, message: `New Booking: ${bookingDetails.clientName} by ${currentUser.name}`, read: false, timestamp: new Date().toISOString() }]);
    setAllBookings(prev => [...prev, newBooking, ...newBlockers]);
    closeModal();
    triggerSystemAlert("Booking confirmed. Admins notified.");
  };
  
  const handleUpdateBooking = (updatedDetails: any, slotsToRemove: string[]) => {
    if (!bookingToEdit) return;
    setAllBookings(prevBookings => {
        const otherBookings = prevBookings.filter(b => b.id !== bookingToEdit.id && b.parentBookingId !== bookingToEdit.id);
        const updatedBooking: Booking = { ...bookingToEdit, ...updatedDetails };
        const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ id: Date.now() + index + 1, clientName: `Slot Blocked`, businessName: `Conflict`, clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: updatedBooking.date, time: time, vendor: bookingToEdit.vendor, region: updatedBooking.region, isBlocker: true, parentBookingId: updatedBooking.id, status: 'active' }));
        return [...otherBookings, updatedBooking, ...newBlockers];
    });
    closeModal();
  };

  const handleRequestManualBooking = (bookingDetails: Omit<Booking, 'id' | 'status'>) => {
      const newBooking: Booking = { ...bookingDetails, id: Date.now(), status: 'pending_approval' };
      
      // NOTIFY MANAGERS VIA EMAIL
      managers.forEach(m => { 
        if (m.notificationPreferences?.bookingRequest && m.email) {
            sendEmailNotification(
                m.email,
                `ACTION REQUIRED: Manual Date Request`,
                newBooking,
                `Hello, ${currentUser.name} is requesting approval for a manual appointment date with ${bookingDetails.businessName}. Please review this in your dashboard.`
            );
        }
      });

      setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: newBooking.id, message: `Manual Request from ${currentUser.name}: ${bookingDetails.clientName}`, read: false, timestamp: new Date().toISOString() }]);
      setAllBookings(prev => [...prev, newBooking]);
      setIsRequestModalOpen(false); 
      triggerSystemAlert("Manual request sent to Admin.");
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
                `Hello, ${currentUser.name} has requested an SMS be sent to ${booking?.clientName} (${booking?.businessName}). Context: ${message}`
            );
        }
      });

      setNotifications(prev => [...prev, { id: Date.now(), vendorId: 0, bookingId: bookingId, message: `SMS Request from ${currentUser.name}: ${type}.`, read: false, timestamp: new Date().toISOString() }]);
      triggerSystemAlert("SMS request sent.");
  };

  const myBookings = useMemo(() => allBookings.filter(b => b.vendor.id === currentUser.id), [allBookings, currentUser.id]);
  const vendorVisibleBookings = useMemo(() => myBookings.map(booking => (booking.status === 'sold' ? { ...booking, status: 'seen' as const } : booking)), [myBookings]);
  
  // EXHAUSTIVE SEARCH FOR VENDORS
  const filteredVendorBookings = useMemo(() => {
    const lowercasedFilter = searchTerm.trim().toLowerCase();
    return vendorVisibleBookings.filter(booking => {
      if (booking.status === 'rejected') return false; 
      
      const bookingDate = new Date(booking.date);
      if (dateRange.startDate && bookingDate < new Date(dateRange.startDate)) return false;
      if (dateRange.endDate && bookingDate > new Date(dateRange.endDate)) return false;
      
      if (!lowercasedFilter) return true;
      
      return (
        booking.clientName.toLowerCase().includes(lowercasedFilter) || 
        booking.businessName.toLowerCase().includes(lowercasedFilter) || 
        booking.clientPhone.toLowerCase().includes(lowercasedFilter) ||
        booking.clientWebsite.toLowerCase().includes(lowercasedFilter) ||
        booking.address.toLowerCase().includes(lowercasedFilter) ||
        booking.callerName.toLowerCase().includes(lowercasedFilter) ||
        (booking.notes?.toLowerCase().includes(lowercasedFilter)) ||
        booking.date.includes(lowercasedFilter) ||
        booking.time.toLowerCase().includes(lowercasedFilter) ||
        booking.region.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [searchTerm, vendorVisibleBookings, dateRange]);

  const analyticsBookings = useMemo(() => {
    return allBookings.filter(b => {
      if (b.isBlocker) return false;
      if (allowedRegions.length > 0 && !allowedRegions.includes(b.region)) return false;
      const bDate = new Date(b.date);
      if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
      if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
      return true;
    });
  }, [allBookings, analyticsDateRange, allowedRegions]);

  const archivedBookings = useMemo(() => {
    const allArchived = vendorVisibleBookings.filter(b => ['seen', 'rescheduled', 'cancelled', 'dq', 'rescheduled_bdm'].includes(b.status));
    if (searchTerm.trim()) return allArchived;
    const today = new Date(); today.setHours(0,0,0,0); const cutoff = new Date(today); cutoff.setDate(today.getDate() - 14);
    return allArchived.filter(b => { const bDate = new Date(b.date); return bDate >= cutoff; });
  }, [vendorVisibleBookings, searchTerm]);

  const activeBookings = useMemo(() => filteredVendorBookings.filter(b => b.status === 'active'), [filteredVendorBookings]);
  
  const rejectedBookings = useMemo(() => {
      const list = myBookings.filter(b => b.status === 'rejected' && !b.isBlocker);
      const lowercasedFilter = searchTerm.trim().toLowerCase();
      if (!lowercasedFilter) return list;
      return list.filter(b => 
        b.clientName.toLowerCase().includes(lowercasedFilter) || 
        b.businessName.toLowerCase().includes(lowercasedFilter) ||
        b.clientPhone.toLowerCase().includes(lowercasedFilter) ||
        b.address.toLowerCase().includes(lowercasedFilter)
      );
  }, [myBookings, searchTerm]);

  const myNotifications = useMemo(() => notifications.filter(n => n.vendorId === currentUser.id), [notifications, currentUser.id]);
  const calendarBookingsForRegion = useMemo(() => allBookings.filter(b => b.region === currentRegion), [allBookings, currentRegion]);
  const blockedSlotsForEdit = useMemo(() => bookingToEdit ? allBookings.filter(b => b.parentBookingId === bookingToEdit.id).map(b => b.time) : [], [bookingToEdit, allBookings]);
  const bgColor = getRegionBackgroundColor(currentRegion, regionColors);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: bgColor }}>
        <div> 
          <Header currentUser={currentUser} onLogout={onLogout} notifications={myNotifications} setNotifications={setNotifications} branding={branding} />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              
              <div className="mb-6 border-b border-gray-300/50 overflow-x-auto">
                  <nav className="-mb-px flex space-x-8">
                      <button onClick={() => setActiveTab('bookings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'bookings' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          <DocumentTextIcon className="w-5 h-5" /> Booking Slots
                      </button>
                      <button onClick={() => setActiveTab('calendar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'calendar' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          <CalendarDaysIcon className="w-5 h-5" /> My Calendar
                      </button>
                      <button onClick={() => setActiveTab('performance')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'performance' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          <PresentationChartLineIcon className="w-5 h-5" /> My Performance
                      </button>
                      <button onClick={() => setActiveTab('settings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'settings' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          <Cog6ToothIcon className="w-5 h-5" /> Settings
                      </button>
                  </nav>
              </div>

              {activeTab === 'bookings' && (
                  <div className="animate-fadeIn">
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
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 shadow-md transition-all font-bold uppercase text-xs tracking-widest whitespace-nowrap"
                        >
                            <PlusIcon className="w-4 h-4" /> Request Manual Date
                        </button>
                    </div>
                    {allowedRegions.length > 0 && (
                        <CalendarView allBookingsForRegion={calendarBookingsForRegion} onSelectSlot={handleOpenSlotManager} region={currentRegion} salespeopleCount={salespeopleCount} publicHolidays={publicHolidays} appointmentTimes={appointmentTimes} leaveDays={leaveDays} />
                    )}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} />
                        <div className="flex gap-2">
                            <div className="relative flex-grow flex items-center">
                                <MagnifyingGlassIcon className="absolute left-3 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black" 
                                    placeholder="Search Phone, Address, Website, Business..." 
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
                        bookings={vendorVisibleBookings.filter(b => !b.isBlocker)} 
                        currentUser={currentUser} 
                        appointments={personalAppointments}
                        setAppointments={setPersonalAppointments}
                      />
                  </div>
              )}

              {activeTab === 'performance' && (
                  <div className="animate-fadeIn mt-6 space-y-8">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Team Analytics (Global)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <DateRangePicker startDate={analyticsDateRange.startDate} endDate={analyticsDateRange.endDate} onDateChange={setAnalyticsDateRange} />
                        <div className="flex flex-col">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Trend Grouping</label>
                          <div className="flex rounded-md shadow-sm">
                            {['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setAnalyticsTimePeriod(p as any)} className={`flex-1 py-2 text-sm border capitalize ${analyticsTimePeriod === p ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{p}</button>)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <TrendAnalytics bookings={analyticsBookings} period={analyticsTimePeriod} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <StatusAnalytics bookings={analyticsBookings} title="Team Booking Status Breakdown" />
                      <CallerPerformanceAnalytics bookings={analyticsBookings} />
                    </div>
                    <PerformanceLeadLog bookings={analyticsBookings} title="Global Performance Lead Log" />
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
          {!!slotToManage && <BookingModal slotInfo={slotToManage} bookingToEdit={null} allBookings={allBookings} blockedSlotsForEdit={[]} vendor={currentUser} onClose={closeModal} onConfirmBooking={handleConfirmBooking} onUpdateBooking={handleUpdateBooking} onEditFromModal={handleEditFromModal} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} />}
          {!!bookingToEdit && <BookingModal slotInfo={null} bookingToEdit={bookingToEdit} allBookings={allBookings} blockedSlotsForEdit={blockedSlotsForEdit} vendor={currentUser} onClose={closeModal} onConfirmBooking={handleConfirmBooking} onUpdateBooking={handleUpdateBooking} onEditFromModal={handleEditFromModal} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} />}
          {isRequestModalOpen && (
              <BdmBookingRequestModal 
                currentUser={currentUser} 
                vendors={vendors} 
                onClose={() => setIsRequestModalOpen(false)} 
                onRequestBooking={handleRequestManualBooking} 
                regions={regions} 
              />
          )}
        </div>
    </div>
  );
};

export default Dashboard;
