
import React, { useState, useMemo, useEffect } from 'react';
import type { Booking, Region, LeaveDay, PublicHoliday, AppointmentSlotsConfig, Vendor, BDM, User, ManagerAppointment, Notification, Branding, Manager, NotificationPreferences } from '../types';
import { Header } from './Header';
import { Cog6ToothIcon, TrashIcon, XMarkIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PlusIcon, UserGroupIcon, ChartBarIcon, DocumentTextIcon, CalendarDaysIcon, ClockIcon, PencilSquareIcon, ArrowDownTrayIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, CheckBadgeIcon, CloudArrowUpIcon, DocumentArrowDownIcon, PhoneIcon, ChatBubbleLeftRightIcon, PresentationChartLineIcon } from './Icons';
import AnalyticsDashboard from './AnalyticsDashboard';
import RejectedBookingsList from './RejectedBookingsList';
import ArchivedBookingsList from './ArchivedBookingsList';
import VendorPerformanceAnalytics from './VendorPerformanceAnalytics';
import PerformanceLeadLog from './PerformanceLeadLog';
import { getStatusPill } from '../utils/statusUtils';
import ManagerCalendar from './ManagerCalendar';
import StatusAnalytics from './StatusAnalytics';
import DateRangePicker from './DateRangePicker';
import ManagerBookingReviewModal from './ManagerBookingReviewModal';
import BookingModal from './BookingModal';
import { exportBookingsToCSV } from '../utils/exportUtils';
import { generateImportTemplate, processImportFile } from '../utils/importUtils';
import ExpandableNote from './ExpandableNote';
import ManagerSmsActionModal from './ManagerSmsActionModal';
import { getRegionBackgroundColor } from '../utils/regionUtils';
import TimePicker from './TimePicker';
import TrendAnalytics, { TimePeriod } from './TrendAnalytics';
import NotificationSettings from './NotificationSettings';
import BdmBookingRequestModal from './BdmBookingRequestModal';
import { sendEmailNotification } from '../utils/emailService';
import { DEFAULT_NOTIFICATION_PREFERENCES, MANAGERS, VENDORS, BDMS, PUBLIC_HOLIDAYS, APPOINTMENT_TIMES, DEFAULT_BRANDING, DEFAULT_REGION_COLORS } from '../constants';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ManagerDashboardProps {
    currentUser: Extract<User, { role: 'manager' }>;
    onLogout: () => void;
    allBookings: Booking[];
    setAllBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
    salespeopleCount: Record<Region, number>;
    publicHolidays: PublicHoliday[];
    setPublicHolidays: React.Dispatch<React.SetStateAction<PublicHoliday[]>>;
    appointmentTimes: Record<Region, AppointmentSlotsConfig>;
    setAppointmentTimes: React.Dispatch<React.SetStateAction<Record<Region, AppointmentSlotsConfig>>>;
    leaveDays: LeaveDay[];
    setLeaveDays: React.Dispatch<React.SetStateAction<LeaveDay[]>>;
    vendors: Vendor[];
    setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
    bdms: BDM[];
    setBdms: React.Dispatch<React.SetStateAction<BDM[]>>;
    managers: Manager[];
    setManagers: React.Dispatch<React.SetStateAction<Manager[]>>;
    managerAppointments: ManagerAppointment[];
    setManagerAppointments: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    branding: Branding;
    setBranding: React.Dispatch<React.SetStateAction<Branding>>;
    onUpdateProfile: (user: User) => void;
    regions: Region[];
    setRegions: React.Dispatch<React.SetStateAction<Region[]>>;
    regionColors: Record<string, string>;
    setRegionColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
};

const triggerSystemAlert = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-indigo-600 text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] animate-bounceIn flex items-center gap-4 border-2 border-white/20';
    toast.innerHTML = `<div class="bg-white/20 p-2 rounded-lg">🔔</div><div><p class="font-bold text-xs uppercase tracking-widest opacity-70">System Alert</p><p class="text-sm font-medium">${message}</p></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-full'); setTimeout(() => document.body.removeChild(toast), 500); }, 5000);
};

interface UserEditModalProps {
    user: Vendor | BDM;
    type: 'vendor' | 'bdm';
    onClose: () => void;
    onSave: (updatedUser: Vendor | BDM) => void;
    regions: Region[];
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, type, onClose, onSave, regions }) => {
    const [formData, setFormData] = useState({
        name: user.name,
        username: user.username,
        password: user.password || '',
        region: (user as BDM).region || regions[0],
        allowedRegions: (user as Vendor).allowedRegions || regions, 
        active: user.active !== false
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const toggleAllowedRegion = (region: Region) => {
        setFormData(prev => {
            const current = prev.allowedRegions || [];
            if (current.includes(region)) {
                return { ...prev, allowedRegions: current.filter(r => r !== region) };
            }
            return { ...prev, allowedRegions: [...current, region] };
        });
    };

    const handleGeneratePassword = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newPass = generateSecurePassword();
        setFormData(prev => ({ ...prev, password: newPass }));
        setShowPassword(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedUser = {
            ...user,
            name: formData.name,
            username: formData.username,
            password: formData.password,
            active: formData.active,
            ...(type === 'bdm' ? { region: formData.region } : {}),
            ...(type === 'vendor' ? { allowedRegions: formData.allowedRegions } : {})
        };
        onSave(updatedUser);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-md">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-normal text-gray-900">Edit {type === 'vendor' ? 'Calling Team' : 'BDM'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-sm font-normal text-gray-700">Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" /></div>
                    {type === 'bdm' && (<div><label className="block text-sm font-normal text-gray-700">Region</label><select name="region" value={formData.region} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>)}
                    {type === 'vendor' && (
                        <div>
                            <label className="block text-sm font-normal text-gray-700 mb-2">Allowed Regions</label>
                            <div className="flex flex-wrap gap-2">
                                {regions.map(r => (
                                    <label key={r} className="inline-flex items-center bg-gray-50 px-2 py-1 rounded border">
                                        <input type="checkbox" checked={formData.allowedRegions.includes(r)} onChange={() => toggleAllowedRegion(r)} className="rounded text-indigo-600 mr-2" />
                                        <span className="text-sm">{r}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div><label className="block text-sm font-normal text-gray-700">Username</label><input type="text" name="username" value={formData.username} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" /></div>
                    <div>
                        <label className="block text-sm font-normal text-gray-700">Password</label>
                        <div className="flex gap-2 mt-1">
                            <div className="relative flex-grow">
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required className="block w-full border border-gray-300 rounded-md p-2 pr-10 shadow-sm" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600">{showPassword ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}</button>
                            </div>
                            <button type="button" onClick={handleGeneratePassword} className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 text-xs font-normal whitespace-nowrap">Gen</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" name="active" checked={formData.active} onChange={handleChange} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div><span className="ml-3 text-sm font-normal text-gray-900">{formData.active ? 'Active Account' : 'Inactive (Deactivated)'}</span></label></div>
                    <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button><button type="submit" className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-normal">Save Changes</button></div>
                </form>
            </div>
        </div>
    );
};

interface ImportPreviewModalProps {
    onCancel: () => void;
    onConfirm: () => void;
    stats: { imported: number, duplicates: number, skipped: number };
    newBookings: Booking[];
}

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ onCancel, onConfirm, stats, newBookings }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b bg-indigo-600 text-white rounded-t-lg"><h2 className="text-xl font-normal flex items-center gap-2"><CloudArrowUpIcon className="w-6 h-6" /> Import Preview</h2><button onClick={onCancel} className="text-indigo-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button></div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 p-4 rounded border border-green-200 text-center"><p className="text-2xl font-normal text-green-700">{stats.imported}</p><p className="text-xs text-green-600 uppercase font-normal">Records Found</p></div>
                        <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-center"><p className="text-2xl font-normal text-yellow-700">{stats.duplicates}</p><p className="text-xs text-green-600 uppercase font-normal">Duplicates</p></div>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center"><p className="text-2xl font-normal text-gray-700">{stats.skipped}</p><p className="text-xs text-gray-500 uppercase font-normal">Skipped (Bad Data)</p></div>
                    </div>
                    <h3 className="font-normal text-gray-800 mb-2">Preview (First 5 Rows)</h3>
                    <div className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">
                        <table className="min-w-full text-left">
                            <thead><tr className="border-b border-gray-300"><th className="p-2 text-gray-900 font-normal">Business</th><th className="p-2 text-gray-900 font-normal">Date</th><th className="p-2 text-gray-900 font-normal">Region</th><th className="p-2 text-gray-900 font-normal">Calling Team</th></tr></thead>
                            <tbody>{newBookings.slice(0, 5).map(b => (<tr key={b.id} className="border-b border-gray-200 last:border-0 odd:bg-white even:bg-gray-50"><td className="p-2 font-normal text-gray-900">{b.businessName || '-'}</td><td className="p-2 text-gray-800">{b.date} {b.time}</td><td className="p-2 text-gray-800">{b.region || '-'}</td><td className="p-2 text-gray-800">{b.vendor.name || '-'}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-normal">Cancel</button><button onClick={onConfirm} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-normal shadow-sm">Confirm Import</button></div>
            </div>
        </div>
    );
};

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
    currentUser, onLogout, allBookings, setAllBookings, salespeopleCount, publicHolidays, setPublicHolidays,
    appointmentTimes, setAppointmentTimes, leaveDays, setLeaveDays, vendors, setVendors, bdms, setBdms, managers, setManagers, managerAppointments, setManagerAppointments, notifications, setNotifications, branding, setBranding, onUpdateProfile, regions, setRegions, regionColors, setRegionColors
}) => {
    const [activeTab, setActiveTab] = useState<'bookings' | 'analytics' | 'users' | 'settings' | 'calendar'>('bookings');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
    const [analyticsTimePeriod, setAnalyticsTimePeriod] = useState<TimePeriod>('monthly');
    const [analyticsDateRange, setAnalyticsDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });
    const [bookingToManage, setBookingToManage] = useState<Booking | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [requestToReview, setRequestToReview] = useState<Booking | null>(null);
    const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
    const [smsActionBooking, setSmsActionBooking] = useState<Booking | null>(null);
    const [selectedBdmIds, setSelectedBdmIds] = useState<number[]>([]);
    const [leaveStartDate, setLeaveStartDate] = useState('');
    const [leaveEndDate, setLeaveEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveType, setLeaveType] = useState<'allDay' | 'specificSlots'>('allDay');
    const [leaveSlots, setLeaveSlots] = useState<string[]>([]);
    const [userMgmtTab, setUserMgmtTab] = useState<'vendors' | 'bdms' | 'leave'>('vendors');
    const [editingUser, setEditingUser] = useState<{ user: Vendor | BDM, type: 'vendor' | 'bdm' } | null>(null);
    const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
    const [importPreview, setImportPreview] = useState<{ newBookings: Booking[], stats: { imported: number, duplicates: number, skipped: number } } | null>(null);
    
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

    const togglePasswordVisibility = (id: number) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [newBdmName, setNewBdmName] = useState('');
    const [newBdmRegion, setNewBdmRegion] = useState<Region>(regions[0] || 'NSW');
    const [newBdmUsername, setNewBdmUsername] = useState('');
    const [newBdmPassword, setNewBdmPassword] = useState('');
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorUsername, setNewVendorUsername] = useState('');
    const [newVendorPassword, setNewVendorPassword] = useState('');
    const [newVendorRegions, setNewVendorRegions] = useState<Region[]>([]);
    const [slotConfigRegion, setSlotConfigRegion] = useState<Region>(regions[0] || 'NSW');
    const [newBaseSlot, setNewBaseSlot] = useState('10:00 AM');
    const [newDayOverrideDay, setNewDayOverrideDay] = useState('1'); 
    const [tempDaySlot, setTempDaySlot] = useState('10:00 AM');
    const [newDayOverrideSlots, setNewDayOverrideSlots] = useState<string[]>([]);
    const [newDateOverrideDate, setNewDateOverrideDate] = useState('');
    const [tempDateSlot, setTempDateSlot] = useState('10:00 AM');
    const [newDateOverrideSlots, setNewDateOverrideSlots] = useState<string[]>([]);
    const [newRegionName, setNewRegionName] = useState('');
    const [newHolidayName, setNewHolidayName] = useState('');
    const [newHolidayStartDate, setNewHolidayStartDate] = useState('');
    const [newHolidayEndDate, setNewHolidayEndDate] = useState('');
    const [newHolidayRegions, setNewHolidayRegions] = useState<Region[]>([]);
    const [editingHolidayOriginal, setEditingHolidayOriginal] = useState<PublicHoliday | null>(null);
    const [brandingForm, setBrandingForm] = useState(branding);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);

    const [profileForm, setProfileForm] = useState({
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email || '',
        password: currentUser.password || '',
        recoveryEmail: currentUser.recoveryEmail || '',
        notificationPreferences: currentUser.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
    });
    const [showProfilePassword, setShowProfilePassword] = useState(false);
    const [isEditingPassword, setIsEditingPassword] = useState(false);
    const [showProfileSuccess, setShowProfileSuccess] = useState(false);
    const [emailInput, setEmailInput] = useState('');

    useEffect(() => {
        if (newVendorRegions.length === 0 && regions.length > 0) setNewVendorRegions(regions);
    }, [regions]);

    const dashboardBackground = useMemo(() => {
        if (activeTab === 'users' && userMgmtTab === 'bdms') return getRegionBackgroundColor(newBdmRegion, regionColors);
        if (activeTab === 'settings') return getRegionBackgroundColor(slotConfigRegion, regionColors);
        return '#CFE59C'; 
    }, [activeTab, userMgmtTab, newBdmRegion, slotConfigRegion, regionColors]);

    const myNotifications = useMemo(() => notifications.filter(n => n.vendorId === 0), [notifications]);

    // MASTER FILTER: Every booking is visible and searched.
    const filteredBookings = useMemo(() => {
        const lowercasedFilter = searchTerm.trim().toLowerCase();
        
        return allBookings.filter(b => {
            if (b.isBlocker) return false;
            
            // Search matches
            const matchesSearch = !lowercasedFilter || (
                b.clientName.toLowerCase().includes(lowercasedFilter) || 
                b.businessName.toLowerCase().includes(lowercasedFilter) || 
                b.vendor.name.toLowerCase().includes(lowercasedFilter) || 
                b.address.toLowerCase().includes(lowercasedFilter) || 
                b.date.includes(lowercasedFilter) ||
                (bdms.find(bdm => bdm.id === b.bdmId)?.name.toLowerCase().includes(lowercasedFilter))
            );

            if (!matchesSearch) return false;

            // Date Range check
            const bookingDate = new Date(b.date);
            if (dateRange.startDate && bookingDate < new Date(dateRange.startDate)) return false;
            if (dateRange.endDate && bookingDate > new Date(dateRange.endDate)) return false;

            return true;
        });
    }, [allBookings, searchTerm, dateRange, bdms]);

    // RAW MASTER LEDGER: No filters applied so you can find anything.
    const masterLedgerRaw = useMemo(() => {
        return allBookings.filter(b => !b.isBlocker && (b.status === 'active' || b.status === 'pending_approval' || b.status === 'seen' || b.status === 'sold'))
            .sort((a, b) => new Date(a.date + 'T00:00:00Z').getTime() - new Date(b.date + 'T00:00:00Z').getTime());
    }, [allBookings]);

    const analyticsBookings = useMemo(() => {
        return allBookings.filter(b => { if (b.isBlocker) return false; const bookingDate = new Date(b.date); if (analyticsDateRange.startDate && bookingDate < new Date(analyticsDateRange.startDate)) return false; if (analyticsDateRange.endDate && bookingDate > new Date(analyticsDateRange.endDate)) return false; return true; });
    }, [allBookings, analyticsDateRange]);

    const activeBookings = useMemo(() => {
        // Active = Every pending or active lead, sorted chronologically.
        return filteredBookings.filter(b => (b.status === 'active' || b.status === 'pending_approval'))
            .sort((a, b) => new Date(a.date + 'T00:00:00Z').getTime() - new Date(b.date + 'T00:00:00Z').getTime());
    }, [filteredBookings]);

    const groupedActiveBookings = useMemo(() => {
        const groups: Record<string, Booking[]> = {};
        activeBookings.forEach(b => { if (!groups[b.date]) groups[b.date] = []; groups[b.date].push(b); });
        return groups;
    }, [activeBookings]);

    const sortedActiveDates = useMemo(() => Object.keys(groupedActiveBookings).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [groupedActiveBookings]);
    const pendingRequests = useMemo(() => filteredBookings.filter(b => b.status === 'pending_approval'), [filteredBookings]);
    
    // ARCHIVE: historical records already handled
    const archivedBookings = useMemo(() => {
        return filteredBookings.filter(b => ['seen', 'rescheduled', 'cancelled', 'dq', 'sold', 'rescheduled_bdm'].includes(b.status))
            .sort((a, b) => new Date(b.date + 'T00:00:00Z').getTime() - new Date(a.date + 'T00:00:00Z').getTime());
    }, [filteredBookings]);

    const rejectedBookings = useMemo(() => {
        return filteredBookings.filter(b => b.status === 'rejected');
    }, [filteredBookings]);

    const bdmsByRegion = useMemo(() => bdms.reduce((acc, bdm) => { if (bdm.active !== false) { if (!acc[bdm.region]) acc[bdm.region] = []; acc[bdm.region].push(bdm); } return acc; }, {} as Record<Region, BDM[]>), [bdms]);
    const sortedVendors = useMemo(() => [...vendors].sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [vendors]);
    const sortedBdms = useMemo(() => [...bdms].sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [bdms]);
    const blockedSlotsForEdit = useMemo(() => bookingToEdit ? allBookings.filter(b => b.parentBookingId === bookingToEdit.id).map(b => b.time) : [], [bookingToEdit, allBookings]);
    const allBookingsForCalendar = useMemo(() => allBookings.filter(b => !b.isBlocker), [allBookings]);

    const handleAssignBdm = (bookingId: number, bdmId: number) => { 
        setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bdmId } : b)); 
        const bdm = bdms.find(b => b.id === bdmId);
        const booking = allBookings.find(b => b.id === bookingId);
        
        // INSTANT NOTIFICATION TO BDM
        if (bdm) {
            setNotifications(prev => [...prev, { 
                id: Date.now(), 
                vendorId: bdm.id, 
                bookingId, 
                message: `New Lead Assigned: ${booking?.clientName} (${booking?.businessName})`, 
                read: false, 
                timestamp: new Date().toISOString() 
            }]);
            
            // REAL EMAIL NOTIFICATION
            if (bdm.notificationPreferences?.newAssignment) {
                sendEmailNotification(
                    bdm.email || '', 
                    `New Lead Assigned: ${booking?.businessName}`, 
                    booking || {}, 
                    `Hello ${bdm.name}, you have been assigned a new lead for ${booking?.businessName}. Please review the details in your dashboard.`
                );
            }

            triggerSystemAlert(`Lead assigned to ${bdm.name}. Notification sent.`);
        }
        setBookingToManage(null); 
    };
    
    // FIXED: Corrected handleDeleteBooking to remove the booking AND its blocker slots reliably.
    const handleDeleteBooking = (bookingId: number) => { 
        if (window.confirm('Are you sure you want to delete this booking? All associated blocked time slots will also be released.')) {
            setAllBookings(prev => prev.filter(b => b.id !== bookingId && b.parentBookingId !== bookingId)); 
            triggerSystemAlert("Booking permanently deleted.");
        }
    };

    const handleRejectBooking = () => {
        if (!bookingToManage || !rejectionReason.trim()) { alert('Please provide a reason.'); return; }
        const currentBookingId = bookingToManage.id;
        const reasonStr = rejectionReason.trim();
        setAllBookings(prev => prev.map(b => { 
            if (b.id === currentBookingId || b.parentBookingId === currentBookingId) {
                return { ...b, status: 'rejected', rejectionReason: reasonStr, rejectedBy: currentUser.name }; 
            }
            return b; 
        }));
        
        // NOTIFY CALLER OF REJECTION
        setNotifications(prev => [...prev, { 
            id: Date.now(), 
            vendorId: bookingToManage.vendor.id, 
            bookingId: currentBookingId, 
            message: `Your booking for ${bookingToManage.clientName} was rejected. Reason: ${reasonStr}`, 
            read: false, 
            timestamp: new Date().toISOString() 
        }]);

        // REAL EMAIL NOTIFICATION
        if (bookingToManage.vendor.notificationPreferences?.statusChange) {
            sendEmailNotification(
                bookingToManage.vendor.email || '',
                `Lead Rejected: ${bookingToManage.businessName}`,
                bookingToManage,
                `The lead for ${bookingToManage.businessName} was rejected. Reason: ${reasonStr}`
            );
        }

        setBookingToManage(null); 
        setRejectionReason('');
    };
    
    const handleUpdateBooking = (updatedDetails: any, slotsToRemove: string[]) => {
        if (!bookingToEdit) return;
        setAllBookings(prevBookings => {
            const otherBookings = prevBookings.filter(b => b.id !== bookingToEdit.id && b.parentBookingId !== bookingToEdit.id);
            const updatedBooking: Booking = { ...bookingToEdit, ...updatedDetails };
            const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ id: Date.now() + index + 1, clientName: `Slot Blocked`, businessName: `Conflict`, clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: updatedBooking.date, time: time, vendor: bookingToEdit.vendor, region: updatedBooking.region, isBlocker: true, parentBookingId: updatedBooking.id, status: 'active' }));
            return [...otherBookings, updatedBooking, ...newBlockers];
        });
        setBookingToEdit(null);
    };

    const handleApproveRequest = (bookingId: number, slotsToRemove: string[]) => {
        let approvedBooking: Booking | undefined;
        setAllBookings(prev => {
            const newBookings = [...prev];
            const requestIndex = newBookings.findIndex(b => b.id === bookingId);
            if (requestIndex === -1) return prev;
            const booking = newBookings[requestIndex];
            approvedBooking = { ...booking, status: 'active' };
            newBookings[requestIndex] = approvedBooking;
            slotsToRemove.forEach((time, index) => { newBookings.push({ id: Date.now() + index + 1, clientName: 'Manual Block', businessName: booking.clientName, clientWebsite: '', clientPhone: '', address: '', callerName: 'Manager', date: booking.date, time: time, vendor: booking.vendor, region: booking.region, isBlocker: true, parentBookingId: bookingId, status: 'active' }); });
            return newBookings;
        });

        // NOTIFY BDM OR CALLER OF APPROVAL
        if (approvedBooking) {
            const targetId = approvedBooking.bdmId || approvedBooking.vendor.id;
            setNotifications(prev => [...prev, { 
                id: Date.now(), 
                vendorId: targetId, 
                bookingId, 
                message: `Request Approved: ${approvedBooking?.clientName} on ${approvedBooking?.date}`, 
                read: false, 
                timestamp: new Date().toISOString() 
            }]);

            // REAL EMAIL NOTIFICATION
            const targetUser = approvedBooking.bdmId ? bdms.find(b => b.id === approvedBooking?.bdmId) : vendors.find(v => v.id === approvedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision) {
                 sendEmailNotification(
                    targetUser.email || '',
                    `Request Approved: ${approvedBooking.businessName}`,
                    approvedBooking,
                    `Your booking request for ${approvedBooking.businessName} has been approved and confirmed.`
                );
            }

            triggerSystemAlert(`Request approved and confirmed.`);
        }
        setRequestToReview(null);
    };
    
    const handleRejectRequest = (bookingId: number, reason: string) => {
         let targetId = 0;
         let rejectedBooking: Booking | undefined;
         setAllBookings(prev => prev.map(b => {
             if (b.id === bookingId) {
                 targetId = b.bdmId || b.vendor.id;
                 rejectedBooking = b;
                 return { ...b, status: 'rejected', rejectionReason: reason, rejectedBy: currentUser.name };
             }
             return b;
         }));

         // NOTIFY OF REJECTION
         setNotifications(prev => [...prev, { 
            id: Date.now(), 
            vendorId: targetId, 
            bookingId, 
            message: `Request Rejected for ${bookingId}. Reason: ${reason}`, 
            read: false, 
            timestamp: new Date().toISOString() 
         }]);

         // REAL EMAIL
         if (rejectedBooking) {
            const targetUser = rejectedBooking.bdmId ? bdms.find(b => b.id === rejectedBooking?.bdmId) : vendors.find(v => v.id === rejectedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision) {
                 sendEmailNotification(
                    targetUser.email || '',
                    `Request Rejected: ${rejectedBooking.businessName}`,
                    rejectedBooking,
                    `Your booking request for ${rejectedBooking.businessName} was rejected. Reason: ${reason}`
                );
            }
         }

         setRequestToReview(null);
    };

    const handleManualBookingEntry = (bookingDetails: Omit<Booking, 'id' | 'status'>) => {
        const mainBookingId = Date.now();
        const newBooking: Booking = { ...bookingDetails, id: mainBookingId, status: 'active' };

        // NOTIFY PIA VIA EMAIL (Direct route to system email as requested)
        sendEmailNotification(
            "pia@zealdigital.com.au",
            `New Lead Booked (Admin): ${bookingDetails.businessName}`,
            newBooking,
            `Hello, Admin ${currentUser.name} has manually entered a new lead for ${bookingDetails.clientName} at ${bookingDetails.businessName}.`
        );

        setAllBookings(prev => [...prev, newBooking]);
        setIsManualBookingOpen(false);
        triggerSystemAlert(`Lead booked directly. Notification sent.`);
    };

    const handleMarkSmsAsSent = (bookingId: number) => {
        let callerId = 0;
        let bBooking: Booking | undefined;
        setAllBookings(prev => prev.map(b => { 
            if (b.id === bookingId && b.smsRequest) {
                callerId = b.vendor.id;
                bBooking = b;
                return { ...b, smsRequest: { ...b.smsRequest, status: 'sent', sentAt: new Date().toISOString() } }; 
            }
            return b; 
        }));

        // NOTIFY CALLER SMS WAS SENT
        if (callerId && bBooking) {
            setNotifications(prev => [...prev, { 
                id: Date.now(), 
                vendorId: callerId, 
                bookingId, 
                message: `SMS Confirmation sent to client.`, 
                read: false, 
                timestamp: new Date().toISOString() 
            }]);

            if (bBooking.vendor.notificationPreferences?.smsSent) {
                sendEmailNotification(
                    bBooking.vendor.email || '',
                    `SMS Sent: ${bBooking.businessName}`,
                    bBooking,
                    `The requested SMS has been sent to the client for ${bBooking.businessName}.`
                );
            }
        }
        setSmsActionBooking(null);
    };

    const handleSaveUser = (updatedUser: Vendor | BDM) => {
        if (editingUser?.type === 'vendor') setVendors(prev => prev.map(v => v.id === updatedUser.id ? (updatedUser as Vendor) : v)); 
        else setBdms(prev => prev.map(b => b.id === updatedUser.id ? (updatedUser as BDM) : b));
        setEditingUser(null);
    };
    const handleAddVendor = () => {
        if (!newVendorName.trim() || !newVendorUsername.trim() || !newVendorPassword.trim()) { alert('Fill all fields'); return; }
        const newVendor: Vendor = { id: Date.now(), name: newVendorName.trim(), username: newVendorUsername.trim().toLowerCase(), password: newVendorPassword.trim(), active: true, email: '', notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES, allowedRegions: newVendorRegions };
        setVendors(prev => [...prev, newVendor]);
        setNewVendorName(''); setNewVendorUsername(''); setNewVendorPassword(''); setNewVendorRegions(regions);
    };
    const handleAddBdm = () => {
        if (!newBdmName.trim() || !newBdmUsername.trim() || !newBdmPassword.trim()) { alert('Fill all fields'); return; }
        const newBdm: BDM = { id: Date.now(), name: newBdmName.trim(), region: newBdmRegion, username: newBdmUsername.trim().toLowerCase(), password: newBdmPassword.trim(), active: true, email: '', notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES };
        setBdms(prev => [...prev, newBdm]);
        setNewBdmName(''); setNewBdmUsername(''); setNewBdmPassword('');
    };

    const handleBdmCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const bdmId = parseInt(e.target.value, 10);
        setSelectedBdmIds(prev => e.target.checked ? [...prev, bdmId] : prev.filter(id => id !== bdmId));
    };

    const handleAddLeave = () => {
        if (selectedBdmIds.length === 0 || !leaveStartDate) { alert('Invalid input'); return; }
        const effectiveEndDate = leaveEndDate || leaveStartDate;
        const newLeaveEntries: LeaveDay[] = []; let highestId = Math.max(0, ...leaveDays.map(l => l.id)); const start = new Date(leaveStartDate); const end = new Date(effectiveEndDate);
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
            const year = dt.getFullYear(); const month = String(dt.getMonth() + 1).padStart(2, '0'); const day = String(dt.getDate()).padStart(2, '0'); const dateString = `${year}-${month}-${day}`;
            selectedBdmIds.forEach((bdmId) => { const bdm = bdms.find(b => b.id === bdmId); if (bdm) { highestId++; newLeaveEntries.push({ id: highestId, date: dateString, region: bdm.region, reason: leaveReason.trim(), bdmId: bdm.id, bdmName: bdm.name, slots: leaveType === 'specificSlots' ? leaveSlots : undefined }); } });
        }
        setLeaveDays(prev => [...prev, ...newLeaveEntries].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSelectedBdmIds([]); setLeaveStartDate(''); setLeaveEndDate(''); setLeaveReason(''); setLeaveType('allDay'); setLeaveSlots([]);
    };
    const handleDeleteLeave = (id: number) => setLeaveDays(prev => prev.filter(l => l.id !== id));

    const compareTimes = (a: string, b: string) => { const parse = (timeStr: string) => { const [time, modifier] = timeStr.split(' '); let [hours, minutes] = time.split(':').map(Number); if (hours === 12 && modifier === 'AM') hours = 0; if (modifier === 'PM' && hours !== 12) hours += 12; return hours * 60 + minutes; }; return parse(a) - parse(b); };
    const handleAddBaseSlot = () => { if (!newBaseSlot) return; setAppointmentTimes(prev => { if (prev[slotConfigRegion]?.base.includes(newBaseSlot)) return prev; return { ...prev, [slotConfigRegion]: { ...prev[slotConfigRegion], base: [...(prev[slotConfigRegion]?.base || []), newBaseSlot].sort(compareTimes) } }; }); setNewBaseSlot('10:00 AM'); };
    const handleRemoveBaseSlot = (slot: string) => { setAppointmentTimes(prev => ({ ...prev, [slotConfigRegion]: { ...prev[slotConfigRegion], base: prev[slotConfigRegion].base.filter(s => s !== slot) } })); };
    const handleAddDaySlotToStaging = () => { if (!tempDaySlot) return; if (!newDayOverrideSlots.includes(tempDaySlot)) setNewDayOverrideSlots(prev => [...prev, tempDaySlot].sort(compareTimes)); setTempDaySlot('10:00 AM'); };
    const handleRemoveDaySlotFromStaging = (slotToRemove: string) => { setNewDayOverrideSlots(prev => prev.filter(s => s !== slotToRemove)); };
    const handleAddDayOverride = () => { if (newDayOverrideSlots.length === 0) return; setAppointmentTimes(prev => ({ ...prev, [slotConfigRegion]: { ...prev[slotConfigRegion], overrides: { ...prev[slotConfigRegion].overrides, dayOfWeek: { ...prev[slotConfigRegion].overrides.dayOfWeek, [parseInt(newDayOverrideDay)]: newDayOverrideSlots } } } })); setNewDayOverrideSlots([]); };
    const handleRemoveDayOverride = (dayToRemove: number, e?: React.MouseEvent) => { if (e) { e.preventDefault(); e.stopPropagation(); } setAppointmentTimes(prev => { const currentRegionConfig = prev[slotConfigRegion]; if (!currentRegionConfig) return prev; const newDayOverrides = Object.keys(currentRegionConfig.overrides.dayOfWeek).filter(key => parseInt(key) !== dayToRemove).reduce((obj, key) => { obj[parseInt(key)] = (currentRegionConfig.overrides.dayOfWeek as any)[key]; return obj; }, {} as any); return { ...prev, [slotConfigRegion]: { ...currentRegionConfig, overrides: { ...currentRegionConfig.overrides, dayOfWeek: newDayOverrides } } }; }); };
    const handleAddDateSlotToStaging = () => { if (!tempDateSlot) return; if (!newDateOverrideSlots.includes(tempDateSlot)) setNewDayOverrideSlots(prev => [...prev, tempDateSlot].sort(compareTimes)); setTempDaySlot('10:00 AM'); };
    const handleRemoveDateSlotFromStaging = (slotToRemove: string) => { setNewDayOverrideSlots(prev => prev.filter(s => s !== slotToRemove)); };
    const handleAddDateOverride = () => { if (!newDateOverrideDate || newDateOverrideSlots.length === 0) return; setAppointmentTimes(prev => ({ ...prev, [slotConfigRegion]: { ...prev[slotConfigRegion], overrides: { ...prev[slotConfigRegion].overrides, date: { ...prev[slotConfigRegion].overrides.date, [newDateOverrideDate]: newDateOverrideSlots } } } })); setNewDateOverrideDate(''); setNewDateOverrideSlots([]); };
    const handleRemoveDateOverride = (dateToRemove: string, e?: React.MouseEvent) => { if (e) { e.preventDefault(); e.stopPropagation(); } setAppointmentTimes(prev => { const currentRegionConfig = prev[slotConfigRegion]; if (!currentRegionConfig) return prev; const newDateOverrides = Object.keys(currentRegionConfig.overrides.date).filter(key => key !== dateToRemove).reduce((obj, key) => { obj[key] = (currentRegionConfig.overrides.date as any)[key]; return obj; }, {} as Record<string, string[]>); return { ...prev, [slotConfigRegion]: { ...currentRegionConfig, overrides: { ...currentRegionConfig.overrides, date: newDateOverrides } } }; }); };
    const handleAddRegion = () => { const name = newRegionName.trim().toUpperCase(); if (!name || regions.includes(name)) return; setRegions(prev => [...prev, name]); setAppointmentTimes(prev => ({ ...prev, [name]: { base: ['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'], overrides: { dayOfWeek: {}, date: {} } } })); setNewRegionName(''); };
    const handleDeleteRegion = (regionName: string) => { if (window.confirm('Delete region?')) setRegions(prev => prev.filter(r => r !== regionName)); };
    const handleRegionColorChange = (region: string, color: string) => setRegionColors(prev => ({ ...prev, [region]: color }));

    const handleSaveHoliday = () => {
        if (!newHolidayName.trim() || !newHolidayStartDate || newHolidayRegions.length === 0) { alert("Missing fields"); return; }
        const effectiveEnd = newHolidayEndDate || newHolidayStartDate;
        const newHoliday: PublicHoliday = { id: Date.now(), startDate: newHolidayStartDate, endDate: effectiveEnd, name: newHolidayName.trim(), regions: newHolidayRegions };
        setPublicHolidays(prev => { let updatedList = [...prev]; if (editingHolidayOriginal) updatedList = updatedList.filter(h => h.id !== editingHolidayOriginal.id); return [...updatedList, newHoliday].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()); });
        setNewHolidayName(''); setNewHolidayStartDate(''); setNewHolidayEndDate(''); setNewHolidayRegions([]); setEditingHolidayOriginal(null);
    };
    
    const toggleHolidayRegion = (region: Region) => {
        setNewHolidayRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
    };
    
    const handleEditHoliday = (holiday: PublicHoliday) => { setNewHolidayName(holiday.name); setNewHolidayStartDate(holiday.startDate); setNewHolidayEndDate(holiday.endDate); setNewHolidayRegions([...holiday.regions]); setEditingHolidayOriginal(holiday); };
    const handleDeleteHoliday = (id: number) => { if (window.confirm('Delete holiday?')) setPublicHolidays(prev => prev.filter(h => h.id !== id)); };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setLogoFile(e.target.files[0]); };
    const handleSaveBranding = () => { if (logoFile) { const reader = new FileReader(); reader.onloadend = () => { setBranding({ ...brandingForm, logoUrl: reader.result as string }); }; reader.readAsDataURL(logoFile); } else setBranding(brandingForm); };
    const handleDownloadTemplate = () => { const csv = generateImportTemplate(); const blob = new Blob([csv]); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'template.csv'; link.click(); };
    
    const handleImportUpload = async () => { 
        if (importFile) { 
            const { newBookings, stats } = await processImportFile(importFile, allBookings, vendors, currentUser); 
            setImportPreview({ newBookings, stats }); 
        } 
    };

    const handleUpdateMyProfile = (e: React.FormEvent) => { e.preventDefault(); onUpdateProfile({ ...currentUser, ...profileForm } as any); setShowProfileSuccess(true); setIsEditingPassword(false); setTimeout(() => setShowProfileSuccess(false), 3000); };

    return (
        <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: dashboardBackground.startsWith('bg-') ? undefined : dashboardBackground }}>
            <Header currentUser={currentUser} onLogout={onLogout} branding={branding} notifications={myNotifications} setNotifications={setNotifications} />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="border-b border-gray-300">
                        <nav className="-mb-px flex space-x-8">
                            {[{ id: 'bookings', label: 'Bookings', icon: DocumentTextIcon }, { id: 'analytics', label: 'Analytics & Reports', icon: PresentationChartLineIcon }, { id: 'users', label: 'User Management', icon: UserGroupIcon }, { id: 'calendar', label: 'My Calendar', icon: CalendarDaysIcon }, { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }].map(item => (
                                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-normal text-sm flex items-center gap-2 ${activeTab === item.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><item.icon className="w-5 h-5" /> {item.label}</button>
                            ))}
                        </nav>
                    </div>
                    <div className="mt-6">
                        {activeTab === 'bookings' && (
                            <>
                                <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mt-8">
                                    <div className="flex-grow max-w-2xl"><DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} /></div>
                                    <div className="flex gap-2 w-full sm:w-auto"><button onClick={() => setIsManualBookingOpen(true)} className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 shadow-md transition-all font-normal uppercase text-xs tracking-widest flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Book Lead</button><button onClick={() => exportBookingsToCSV(filteredBookings, 'bookings')} className="px-4 py-2 bg-white border rounded-md text-sm font-normal hover:bg-gray-50">Export</button></div>
                                </div>
                                <div className="mt-4 relative"><input type="text" className="block w-full rounded-md border-0 py-2.5 pl-3 text-gray-900 ring-1 ring-inset ring-gray-300" placeholder="Search leads (Date, Business, Client, Caller)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                
                                {pendingRequests.length > 0 && (
                                    <div className="mt-8 mb-8"><h2 className="text-xl font-normal text-indigo-800">Pending Approval Requests ({pendingRequests.length})</h2><div className="mt-4 bg-white rounded-xl shadow-md overflow-hidden"><table className="min-w-full divide-y divide-indigo-100"><thead className="bg-indigo-50"><tr><th className="px-6 py-3 text-left text-xs font-normal text-indigo-800">Client</th><th className="px-6 py-3 text-left text-xs font-normal text-indigo-800">Time</th><th className="px-6 py-3 text-left text-xs font-normal text-indigo-800">Region</th><th className="px-6 py-3 text-left text-xs font-normal text-indigo-800">Actions</th></tr></thead><tbody className="bg-white divide-y divide-indigo-50">{pendingRequests.map(req => (<tr key={req.id}><td className="px-6 py-4 text-sm font-normal">{req.clientName}</td><td className="px-6 py-4 text-sm">{req.time} ({new Date(req.date).toLocaleDateString()})</td><td className="px-6 py-4 text-sm">{req.region}</td><td className="px-6 py-4"><button onClick={() => setRequestToReview(req)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-normal hover:bg-indigo-700 transition-colors">Review</button></td></tr>))}</tbody></table></div></div>
                                )}

                                <div className="mt-8"><h2 className="text-xl font-normal text-gray-800">Recent Appointments Schedule ({activeBookings.length})</h2><div className="mt-4 bg-white rounded-xl shadow-md overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Client & Business</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Calling Team</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Time</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Region</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Notes</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedActiveDates.map(date => (<React.Fragment key={date}><tr className="bg-gray-100"><td colSpan={7} className="px-6 py-2 text-sm font-normal text-gray-700">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>{groupedActiveBookings[date].map(b => (<tr key={b.id} className={b.isDuplicate ? 'bg-yellow-50 border-l-4 border-red-500' : ''}><td className="px-6 py-4">
                                            <div className="text-sm font-normal text-gray-900">{b.clientName}</div>
                                            <div className="text-xs font-bold text-gray-500">{b.businessName}</div>
                                            <div className="flex flex-col mt-1 text-xs gap-1">
                                                {b.clientWebsite && (
                                                    <a 
                                                        href={b.clientWebsite.startsWith('http') ? b.clientWebsite : `https://${b.clientWebsite}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        {b.clientWebsite}
                                                    </a>
                                                )}
                                                {b.clientPhone && (
                                                    <a href={`tel:${b.clientPhone}`} className="text-gray-600 hover:underline">
                                                        {b.clientPhone}
                                                    </a>
                                                )}
                                            </div>
                                        </td><td className="px-6 py-4 text-sm text-gray-500 font-normal">{b.vendor.name}</td><td className="px-6 py-4 text-sm font-normal text-gray-900">{b.time}</td><td className="px-6 py-4"><span className="px-2 inline-flex text-xs leading-5 font-normal rounded-full bg-gray-100 text-gray-800">{b.region}</span></td><td className="px-6 py-4 text-sm text-gray-500 max-w-xs"><ExpandableNote text={b.notes} /></td><td className="px-6 py-4">{getStatusPill(b.status)}</td><td className="px-6 py-4 text-right text-sm font-normal"><div className="flex items-center justify-end gap-2"><select className="text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 mr-2 max-w-[100px]" value={b.bdmId || ''} onChange={(e) => handleAssignBdm(b.id, Number(e.target.value))}><option value="">Assign BDM</option>{bdmsByRegion[b.region]?.map(bdm => (<option key={bdm.id} value={bdm.id}>{bdm.name}</option>))}</select><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookingToManage(b); }} className="text-red-600 hover:text-red-900 font-normal px-2 py-1 hover:bg-red-50 rounded">Reject</button><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookingToEdit(b); }} className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded transition-colors"><PencilSquareIcon className="w-4 h-4"/></button><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(b.id); }} className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"><TrashIcon className="w-4 h-4"/></button></div></td></tr>))} </React.Fragment>))}</tbody></table></div></div></div>

                                <div className="mt-12">
                                    <div className="flex items-center justify-between mb-4 px-1 border-b pb-2">
                                        <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                            <DocumentTextIcon className="w-5 h-5 text-indigo-600" /> Master Lead Ledger (All Database Records)
                                        </h2>
                                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">{masterLedgerRaw.length} Records In DB</span>
                                    </div>
                                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Business</th>
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Calling Team</th>
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {masterLedgerRaw.map(b => (
                                                        <tr key={b.id} className="hover:bg-gray-50 transition-all">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{b.date}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm font-bold text-gray-900">{b.businessName}</div>
                                                                <div className="text-[10px] text-gray-400">{b.clientName}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{b.vendor.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">{getStatusPill(b.status)}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <button onClick={() => setBookingToEdit(b)} className="text-gray-400 hover:text-black p-1"><PencilSquareIcon className="w-4 h-4"/></button>
                                                                <button onClick={() => handleDeleteBooking(b.id)} className="text-gray-400 hover:text-red-600 p-1 ml-2"><TrashIcon className="w-4 h-4"/></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {masterLedgerRaw.length === 0 && (
                                                        <tr><td colSpan={5} className="p-12 text-center text-gray-400 italic">No records found in database.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12">
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h2 className="text-sm font-normal text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <ClockIcon className="w-4 h-4" /> Outcome History (Handled Leads) ({archivedBookings.length})
                                        </h2>
                                    </div>
                                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                        <ArchivedBookingsList bookings={archivedBookings} role="manager" searchTerm={searchTerm} />
                                    </div>
                                </div>

                                {rejectedBookings.length > 0 && (
                                    <div className="mt-12 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fadeIn">
                                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                            <h3 className="text-xl font-normal text-[#0F172A] tracking-tight">Rejected Appointments Review ({rejectedBookings.length})</h3>
                                        </div>
                                        <RejectedBookingsList bookings={rejectedBookings} role="manager" searchTerm={searchTerm} />
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'analytics' && (
                          <div className="space-y-8 animate-fadeIn">
                            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                              <h3 className="text-lg font-normal text-gray-800 mb-4">Analytics Controls</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <DateRangePicker startDate={analyticsDateRange.startDate} endDate={analyticsDateRange.endDate} onDateChange={setAnalyticsDateRange} />
                                <div className="flex flex-col">
                                  <label className="block text-sm font-normal text-gray-700 mb-1">Trend Grouping</label>
                                  <div className="flex rounded-md shadow-sm">
                                    {['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setAnalyticsTimePeriod(p as any)} className={`flex-1 py-2 text-sm border capitalize ${analyticsTimePeriod === p ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{p}</button>)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <AnalyticsDashboard bookings={analyticsBookings} isManager={true} />
                            <TrendAnalytics bookings={analyticsBookings} period={analyticsTimePeriod} />
                            <VendorPerformanceAnalytics bookings={analyticsBookings} vendors={vendors} />
                            <PerformanceLeadLog bookings={analyticsBookings} title="Global Data Report Log" />
                          </div>
                        )}
                        {activeTab === 'users' && (
                            <>
                                <div className="mb-6 border-b"><nav className="flex space-x-6"><button onClick={() => setUserMgmtTab('vendors')} className={`pb-4 px-1 border-b-2 font-normal text-sm ${userMgmtTab === 'vendors' ? 'border-black' : 'border-transparent'}`}>Calling Team Management</button><button onClick={() => setUserMgmtTab('bdms')} className={`pb-4 px-1 border-b-2 font-normal text-sm ${userMgmtTab === 'bdms' ? 'border-black' : 'border-transparent'}`}>BDM Management</button><button onClick={() => setUserMgmtTab('leave')} className={`pb-4 px-1 border-b-2 font-normal text-sm ${userMgmtTab === 'leave' ? 'border-black' : 'border-transparent'}`}>Staff Leave</button></nav></div>
                                {userMgmtTab === 'vendors' && (
                                    <div className="space-y-8">
                                        <div className="bg-white p-6 rounded shadow border"><h4 className="font-normal mb-4">Add New Calling Team</h4><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="text-sm block mb-1">Name</label><input type="text" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="w-full border p-2 rounded"/></div><div><label className="text-sm block mb-1">Username</label><input type="text" value={newVendorUsername} onChange={e => setNewVendorUsername(e.target.value)} className="w-full border p-2 rounded"/></div></div><div className="mb-4"><div><label className="text-sm block mb-1">Password</label><div className="flex gap-2"><input type="text" value={newVendorPassword} onChange={e => setNewVendorPassword(e.target.value)} className="w-full border p-2 rounded"/><button onClick={() => setNewVendorPassword(generateSecurePassword())} className="bg-gray-100 border px-2 rounded hover:bg-gray-200 text-xs">Gen</button></div></div></div><div className="mb-4"><label className="text-sm block mb-2 font-normal text-gray-700">Allowed Regions</label><div className="flex flex-wrap gap-3">{regions.map(r => (<label key={r} className="inline-flex items-center bg-gray-50 px-3 py-1.5 rounded border border-gray-200 cursor-pointer hover:bg-gray-100"><input type="checkbox" checked={newVendorRegions.includes(r)} onChange={() => setNewVendorRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} className="rounded text-indigo-600 focus:ring-indigo-500 mr-2"/><span className="text-sm text-gray-700">{r}</span></label>))}</div></div><button onClick={handleAddVendor} className="w-full bg-indigo-600 text-white py-2 rounded font-normal hover:bg-indigo-700">Add Calling Team</button></div>
                                        <div className="bg-white rounded shadow overflow-hidden border">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Name</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Username</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Password</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Regions</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Status</th>
                                                        <th className="px-6 py-4 text-right text-xs font-normal text-gray-900 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-100">
                                                    {sortedVendors.map(v => (
                                                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-normal">{v.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{v.username}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono">{visiblePasswords[v.id] ? v.password : '••••'}</span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => togglePasswordVisibility(v.id)}
                                                                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                                                    >
                                                                        {visiblePasswords[v.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {v.allowedRegions?.map(r => (
                                                                        <span key={r} className="text-[10px] px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500 rounded font-normal uppercase tracking-tight">
                                                                            {r}
                                                                        </span>
                                                                    )) || <span className="text-[10px] text-gray-400">ALL</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-emerald-600 font-normal text-xs bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-3">
                                                                    <button 
                                                                        onClick={() => setEditingUser({user: v, type: 'vendor'})} 
                                                                        className="text-gray-400 hover:text-gray-600 p-1 border border-gray-200 rounded"
                                                                    >
                                                                        <PencilSquareIcon className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setVendors(prev => prev.map(x => x.id === v.id ? { ...x, active: !x.active } : x))} 
                                                                        className="text-red-400 hover:text-red-600 p-1 border border-red-50 rounded bg-red-50/50"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {userMgmtTab === 'bdms' && (
                                    <div className="space-y-8">
                                        <div className="bg-white p-6 rounded shadow border"><h4 className="font-normal mb-4">Add New BDM</h4><div className="grid grid-cols-4 gap-4 items-end"><div><label className="text-sm">Name</label><input type="text" value={newBdmName} onChange={e => setNewBdmName(e.target.value)} className="w-full border p-2 rounded"/></div><div><label className="text-sm">Region</label><select value={newBdmRegion} onChange={e => setNewBdmRegion(e.target.value as any)} className="w-full border p-2 rounded">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="text-sm">Username</label><input type="text" value={newBdmUsername} onChange={e => setNewBdmUsername(e.target.value)} className="w-full border p-2 rounded"/></div><div><label className="text-sm">Password</label><div className="flex gap-2"><input type="text" value={newBdmPassword} onChange={e => setNewBdmPassword(e.target.value)} className="w-full border p-2 rounded"/><button onClick={() => setNewBdmPassword(generateSecurePassword())} className="bg-gray-100 border px-2 rounded hover:bg-gray-200 text-xs">Gen</button></div></div><button onClick={handleAddBdm} className="w-full bg-indigo-600 text-white py-2 rounded font-normal">Add</button></div></div>
                                        <div className="bg-white rounded shadow overflow-hidden border">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Name</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Region</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Username</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Password</th>
                                                        <th className="px-6 py-4 text-left text-xs font-normal text-gray-900 uppercase">Status</th>
                                                        <th className="px-6 py-4 text-right text-xs font-normal text-gray-900 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {sortedBdms.map(b => (
                                                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-normal">{b.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-[10px] px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500 rounded font-normal uppercase tracking-tight">
                                                                    {b.region}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{b.username}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono">{visiblePasswords[b.id] ? b.password : '••••'}</span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => togglePasswordVisibility(b.id)}
                                                                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                                                    >
                                                                        {visiblePasswords[b.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-emerald-600 font-normal text-xs bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-3">
                                                                    <button 
                                                                        onClick={() => setEditingUser({user: b, type: 'bdm'})} 
                                                                        className="text-gray-400 hover:text-gray-600 p-1 border border-gray-200 rounded"
                                                                    >
                                                                        <PencilSquareIcon className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setBdms(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))} 
                                                                        className="text-red-400 hover:text-red-600 p-1 border border-red-50 rounded bg-red-50/50"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {userMgmtTab === 'leave' && (<div className="grid grid-cols-2 gap-8"><div className="bg-white p-6 rounded shadow"><h3 className="font-normal mb-4">Log Staff Leave</h3><div className="space-y-4"><div><label>Select Staff</label><div className="max-h-40 overflow-y-auto border p-2">{bdms.map(b => <label key={b.id} className="block"><input type="checkbox" checked={selectedBdmIds.includes(b.id)} onChange={handleBdmCheckboxChange} value={b.id}/> {b.name} ({b.region})</label>)}</div></div><div className="grid grid-cols-2 gap-4"><div><label>Start Date</label><input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} className="w-full border p-2"/></div><div><label>End Date</label><input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} min={leaveStartDate} className="w-full border p-2"/></div></div><div><label>Reason</label><input type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="w-full border p-2"/></div><button onClick={handleAddLeave} className="w-full bg-indigo-600 text-white py-2 font-normal">Add Leave</button></div></div><div className="bg-white p-6 rounded shadow"><h3 className="font-normal">Scheduled Leave</h3><ul>{leaveDays.map(l => <li key={l.id} className="border-b p-2 flex justify-between"><span>{l.bdmName} - {new Date(l.date).toLocaleDateString()}</span><button onClick={() => handleDeleteLeave(l.id)}><TrashIcon className="w-4 h-4 text-red-500"/></button></li>)}</ul></div></div>)}
                            </>
                        )}
                        {activeTab === 'calendar' && <ManagerCalendar appointments={managerAppointments} setAppointments={setManagerAppointments} bookings={allBookingsForCalendar} />}
                        {activeTab === 'settings' && (
                            <div className="space-y-8 pb-20">
                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6">My Profile</h3>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        <form onSubmit={handleUpdateMyProfile} className="space-y-4">
                                            <div><label className="block text-sm font-normal text-gray-700">Name</label><input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2.5 shadow-sm" /></div>
                                            <div><label className="block text-sm font-normal text-gray-700">Username</label><input type="text" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2.5 shadow-sm" /></div>
                                            <div>
                                                <label className="block text-sm font-normal text-gray-700">Password</label>
                                                <div className="flex gap-2 mt-1">
                                                    <div className="relative flex-grow">
                                                        <input 
                                                            type={showProfilePassword ? "text" : "password"} 
                                                            value={profileForm.password} 
                                                            onChange={e => setProfileForm({...profileForm, password: e.target.value})} 
                                                            className={`block w-full border border-gray-300 rounded-md p-2 pr-10 shadow-sm ${!isEditingPassword ? 'bg-gray-50' : ''}`} 
                                                            disabled={!isEditingPassword && profileForm.password !== ''}
                                                        />
                                                        <button type="button" onClick={() => setShowProfilePassword(!showProfilePassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600">{showProfilePassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>
                                                    </div>
                                                    {(!isEditingPassword && profileForm.password !== '') ? (
                                                        <button type="button" onClick={() => setIsEditingPassword(true)} className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 text-xs font-normal whitespace-nowrap flex items-center gap-1"><PencilSquareIcon className="w-3 h-3" /> Edit</button>
                                                    ) : (
                                                        <button type="button" onClick={() => setProfileForm({...profileForm, password: generateSecurePassword()})} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-xs font-normal">Gen</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div><label className="block text-sm font-normal text-gray-700">Recovery Email</label><input type="email" value={profileForm.recoveryEmail} onChange={e => setProfileForm({...profileForm, recoveryEmail: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" /></div>
                                            <div>
                                                <label className="block text-sm font-normal text-gray-700">Contact Emails (for Notifications)</label>
                                                <div className="flex gap-2 mt-1">
                                                    <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm" placeholder="Enter email address..." />
                                                    <button type="button" onClick={() => { if(emailInput && !profileForm.email.includes(emailInput)) { setProfileForm({...profileForm, email: profileForm.email ? `${profileForm.email},${emailInput}` : emailInput}); setEmailInput(''); } }} className="bg-black text-white px-4 py-2 rounded-md font-normal text-sm">Add</button>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {profileForm.email.split(',').filter(Boolean).map(email => (
                                                        <span key={email} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-normal border border-indigo-100">
                                                            {email}
                                                            <button type="button" onClick={() => setProfileForm({...profileForm, email: profileForm.email.split(',').filter(e => e !== email).join(',')})} className="text-indigo-400 hover:text-indigo-600"><XMarkIcon className="w-3 h-3" /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 italic">Add multiple email addresses to receive notifications at all of them simultaneously.</p>
                                            </div>
                                            <div className="pt-4 flex flex-col gap-3">
                                                <button type="submit" className="w-full bg-black text-white py-3 rounded-lg font-normal shadow-sm hover:bg-gray-800 transition-all uppercase text-xs tracking-widest">Update Profile</button>
                                                {showProfileSuccess && <p className="text-center text-xs font-normal text-green-600">✅ Profile updated successfully!</p>}
                                            </div>
                                        </form>
                                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-fit">
                                            <h4 className="font-normal text-gray-800 mb-4">Email Notifications</h4>
                                            <NotificationSettings preferences={profileForm.notificationPreferences} onChange={(p) => setProfileForm({...profileForm, notificationPreferences: p})} role="manager" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6 flex items-center gap-2"><ChartBarIcon className="w-6 h-6" /> Branding & Appearance</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div><label className="block text-sm font-normal text-gray-700 mb-2">Company Name</label><input type="text" value={brandingForm.companyName} onChange={e => setBrandingForm({...brandingForm, companyName: e.target.value})} className="w-full border p-2.5 rounded-md" /></div>
                                        <div><label className="block text-sm font-normal text-gray-700 mb-2">Primary Brand Color</label><div className="flex items-center gap-3"><input type="color" value={brandingForm.primaryColor} onChange={e => setBrandingForm({...brandingForm, primaryColor: e.target.value})} className="w-12 h-10 border p-1 rounded cursor-pointer" /><span className="text-sm font-mono text-gray-500 uppercase">{brandingForm.primaryColor}</span></div></div>
                                        <div><label className="block text-sm font-normal text-gray-700 mb-2">Logo Upload</label><input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-normal file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />{branding.logoUrl && <img src={branding.logoUrl} alt="Preview" className="h-12 mt-2 object-contain bg-black p-1 rounded" />}</div>
                                    </div>
                                    <div className="mt-8 pt-4 border-t flex justify-end"><button onClick={handleSaveBranding} className="px-8 py-2.5 bg-black text-white font-normal rounded-lg hover:bg-gray-800 uppercase tracking-widest text-xs">Save Branding</button></div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6">Region Management</h3>
                                    <div className="flex gap-2 mb-6"><input type="text" value={newRegionName} onChange={e => setNewRegionName(e.target.value)} placeholder="New Region Name (e.g. QLD)" className="border p-2 rounded-md w-64" /><button onClick={handleAddRegion} className="bg-black text-white px-4 py-2 rounded-md font-normal text-sm">Add Region</button></div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{regions.map(r => (<div key={r} className="p-4 border rounded-lg bg-gray-50 flex items-center justify-between"><span className="font-normal text-gray-800">{r}</span><div className="flex items-center gap-3"><input type="color" value={getRegionBackgroundColor(r, regionColors)} onChange={e => handleRegionColorChange(r, e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" title="Dashboard Color" /><button onClick={() => handleDeleteRegion(r)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-4 h-4" /></button></div></div>))}</div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6">Appointment Slot Configuration</h3>
                                    <div className="flex gap-4 mb-8 overflow-x-auto pb-2">{regions.map(r => (<button key={r} onClick={() => setSlotConfigRegion(r)} className={`px-4 py-2 rounded-full font-normal text-sm transition-all ${slotConfigRegion === r ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{r}</button>))}</div>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="border p-4 rounded-lg bg-gray-50/50"><h4 className="font-normal text-sm uppercase text-gray-500 mb-4 tracking-widest">Base Availability ({slotConfigRegion})</h4><div className="flex gap-2 mb-4"><TimePicker value={newBaseSlot} onChange={setNewBaseSlot}/><button onClick={handleAddBaseSlot} className="bg-green-600 text-white p-2 rounded-md"><PlusIcon className="w-5 h-5"/></button></div><div className="space-y-2 border p-2 rounded-md bg-white max-h-60 overflow-y-auto">{appointmentTimes[slotConfigRegion]?.base.map(slot => (<div key={slot} className="flex justify-between items-center p-2 border-b last:border-0 hover:bg-gray-50 transition-colors"><span className="text-sm font-normal">{slot}</span><button onClick={() => handleRemoveBaseSlot(slot)} className="text-red-500 hover:text-red-700"><XMarkIcon className="w-4 h-4"/></button></div>))}</div></div>
                                        <div className="border p-4 rounded-lg bg-gray-50/50"><h4 className="font-normal text-sm uppercase text-gray-500 mb-4 tracking-widest">Day Specific Overrides</h4><select value={newDayOverrideDay} onChange={e => setNewDayOverrideDay(e.target.value)} className="w-full border p-2 rounded-md mb-4">{[1,2,3,4,5,6,0].map(d => <option key={d} value={d}>{DAYS_OF_WEEK[d]}</option>)}</select><div className="flex gap-2 mb-4"><TimePicker value={tempDaySlot} onChange={setTempDaySlot}/><button onClick={handleAddDaySlotToStaging} className="bg-gray-200 p-2 rounded-md hover:bg-gray-300">+</button></div><div className="flex flex-wrap gap-2 mb-4">{newDayOverrideSlots.map(s => <span key={s} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs flex items-center gap-1">{s}<button onClick={() => handleRemoveDaySlotFromStaging(s)}><XMarkIcon className="w-3 h-3"/></button></span>)}</div><button onClick={handleAddDayOverride} className="w-full bg-gray-500 text-white py-2 rounded-md text-sm font-normal hover:bg-gray-600">Save Override</button><div className="mt-6 space-y-2">{Object.entries(appointmentTimes[slotConfigRegion]?.overrides.dayOfWeek || {}).map(([day, slots]) => (<div key={day} className="bg-white border p-2 rounded-md text-xs flex justify-between items-center group"><div><span className="font-normal text-indigo-600">{DAYS_OF_WEEK[parseInt(day)]}:</span> <span className="text-gray-600">{(slots as string[]).join(', ')}</span></div><button onClick={() => handleRemoveDayOverride(parseInt(day))} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button></div>))}</div></div>
                                        <div className="border p-4 rounded-lg bg-gray-50/50"><h4 className="font-normal text-sm uppercase text-gray-500 mb-4 tracking-widest">Specific Date Overrides</h4><input type="date" value={newDateOverrideDate} onChange={e => setNewDateOverrideDate(e.target.value)} className="w-full border p-2 rounded-md mb-4" /><div className="flex gap-2 mb-4"><TimePicker value={tempDateSlot} onChange={setTempDateSlot}/><button onClick={handleAddDateSlotToStaging} className="bg-gray-200 p-2 rounded-md hover:bg-gray-300">+</button></div><div className="flex flex-wrap gap-2 mb-4">{newDateOverrideSlots.map(s => <span key={s} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs flex items-center gap-1">{s}<button onClick={() => handleRemoveDateSlotFromStaging(s)}><XMarkIcon className="w-3 h-3"/></button></span>)}</div><button onClick={handleAddDateOverride} className="w-full bg-gray-500 text-white py-2 rounded-md text-sm font-normal hover:bg-gray-600">Save Override</button><div className="mt-6 space-y-2">{Object.entries(appointmentTimes[slotConfigRegion]?.overrides.date || {}).map(([date, slots]) => (<div key={date} className="bg-white border p-2 rounded-md text-xs flex justify-between items-center group"><div><span className="font-normal text-indigo-600">{date}:</span> <span className="text-gray-600">{(slots as string[]).join(', ')}</span></div><button onClick={() => handleRemoveDateOverride(date)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button></div>))}</div></div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6">Holiday & Event Management</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-4"><h4 className="font-normal text-gray-700">{editingHolidayOriginal ? 'Edit Holiday' : 'Add Holiday'}</h4><input type="text" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="Name" className="w-full border p-2 rounded-md" /><div className="grid grid-cols-2 gap-4"><input type="date" value={newHolidayStartDate} onChange={e => setNewHolidayStartDate(e.target.value)} className="w-full border p-2 rounded-md" /><input type="date" value={newHolidayEndDate} onChange={e => setNewHolidayEndDate(e.target.value)} min={newHolidayStartDate} className="w-full border p-2 rounded-md" /></div><div className="flex gap-4">{regions.map(r => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newHolidayRegions.includes(r)} onChange={() => toggleHolidayRegion(r)} className="rounded text-indigo-600" />{r}</label>)}</div><button onClick={handleSaveHoliday} className="w-full bg-black text-white py-2.5 rounded-md font-normal uppercase tracking-widest text-xs">{editingHolidayOriginal ? 'Update' : 'Add'}</button>{editingHolidayOriginal && <button onClick={() => setEditingHolidayOriginal(null)} className="w-full text-gray-500 text-sm py-1">Cancel Edit</button>}</div>
                                        <div className="space-y-4">{publicHolidays.map(h => (<div key={h.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50 transition-colors group"><div><p className="font-normal text-gray-900">{h.name}</p><p className="text-xs text-gray-500">{h.startDate} {h.endDate !== h.startDate ? `- ${h.endDate}` : ''} | <span className="text-indigo-600 italic">{h.regions.join(', ')}</span></p></div><div className="flex gap-2"><button onClick={() => handleEditHoliday(h)} className="text-gray-400 hover:text-indigo-600 p-1"><PencilSquareIcon className="w-4 h-4" /></button><button onClick={() => handleDeleteHoliday(h.id)} className="text-gray-400 hover:text-red-600 p-1"><TrashIcon className="w-4 h-4" /></button></div></div>))}</div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h3 className="text-xl font-normal mb-6">Data Management</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div><h4 className="font-normal mb-2">Bulk Import Legacy Data</h4><p className="text-xs text-gray-500 mb-4">1. Download Template. 2. Edit in Excel. 3. Upload.</p><div className="flex flex-wrap gap-4 items-center"><button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-normal"><DocumentArrowDownIcon className="w-4 h-4" /> Download Template</button><div className="flex items-center gap-3"><label className="cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-normal hover:bg-indigo-100 transition-all border border-indigo-200">Choose File<input type="file" accept=".csv" onChange={(e) => { if(e.target.files?.[0]) setImportFile(e.target.files[0]); }} className="hidden"/></label><span className="text-xs text-gray-400 max-w-[150px] truncate">{importFile ? importFile.name : 'No file chosen'}</span><button onClick={handleImportUpload} disabled={!importFile} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed"><CloudArrowUpIcon className="w-4 h-4" /> Upload & Preview</button></div></div></div>
                                        <div><h4 className="font-normal mb-2">Export Data</h4><p className="text-xs text-gray-500 mb-4">Download all system data matching the Import format for re-upload.</p><button onClick={() => exportBookingsToCSV(allBookings, 'full_database')} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md font-normal uppercase text-xs tracking-widest transition-all"><ArrowDownTrayIcon className="w-4 h-4" /> Export Full Database</button></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {bookingToManage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-fadeIn">
                        <div className="flex justify-between items-center p-4 border-b bg-red-600 text-white rounded-t-lg">
                            <h2 className="text-xl font-normal">Reject Appointment</h2>
                            <button onClick={() => setBookingToManage(null)} className="text-red-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 font-normal">Rejecting lead for <strong>{bookingToManage.clientName}</strong>.</p>
                            <div>
                                <label className="block text-sm font-normal text-gray-700 mb-1">Reason for Rejection</label>
                                <textarea 
                                    value={rejectionReason} 
                                    onChange={(e) => setRejectionReason(e.target.value)} 
                                    rows={4} 
                                    required
                                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-red-500 focus:border-red-500" 
                                    placeholder="e.g., Duplicate entry, incorrect region, or BDM unavailable."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setBookingToManage(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-normal text-sm">Cancel</button>
                                <button 
                                    onClick={handleRejectBooking} 
                                    disabled={!rejectionReason.trim()}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-normal text-sm disabled:opacity-50"
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {requestToReview && <ManagerBookingReviewModal booking={requestToReview} onClose={() => setRequestToReview(null)} onApprove={handleApproveRequest} onReject={handleRejectRequest} appointmentTimes={appointmentTimes} />}
            {bookingToEdit && <BookingModal slotInfo={null} bookingToEdit={bookingToEdit} allBookings={allBookings} blockedSlotsForEdit={blockedSlotsForEdit} vendor={bookingToEdit.vendor} onClose={() => setBookingToEdit(null)} onConfirmBooking={() => {}} onUpdateBooking={handleUpdateBooking} onEditFromModal={() => {}} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} />}
            {editingUser && <UserEditModal user={editingUser.user} type={editingUser.type} onClose={() => setEditingUser(null)} onSave={handleSaveUser} regions={regions} />}
            {isManualBookingOpen && (<BdmBookingRequestModal currentUser={currentUser} vendors={vendors} onClose={() => setIsManualBookingOpen(false)} onRequestBooking={handleManualBookingEntry} regions={regions} />)}
            {importPreview && (<ImportPreviewModal stats={importPreview.stats} newBookings={importPreview.newBookings} onCancel={() => { setImportPreview(null); setImportFile(null); }} onConfirm={() => { if (importPreview) { setAllBookings(prev => [...prev, ...importPreview.newBookings]); setImportPreview(null); setImportFile(null); alert(`Imported ${importPreview.stats.imported} records.`); } }} />)}
        </div>
    );
};

export default ManagerDashboard;
