
import React, { useMemo, useState, useEffect } from 'react';
import type { BDM, Booking, User, Notification, Vendor, Region, AppointmentSlotsConfig, Branding, Manager, NotificationPreferences, ManagerAppointment } from '../types';
import { Header } from './Header';
import BdmUpdateStatusModal from './BdmUpdateStatusModal';
import { getStatusPill } from '../utils/statusUtils';
import BdmAnalyticsDashboard from './BdmAnalyticsDashboard';
import PerformanceLeadLog from './PerformanceLeadLog';
import { BellIcon, DocumentTextIcon, MagnifyingGlassIcon, PlusIcon, ArrowPathIcon, PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, PhoneIcon, ClockIcon, CalendarDaysIcon, XMarkIcon, ExclamationTriangleIcon, Cog6ToothIcon, PresentationChartLineIcon } from './Icons';
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
import { sendEmailNotification } from '../utils/emailService';

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
}

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
    onUpdateProfile, personalAppointments, setPersonalAppointments 
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
  
  const [settingsForm, setSettingsForm] = useState({
      email: currentUser.email || '',
      notificationPreferences: currentUser.notificationPreferences || { newBooking: true, statusChange: true, bookingRequest: true, requestDecision: true, smsRequest: true, smsSent: true, bdmStatusUpdate: true, newAssignment: true }
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
      setSettingsForm({
          email: currentUser.email || '',
          notificationPreferences: currentUser.notificationPreferences || { newBooking: true, statusChange: true, bookingRequest: true, requestDecision: true, smsRequest: true, smsSent: true, bdmStatusUpdate: true, newAssignment: true }
      });
  }, [currentUser]);

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateProfile({ ...currentUser, ...settingsForm } as any);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
  };

  const myUniqueBookings = useMemo(() => {
    const relevantBookings = allBookings.filter(b => b.bdmId === currentUser.id && !b.isBlocker);
    const grouped = relevantBookings.reduce((acc, booking) => {
        const key = booking.businessName.trim().toLowerCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(booking);
        return acc;
    }, {} as Record<string, Booking[]>);
    const uniqueList: Booking[] = [];
    (Object.values(grouped) as Booking[][]).forEach(group => {
        if (group.length === 1) uniqueList.push(group[0]);
        else { const sorted = group.sort((a, b) => b.id - a.id); uniqueList.push(sorted[0]); }
    });
    return uniqueList;
  }, [allBookings, currentUser.id]);

  const myAssignedBookings = useMemo(() => myUniqueBookings.filter(b => b.status !== 'rejected' && b.status !== 'pending_approval'), [myUniqueBookings]);
  
  // EXHAUSTIVE SEARCH FOR BDM
  const filteredBookings = useMemo(() => {
    const lowercasedFilter = searchTerm.trim().toLowerCase();
    return myAssignedBookings.filter(booking => {
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
        booking.vendor.name.toLowerCase().includes(lowercasedFilter) || 
        (booking.notes?.toLowerCase().includes(lowercasedFilter)) ||
        (booking.bdmNote?.toLowerCase().includes(lowercasedFilter)) ||
        booking.date.includes(lowercasedFilter) ||
        booking.time.toLowerCase().includes(lowercasedFilter) ||
        booking.region.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [searchTerm, myAssignedBookings, dateRange]);

  const analyticsBookings = useMemo(() => {
    return myUniqueBookings.filter(b => {
      const bDate = new Date(b.date);
      if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
      if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
      return true;
    });
  }, [myUniqueBookings, analyticsDateRange]);

  // Updated sort to descending: newest leads first.
  const groupedBookings = useMemo(() => {
    const sorted = [...filteredBookings].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id - a.id;
    });
    const groups: Record<string, Booking[]> = {};
    sorted.forEach(b => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    return groups;
  }, [filteredBookings]);

  // Updated sort to descending for the group date headers
  const sortedDateKeys = useMemo(() => Object.keys(groupedBookings).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedBookings]);

  const handleUpdateBookingStatus = (bookingId: number, newStatus: Booking['status'], note: string) => {
    let updatedBooking: Booking | undefined;
    setAllBookings(prev => { const newBookings = prev.map(b => { if (b.id === bookingId) { updatedBooking = { ...b, status: newStatus, bdmNote: note }; return updatedBooking; } return b; }); return newBookings; });
    
    if (updatedBooking) {
        if (updatedBooking.vendor.notificationPreferences?.statusChange) {
            sendEmailNotification(
                updatedBooking.vendor.email || '',
                `Lead Status Update: ${updatedBooking.businessName}`,
                updatedBooking,
                `Hello, BDM ${currentUser.name} has updated the status of ${updatedBooking.businessName} to ${newStatus}. Note: ${note}`
            );
        }
        managers.forEach(m => {
            if (m.notificationPreferences?.bdmStatusUpdate) {
                sendEmailNotification(
                    m.email || '',
                    `BDM Update: ${updatedBooking?.businessName}`,
                    updatedBooking || {},
                    `BDM ${currentUser.name} marked ${updatedBooking?.businessName} as ${newStatus}.`
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

  const handleOpenRequestModal = (prefill: Booking | null = null) => { 
    setRequestModalPrefill(prefill); 
    setIsRequestModalOpen(true); 
  };
  
  const handleRequestBooking = (bookingDetails: Omit<Booking, 'id' | 'status'>) => {
      const newBooking: Booking = { ...bookingDetails, id: Date.now(), status: 'pending_approval' };
      managers.forEach(m => { 
        if (m.notificationPreferences?.bookingRequest) {
            sendEmailNotification(
                m.email || '',
                `BDM Request: Approval Required`,
                newBooking,
                `BDM ${currentUser.name} is requesting approval for a booking with ${bookingDetails.businessName}. Please review it in your dashboard.`
            );
        }
      });
      const managerNotif: Notification = { id: Date.now(), vendorId: 0, bookingId: newBooking.id, message: `New Request from BDM ${currentUser.name}: ${bookingDetails.clientName}`, read: false, timestamp: new Date().toISOString() };
      setNotifications(prev => [...prev, managerNotif]);
      setAllBookings(prev => [...prev, newBooking]);
      setIsRequestModalOpen(false); 
      triggerSystemAlert("Booking request sent to Managers.");
  };
  
  const bgColor = getRegionBackgroundColor(currentUser.region, regionColors);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: bgColor }}>
      <div>
        <Header currentUser={currentUser} onLogout={onLogout} branding={branding} notifications={notifications.filter(n => n.vendorId === currentUser.id)} setNotifications={setNotifications} />
        <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
            
            <div className="mb-6 border-b border-gray-300/50 overflow-x-auto">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <DocumentTextIcon className="w-5 h-5" /> Appointments List
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

            {activeTab === 'dashboard' && (
                <div className="animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4"><h1 className="text-3xl font-black text-gray-900">Your Appointments</h1><button onClick={() => handleOpenRequestModal(null)} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 shadow-md transition-all font-bold uppercase text-xs tracking-widest"><PlusIcon className="w-4 h-4" /> Request Booking</button></div>
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} />
                        <div className="flex gap-2">
                            <div className="relative flex-grow flex items-center">
                                <MagnifyingGlassIcon className="absolute left-3 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black" 
                                    placeholder="Search Phone, Address, Website, Team..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <button onClick={() => exportBookingsToCSV(filteredBookings, 'bdm_bookings')} className="px-4 py-2 bg-white border rounded-md font-bold text-sm">Export</button>
                        </div>
                    </div>
                    
                    {searchTerm.trim() !== '' ? (
                        <div className="mt-8 mb-8 animate-fadeIn">
                            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-indigo-100">
                                <PerformanceLeadLog bookings={filteredBookings} title="Matched Appointments" hideFilters={true} />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Client & Business</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Calling Team</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Notes</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedDateKeys.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No appointments found.</td></tr>
                                        ) : (
                                            sortedDateKeys.map(dateKey => (
                                                <React.Fragment key={dateKey}>
                                                    <tr className="bg-gray-50 border-y border-gray-200"><td colSpan={6} className="px-6 py-3 text-sm font-bold text-gray-700 uppercase tracking-tight">{new Date(dateKey + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
                                                    {groupedBookings[dateKey].map(booking => (
                                                        <tr key={booking.id} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-6 py-5 align-top">
                                                                <div className="text-base font-bold text-gray-900 mb-1">{booking.clientName}</div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    {booking.clientWebsite && (<a href={booking.clientWebsite.startsWith('http') ? booking.clientWebsite : `https://${booking.clientWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline font-medium break-all">{booking.clientWebsite}</a>)}
                                                                    {booking.clientPhone && (<a href={`tel:${booking.clientPhone}`} className="text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium">{booking.clientPhone}</a>)}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 align-top whitespace-nowrap text-sm text-gray-600 font-medium pt-7">{booking.vendor.name}</td>
                                                            <td className="px-6 py-5 align-top whitespace-nowrap pt-7"><div className="text-sm font-black text-gray-900">{booking.time}</div></td>
                                                            <td className="px-6 py-5 align-top pt-6">{getStatusPill(booking.status)}</td>
                                                            <td className="px-6 py-5 align-top text-sm text-gray-500 max-w-xs pt-7"><ExpandableNote text={booking.bdmNote || booking.notes} /></td>
                                                            <td className="px-6 py-5 align-top whitespace-nowrap text-sm font-medium pt-6">
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setBookingToUpdate(booking)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md border border-gray-200" title="Update Lead Result / Status">
                                                                        <PencilSquareIcon className="w-4 h-4" />
                                                                    </button>
                                                                    {booking.status === 'rescheduled_bdm' && (
                                                                        <button onClick={() => handleOpenRequestModal(booking)} className="p-1.5 text-orange-600 hover:bg-orange-50 border border-orange-200 rounded-md" title="Rebook this Lead (Prefilled)">
                                                                            <ArrowPathIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => setBookingToManageNotes(booking)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md border border-gray-200" title="Private Notes & Reminders">
                                                                        <BellIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'calendar' && <div className="animate-fadeIn"><UnifiedCalendar bookings={myAssignedBookings} currentUser={currentUser} appointments={personalAppointments} setAppointments={setPersonalAppointments} /></div>}
            {activeTab === 'performance' && (
              <div className="animate-fadeIn mt-6 space-y-8">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Analytics Controls</h3>
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
                <BdmAnalyticsDashboard bookings={analyticsBookings} />
                <TrendAnalytics bookings={analyticsBookings} period={analyticsTimePeriod} />
                <StatusAnalytics bookings={analyticsBookings} title="Your Outcome Stats" />
                <PerformanceLeadLog bookings={analyticsBookings} title="Your Assignment Performance Log" />
              </div>
            )}
            {activeTab === 'settings' && (
                <div className="animate-fadeIn mt-6 max-w-2xl mx-auto">
                    <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-6">Settings</h2>
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div><label className="block text-sm font-bold text-gray-700 mb-2">Contact Email</label><input type="email" value={settingsForm.email} onChange={e => setSettingsForm({...settingsForm, email: e.target.value})} className="w-full border border-gray-300 p-3 rounded-md" /></div>
                            <NotificationSettings preferences={settingsForm.notificationPreferences} onChange={(p) => setSettingsForm({...settingsForm, notificationPreferences: p})} role="bdm" />
                            <div className="pt-6 flex justify-end"><button type="submit" className="px-8 py-3 bg-black text-white font-black rounded-lg uppercase tracking-widest text-xs">Save Changes</button></div>
                        </form>
                    </div>
                </div>
            )}

            </div>
        </main>
        {bookingToUpdate && <BdmUpdateStatusModal booking={bookingToUpdate} onClose={() => setBookingToUpdate(null)} onSave={handleUpdateBookingStatus} />}
        {bookingToManageNotes && <BdmNoteReminderModal booking={bookingToManageNotes} onClose={() => setBookingToManageNotes(null)} onSave={handleSaveNoteAndReminder} />}
        {/* FIX: Added missing 'appointmentTimes' prop required by BdmBookingRequestModal */}
        {isRequestModalOpen && <BdmBookingRequestModal currentUser={currentUser} vendors={vendors} onClose={() => setIsRequestModalOpen(false)} onRequestBooking={handleRequestBooking} prefillData={requestModalPrefill} regions={regions} appointmentTimes={appointmentTimes} />}
      </div>
    </div>
  );
};

export default BdmDashboard;
