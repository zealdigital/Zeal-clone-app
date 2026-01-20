
import React, { useState, useMemo } from 'react';
import type { 
    Manager, Booking, Region, LeaveDay, PublicHoliday, 
    AppointmentSlotsConfig, Vendor, BDM, Branding, 
    Notification, ManagerAppointment, User 
} from '../types';
import { 
    ChartBarIcon, UserGroupIcon, DocumentTextIcon, 
    CheckBadgeIcon, XMarkIcon, Cog6ToothIcon, 
    CloudArrowUpIcon, ArrowDownTrayIcon, MagnifyingGlassIcon,
    CalendarDaysIcon, PlusIcon
} from './Icons';
import { Header } from './Header';
import AnalyticsDashboard from './AnalyticsDashboard';
import PerformanceLeadLog from './PerformanceLeadLog';
import ManagerCalendar from './ManagerCalendar';
import RejectedBookingsList from './RejectedBookingsList';
import ArchivedBookingsList from './ArchivedBookingsList';
import ManagerBookingReviewModal from './ManagerBookingReviewModal';
import { testEmailService, sendEmailNotification } from '../utils/emailService';
import { exportBookingsToCSV } from '../utils/exportUtils';

interface ManagerDashboardProps {
  currentUser: Manager;
  onLogout: () => void;
  allBookings: Booking[];
  setAllBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  salespeopleCount: Record<Region, number>;
  publicHolidays: PublicHoliday[];
  setPublicHolidays: (val: any) => void;
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  setAppointmentTimes: (val: any) => void;
  leaveDays: LeaveDay[];
  setLeaveDays: (val: any) => void;
  vendors: Vendor[];
  setVendors: (val: any) => void;
  bdms: BDM[];
  setBdms: (val: any) => void;
  managers: Manager[];
  setManagers: (val: any) => void;
  branding: Branding;
  setBranding: (val: any) => void;
  regions: Region[];
  setRegions: (val: any) => void;
  regionColors: Record<string, string>;
  setRegionColors: (val: any) => void;
  onUpdateProfile: (user: User) => void;
  managerAppointments: ManagerAppointment[];
  setManagerAppointments: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = (props) => {
  const { 
    currentUser, onLogout, allBookings, setAllBookings, 
    notifications, setNotifications, branding, vendors,
    managerAppointments, setManagerAppointments, appointmentTimes
  } = props;

  const [activeTab, setActiveTab] = useState<'analytics' | 'leads' | 'calendar' | 'system'>('leads');
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  // Filter for manual requests that need manager approval
  const pendingRequests = useMemo(() => 
    allBookings.filter(b => b.status === 'pending_approval'), 
    [allBookings]
  );

  const handleApprove = (bookingId: number, slotsToRemove: string[]) => {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const mainId = booking.id;
    const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({
        id: Date.now() + index + 500,
        clientName: `Slot Blocked`,
        businessName: `Conflict`,
        clientWebsite: '',
        clientPhone: '',
        address: '',
        callerName: 'System',
        date: booking.date,
        time: time,
        vendor: booking.vendor,
        region: booking.region,
        isBlocker: true,
        parentBookingId: mainId,
        status: 'active'
    }));

    setAllBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: 'active' as const } : b
    ).concat(newBlockers));

    // Notify User
    if (booking.vendor.notificationPreferences?.requestDecision) {
        sendEmailNotification(
            booking.vendor.email || '',
            "Booking Approved",
            booking,
            `Hi ${booking.vendor.name}, your manual booking request for ${booking.businessName} has been approved.`
        );
    }

    setReviewBooking(null);
  };

  const handleReject = (bookingId: number, reason: string) => {
    const booking = allBookings.find(b => b.id === bookingId);
    setAllBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: 'rejected' as const, rejectionReason: reason, rejectedBy: currentUser.name } : b
    ));

    if (booking?.vendor.notificationPreferences?.requestDecision) {
        sendEmailNotification(
            booking.vendor.email || '',
            "Booking Request Rejected",
            booking,
            `Hi ${booking.vendor.name}, unfortunately your booking request for ${booking.businessName} was declined. Reason: ${reason}`
        );
    }

    setReviewBooking(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        currentUser={currentUser} 
        onLogout={onLogout} 
        notifications={notifications} 
        setNotifications={setNotifications} 
        branding={branding} 
      />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Pending Approvals Bar */}
        {pendingRequests.length > 0 && (
            <div className="mb-6 bg-indigo-600 rounded-xl p-4 text-white flex items-center justify-between shadow-lg animate-pulse">
                <div className="flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6" />
                    <p className="font-bold">You have {pendingRequests.length} pending booking requests needing review.</p>
                </div>
                <button 
                    onClick={() => setActiveTab('leads')}
                    className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg font-bold text-xs uppercase"
                >
                    View Requests
                </button>
            </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-8 max-w-2xl">
            {(['leads', 'calendar', 'analytics', 'system'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                        activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>

        <div className="space-y-8 animate-fadeIn">
            {activeTab === 'leads' && (
                <>
                    {pendingRequests.length > 0 && (
                        <div className="bg-white rounded-xl shadow-md border border-indigo-100 overflow-hidden">
                            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
                                <ClockIcon className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-black text-indigo-900 uppercase tracking-tight">Review Pending Requests</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="font-black text-gray-900">{req.businessName}</p>
                                            <p className="text-xs text-gray-500">{req.clientName} • Requested by {req.vendor.name}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-indigo-600">{req.date}</p>
                                                <p className="text-xs text-gray-400">{req.time}</p>
                                            </div>
                                            <button 
                                                onClick={() => setReviewBooking(req)}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-700"
                                            >
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <PerformanceLeadLog bookings={allBookings.filter(b => !b.isBlocker)} title="Global Lead Database" />
                </>
            )}

            {activeTab === 'calendar' && (
                <ManagerCalendar 
                    appointments={managerAppointments} 
                    setAppointments={setManagerAppointments} 
                    bookings={allBookings.filter(b => !b.isBlocker && b.status === 'active')}
                />
            )}

            {activeTab === 'analytics' && (
                <AnalyticsDashboard bookings={allBookings.filter(b => !b.isBlocker)} isManager />
            )}

            {activeTab === 'system' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
                        <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight">Email System Status</h3>
                        <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                <p className="text-sm font-bold text-gray-700">EmailJS Pipeline Active</p>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Automated notifications are currently routing through template <code className="bg-gray-200 px-1 rounded">template_erdqf7d</code>. 
                                Click below to trigger a live test to your primary admin email.
                            </p>
                            <button 
                                onClick={(e) => { e.preventDefault(); testEmailService(); }}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-100"
                            >
                                <CloudArrowUpIcon className="w-4 h-4" /> Run Connection Test
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
                        <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight">Database Tools</h3>
                        <div className="space-y-4">
                            <button 
                                onClick={() => exportBookingsToCSV(allBookings, 'master_backup')}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-100"
                            >
                                <ArrowDownTrayIcon className="w-4 h-4" /> Export Master Database
                            </button>
                            <p className="text-[10px] text-gray-400 font-bold uppercase text-center tracking-widest">
                                {allBookings.length} total records in cloud
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>

      {reviewBooking && (
          <ManagerBookingReviewModal 
            booking={reviewBooking}
            onClose={() => setReviewBooking(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            appointmentTimes={appointmentTimes}
          />
      )}
    </div>
  );
};

// Internal Icons needed for the pulse alerts
const ExclamationTriangleIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const ClockIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

export default ManagerDashboard;
