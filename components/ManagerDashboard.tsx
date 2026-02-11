
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
import BdmOutcomePerformance from './BdmOutcomePerformance';
import { sendEmailNotification } from '../utils/emailService';
import { DEFAULT_NOTIFICATION_PREFERENCES, MANAGERS, VENDORS, BDMS, PUBLIC_HOLIDAYS, APPOINTMENT_TIMES, DEFAULT_BRANDING, DEFAULT_REGION_COLORS } from '../constants';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ITEMS_PER_PAGE = 10;

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
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-full'); setTimeout(() => document.body.removeChild(toast), 500); }, 4000);
};

interface UserEditModalProps {
    user: Vendor | BDM | Manager;
    type: 'vendor' | 'bdm' | 'manager';
    onClose: () => void;
    onSave: (updatedUser: Vendor | BDM | Manager) => void;
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-scaleIn">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-900">Edit {type === 'vendor' ? 'Calling Team' : type === 'bdm' ? 'BDM' : 'Manager'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-sm font-bold text-gray-700">Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500" /></div>
                    {type === 'bdm' && (<div><label className="block text-sm font-bold text-gray-700">Region</label><select name="region" value={formData.region} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>)}
                    {type === 'vendor' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Allowed Regions</label>
                            <div className="flex flex-wrap gap-2">
                                {regions.map(r => (
                                    <label key={r} className="inline-flex items-center bg-gray-50 px-2 py-1 rounded border cursor-pointer hover:bg-gray-100">
                                        <input type="checkbox" checked={formData.allowedRegions.includes(r)} onChange={() => toggleAllowedRegion(r)} className="rounded text-indigo-600 mr-2" />
                                        <span className="text-sm">{r}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div><label className="block text-sm font-bold text-gray-700">Username</label><input type="text" name="username" value={formData.username} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500" /></div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700">Password</label>
                        <div className="flex gap-2 mt-1">
                            <div className="relative flex-grow">
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required className="block w-full border border-gray-300 rounded-md p-2 pr-10 shadow-sm" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-indigo-600">{showPassword ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}</button>
                            </div>
                            <button type="button" onClick={handleGeneratePassword} className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 text-xs font-bold whitespace-nowrap transition-colors">Gen</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            <span className="ml-3 text-sm font-bold text-gray-900">{formData.active ? 'Active Account' : 'Inactive (Deactivated)'}</span>
                        </label>
                    </div>
                    <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-bold">Cancel</button><button type="submit" className="px-6 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold shadow-md shadow-indigo-100">Save Changes</button></div>
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
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-scaleIn">
                <div className="flex justify-between items-center p-6 border-b bg-indigo-600 text-white rounded-t-lg">
                    <h2 className="text-xl font-normal flex items-center gap-2"><CloudArrowUpIcon className="w-6 h-6" /> Data Import Analysis</h2>
                    <button onClick={onCancel} className="text-indigo-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                        <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center">
                            <p className="text-3xl font-black text-green-700">{stats.imported}</p>
                            <p className="text-[10px] text-green-600 uppercase font-black tracking-widest mt-1">New Leads Detected</p>
                        </div>
                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 text-center">
                            <p className="text-3xl font-black text-amber-700">{stats.duplicates}</p>
                            <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest mt-1">Existing (Duplicate)</p>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
                            <p className="text-3xl font-black text-gray-700">{stats.skipped}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Skipped (Bad Data)</p>
                        </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-800 mb-4 uppercase tracking-tighter text-sm flex items-center gap-2">
                        Preview (First 20 Data Entries):
                    </h3>
                    
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Business</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Client</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Phone</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Website</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Date & Time</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Region</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Team</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Duplicate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-100">
                                    {newBookings.slice(0, 20).map((b, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${b.isDuplicate ? 'bg-amber-50/50' : ''}`}>
                                            <td className="p-3 font-bold text-gray-900 whitespace-nowrap">{b.businessName || '-'}</td>
                                            <td className="p-3 text-gray-600 whitespace-nowrap">{b.clientName || '-'}</td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.clientPhone || '-'}</td>
                                            <td className="p-3 text-indigo-600 truncate max-w-[120px]" title={b.clientWebsite}>{b.clientWebsite || '-'}</td>
                                            <td className="p-3 text-gray-600 whitespace-nowrap">{b.date} {b.time}</td>
                                            <td className="p-3">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded font-bold uppercase text-[9px]">{b.region}</span>
                                            </td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.vendor.name || '-'}</td>
                                            <td className="p-3">
                                                {b.isDuplicate ? 
                                                    <span className="text-amber-600 font-black text-[9px] uppercase">YES</span> : 
                                                    <span className="text-green-600 font-black text-[9px] uppercase">NEW</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {newBookings.length === 0 && (
                                        <tr><td colSpan={8} className="p-10 text-center text-gray-400 italic">No valid records found in file.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Verify that all columns match your expectations before confirming.
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={onCancel} className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-sm shadow-sm transition-all">Cancel</button>
                        <button onClick={onConfirm} disabled={newBookings.length === 0} className="flex-1 sm:flex-none px-10 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-md shadow-green-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">CONFIRM BULK IMPORT</button>
                    </div>
                </div>
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
    const [userMgmtTab, setUserMgmtTab] = useState<'vendors' | 'bdms' | 'managers' | 'leave'>('vendors');
    const [editingUser, setEditingUser] = useState<{ user: Vendor | BDM | Manager, type: 'vendor' | 'bdm' | 'manager' } | null>(null);
    const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
    const [importPreview, setImportPreview] = useState<{ newBookings: Booking[], stats: { imported: number, duplicates: number, skipped: number } } | null>(null);
    
    // Pagination State
    const [activeLeadsPage, setActiveLeadsPage] = useState(1);
    const [vendorsPage, setVendorsPage] = useState(1);
    const [bdmsPage, setBdmsPage] = useState(1);
    const [managersPage, setManagersPage] = useState(1);

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
    const [newManagerName, setNewManagerName] = useState('');
    const [newManagerUsername, setNewManagerUsername] = useState('');
    const [newManagerPassword, setNewManagerPassword] = useState('');
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

    const visibilityCutoff = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 7);
        return d;
    }, []);

    const visibleBookings = useMemo(() => {
        return allBookings.filter(b => {
            if (b.isBlocker) return false;
            if (searchTerm.trim()) return true;
            const [y, m, d] = b.date.split('-').map(Number);
            const bDate = new Date(y, m - 1, d);
            return bDate >= visibilityCutoff;
        });
    }, [allBookings, searchTerm, visibilityCutoff]);

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

    const activeLeads = useMemo(() => {
        return visibleBookings.filter(b => {
            const matchesStatus = ['active', 'rescheduled_bdm'].includes(b.status);
            if (!matchesStatus) return false;
            return matchesGlobalSearch(b, searchTerm);
        }).sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.id - a.id; 
        });
    }, [visibleBookings, searchTerm]);

    const totalActiveLeadsPages = Math.max(1, Math.ceil(activeLeads.length / ITEMS_PER_PAGE));
    const paginatedActiveLeads = useMemo(() => {
        const start = (activeLeadsPage - 1) * ITEMS_PER_PAGE;
        return activeLeads.slice(start, start + ITEMS_PER_PAGE);
    }, [activeLeads, activeLeadsPage]);

    const groupedActiveLeads = useMemo(() => {
        const groups: Record<string, Booking[]> = {};
        paginatedActiveLeads.forEach(b => { if (!groups[b.date]) groups[b.date] = []; groups[b.date].push(b); });
        return groups;
    }, [paginatedActiveLeads]);

    const sortedActiveDates = useMemo(() => Object.keys(groupedActiveLeads).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedActiveLeads]);

    const rejectedLeads = useMemo(() => {
        return visibleBookings.filter(b => {
            if (b.status !== 'rejected') return false;
            return matchesGlobalSearch(b, searchTerm);
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [visibleBookings, searchTerm]);

    const archivedLeads = useMemo(() => {
        return visibleBookings.filter(b => {
            const isArchived = ['seen', 'sold', 'rescheduled', 'cancelled', 'dq'].includes(b.status);
            if (!isArchived) return false;
            return matchesGlobalSearch(b, searchTerm);
        }).sort((a, b) => b.id - a.id);
    }, [visibleBookings, searchTerm]);

    const bdmsByRegion = useMemo(() => bdms.reduce((acc, bdm) => { if (bdm.active !== false) { if (!acc[bdm.region]) acc[bdm.region] = []; acc[bdm.region].push(bdm); } return acc; }, {} as Record<Region, BDM[]>), [bdms]);
    
    // FIX: Added missing memoized state for manual requests, analytics filtering, and calendar data
    const pendingRequests = useMemo(() => {
        return allBookings.filter(b => b.status === 'pending_approval' && !b.isBlocker)
            .sort((a, b) => b.id - a.id);
    }, [allBookings]);

    const analyticsBookings = useMemo(() => {
        return allBookings.filter(b => {
            if (b.isBlocker) return false;
            const bDate = new Date(b.date);
            if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
            if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
            return true;
        });
    }, [allBookings, analyticsDateRange]);

    const allBookingsForCalendar = useMemo(() => {
        return allBookings.filter(b => !b.isBlocker);
    }, [allBookings]);

    const blockedSlotsForEdit = useMemo(() => {
        return bookingToEdit ? allBookings.filter(b => b.parentBookingId === bookingToEdit.id).map(b => b.time) : [];
    }, [bookingToEdit, allBookings]);

    const sortedVendors = useMemo(() => [...vendors].sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [vendors]);
    const sortedBdms = useMemo(() => [...bdms].sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [bdms]);
    const sortedManagers = useMemo(() => [...managers].sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [managers]);
    
    // Paginated Users
    const paginatedVendors = useMemo(() => sortedVendors.slice((vendorsPage - 1) * ITEMS_PER_PAGE, vendorsPage * ITEMS_PER_PAGE), [sortedVendors, vendorsPage]);
    const paginatedBdms = useMemo(() => sortedBdms.slice((bdmsPage - 1) * ITEMS_PER_PAGE, bdmsPage * ITEMS_PER_PAGE), [sortedBdms, bdmsPage]);
    const paginatedManagers = useMemo(() => sortedManagers.slice((managersPage - 1) * ITEMS_PER_PAGE, managersPage * ITEMS_PER_PAGE), [sortedManagers, managersPage]);

    const handleAssignBdm = (bookingId: number, bdmId: number) => { 
        setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bdmId } : b)); 
        const bdm = bdms.find(b => b.id === bdmId);
        const booking = allBookings.find(b => b.id === bookingId);
        
        if (bdm) {
            setNotifications(prev => [...prev, { id: Date.now(), vendorId: bdm.id, bookingId, message: `New Lead Assigned: ${booking?.clientName} (${booking?.businessName})`, read: false, timestamp: new Date().toISOString() }]);
            if (bdm.notificationPreferences?.newAssignment) {
                sendEmailNotification(bdm.email || '', `New Lead Assigned: ${booking?.businessName}`, booking || {}, `Hello ${bdm.name}, you have been assigned a new lead for ${booking?.businessName}. Please review the details in your dashboard.`);
            }
            triggerSystemAlert(`Lead assigned to ${bdm.name}. Notification sent.`);
        }
        setBookingToManage(null); 
    };
    
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
        
        setNotifications(prev => [...prev, { id: Date.now(), vendorId: bookingToManage.vendor.id, bookingId: currentBookingId, message: `Your booking for ${bookingToManage.clientName} was rejected. Reason: ${reasonStr}`, read: false, timestamp: new Date().toISOString() }]);
        if (bookingToManage.vendor.notificationPreferences?.statusChange) {
            sendEmailNotification(bookingToManage.vendor.email || '', `Lead Rejected: ${bookingToManage.businessName}`, bookingToManage, `The lead for ${bookingToManage.businessName} was rejected. Reason: ${reasonStr}`);
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

        if (approvedBooking) {
            const targetId = approvedBooking.bdmId || approvedBooking.vendor.id;
            setNotifications(prev => [...prev, { id: Date.now(), vendorId: targetId, bookingId, message: `Request Approved: ${approvedBooking?.clientName} on ${approvedBooking?.date}`, read: false, timestamp: new Date().toISOString() }]);
            const targetUser = approvedBooking.bdmId ? bdms.find(b => b.id === approvedBooking?.bdmId) : vendors.find(v => v.id === approvedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision) {
                 sendEmailNotification(targetUser.email || '', `Request Approved: ${approvedBooking.businessName}`, approvedBooking, `Your booking request for ${approvedBooking.businessName} has been approved and confirmed.`);
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

         setNotifications(prev => [...prev, { id: Date.now(), vendorId: targetId, bookingId, message: `Request Rejected for ${bookingId}. Reason: ${reason}`, read: false, timestamp: new Date().toISOString() }]);
         if (rejectedBooking) {
            const targetUser = rejectedBooking.bdmId ? bdms.find(b => b.id === rejectedBooking?.bdmId) : vendors.find(v => v.id === rejectedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision) {
                 sendEmailNotification(targetUser.email || '', `Request Rejected: ${rejectedBooking.businessName}`, rejectedBooking, `Your booking request for ${rejectedBooking.businessName} was rejected. Reason: ${reason}`);
            }
         }
         setRequestToReview(null);
    };

    const handleManualBookingEntry = (bookingDetails: Omit<Booking, 'id' | 'status'>, slotsToBlock: string[] = []) => {
        const mainBookingId = Date.now();
        const newBooking: Booking = { ...bookingDetails, id: mainBookingId, status: 'active' };
        const blockers: Booking[] = slotsToBlock.map((time, index) => ({ id: mainBookingId + index + 1, clientName: 'Slot Blocked', businessName: 'Admin Manual Block', clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: bookingDetails.date, time: time, vendor: newBooking.vendor, region: bookingDetails.region, isBlocker: true, parentBookingId: mainBookingId, status: 'active' }));
        sendEmailNotification("pia@zealdigital.com.au", `New Lead Booked (Admin): ${bookingDetails.businessName}`, newBooking, `Hello, Admin ${currentUser.name} has manually entered a new lead for ${bookingDetails.clientName} at ${bookingDetails.businessName}.`);
        setAllBookings(prev => [...prev, newBooking, ...blockers]);
        setIsManualBookingOpen(false);
        triggerSystemAlert(`Lead booked directly and ${slotsToBlock.length} slots blocked.`);
    };

    const handleSaveUser = (updatedUser: Vendor | BDM | Manager) => {
        if (editingUser?.type === 'vendor') setVendors(prev => prev.map(v => v.id === updatedUser.id ? (updatedUser as Vendor) : v)); 
        else if (editingUser?.type === 'bdm') setBdms(prev => prev.map(b => b.id === updatedUser.id ? (updatedUser as BDM) : b));
        else setManagers(prev => prev.map(m => m.id === updatedUser.id ? (updatedUser as Manager) : m));
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

    const handleAddManager = () => {
        if (!newManagerName.trim() || !newManagerUsername.trim() || !newManagerPassword.trim()) { alert('Fill all fields'); return; }
        const newManager: Manager = { id: Date.now(), name: newManagerName.trim(), username: newManagerUsername.trim().toLowerCase(), password: newManagerPassword.trim(), active: true, email: '', notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES };
        setManagers(prev => [...prev, newManager]);
        setNewManagerName(''); setNewManagerUsername(''); setNewManagerPassword('');
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

    const parseTimeStringToMinutes = (timeStr: string) => {
        try {
            const [t, mod] = timeStr.split(' ');
            let [h, m] = t.split(':').map(Number);
            if (mod === 'PM' && h !== 12) h += 12;
            if (mod === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        } catch (e) { return 0; }
    };

    const handleDeleteLeave = (id: number) => { setLeaveDays(prev => prev.filter(l => l.id !== id)); };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => { setBrandingForm(prev => ({ ...prev, logoUrl: reader.result as string })); };
            reader.readAsDataURL(file);
        }
    };

    const handleAddRegion = () => {
        const name = newRegionName.trim().toUpperCase();
        if (!name || regions.includes(name)) return;
        setRegions(prev => [...prev, name]);
        setRegionColors(prev => ({ ...prev, [name]: '#CBD5E1' }));
        setNewRegionName('');
    };

    const handleRegionColorChange = (region: string, color: string) => { setRegionColors(prev => ({ ...prev, [region]: color })); };

    const handleDeleteRegion = (region: string) => {
        if (window.confirm(`Delete region ${region}?`)) {
            setRegions(prev => prev.filter(r => r !== region));
            setRegionColors(prev => { const next = { ...prev }; delete next[region]; return next; });
        }
    };

    const handleAddBaseSlot = () => {
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion] || { base: [], overrides: { dayOfWeek: {}, date: {} } };
            if (config.base.includes(newBaseSlot)) return prev;
            return { ...prev, [slotConfigRegion]: { ...config, base: [...config.base, newBaseSlot].sort((a,b) => parseTimeStringToMinutes(a) - parseTimeStringToMinutes(b)) } };
        });
    };

    const handleRemoveBaseSlot = (slot: string) => {
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion];
            return { ...prev, [slotConfigRegion]: { ...config, base: config.base.filter(s => s !== slot) } };
        });
    };

    const handleAddDaySlotToStaging = () => {
        if (!newDayOverrideSlots.includes(tempDaySlot)) {
            setNewDayOverrideSlots(prev => [...prev, tempDaySlot].sort((a,b) => parseTimeStringToMinutes(a) - parseTimeStringToMinutes(b)));
        }
    };

    const handleRemoveDaySlotFromStaging = (slot: string) => { setNewDayOverrideSlots(prev => prev.filter(s => s !== slot)); };

    const handleAddDayOverride = () => {
        if (newDayOverrideSlots.length === 0) return;
        const day = parseInt(newDayOverrideDay);
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion];
            return { ...prev, [slotConfigRegion]: { ...config, overrides: { ...config.overrides, dayOfWeek: { ...config.overrides.dayOfWeek, [day]: newDayOverrideSlots } } } };
        });
        setNewDayOverrideSlots([]);
    };

    const handleRemoveDayOverride = (day: number) => {
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion];
            const nextDayOfWeek = { ...config.overrides.dayOfWeek };
            delete nextDayOfWeek[day];
            return { ...prev, [slotConfigRegion]: { ...config, overrides: { ...config.overrides, dayOfWeek: nextDayOfWeek } } };
        });
    };

    const handleAddDateSlotToStaging = () => {
        if (!newDateOverrideSlots.includes(tempDateSlot)) {
            setNewDateOverrideSlots(prev => [...prev, tempDateSlot].sort((a,b) => parseTimeStringToMinutes(a) - parseTimeStringToMinutes(b)));
        }
    };

    const handleRemoveDateSlotFromStaging = (slot: string) => { setNewDateOverrideSlots(prev => prev.filter(s => s !== slot)); };

    const handleAddDateOverride = () => {
        if (!newDateOverrideDate || newDateOverrideSlots.length === 0) return;
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion];
            return { ...prev, [slotConfigRegion]: { ...config, overrides: { ...config.overrides, date: { ...config.overrides.date, [newDateOverrideDate]: newDateOverrideSlots } } } };
        });
        setNewDateOverrideDate('');
        setNewDateOverrideSlots([]);
    };

    const handleRemoveDateOverride = (date: string) => {
        setAppointmentTimes(prev => {
            const config = prev[slotConfigRegion];
            const nextDate = { ...config.overrides.date };
            delete nextDate[date];
            return { ...prev, [slotConfigRegion]: { ...config, overrides: { ...config.overrides, date: nextDate } } };
        });
    };

    const toggleHolidayRegion = (region: Region) => { setNewHolidayRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]); };

    const handleSaveHoliday = () => {
        if (!newHolidayName || !newHolidayStartDate || newHolidayRegions.length === 0) return;
        const holiday: PublicHoliday = { id: editingHolidayOriginal ? editingHolidayOriginal.id : Date.now(), name: newHolidayName, startDate: newHolidayStartDate, endDate: newHolidayEndDate || newHolidayStartDate, regions: newHolidayRegions };
        if (editingHolidayOriginal) { setPublicHolidays(prev => prev.map(h => h.id === holiday.id ? holiday : h)); } else { setPublicHolidays(prev => [...prev, holiday]); }
        setNewHolidayName(''); setNewHolidayStartDate(''); setNewHolidayEndDate(''); setNewHolidayRegions([]); setEditingHolidayOriginal(null);
    };

    const handleEditHoliday = (holiday: PublicHoliday) => { setEditingHolidayOriginal(holiday); setNewHolidayName(holiday.name); setNewHolidayStartDate(holiday.startDate); setNewHolidayEndDate(holiday.endDate); setNewHolidayRegions(holiday.regions); };
    const handleDeleteHoliday = (id: number) => { setPublicHolidays(prev => prev.filter(h => h.id !== id)); };
    const handleSaveBranding = () => { if (logoFile) { const reader = new FileReader(); reader.onloadend = () => { setBranding({ ...brandingForm, logoUrl: reader.result as string }); }; reader.readAsDataURL(logoFile); } else setBranding(brandingForm); };
    const handleImportUpload = async () => { if (importFile) { const { newBookings, stats } = await processImportFile(importFile, allBookings, vendors, currentUser); setImportPreview({ newBookings, stats }); } };
    const handleUpdateMyProfile = (e: React.FormEvent) => { e.preventDefault(); onUpdateProfile({ ...currentUser, ...profileForm } as any); setShowProfileSuccess(true); setIsEditingPassword(false); setTimeout(() => setShowProfileSuccess(false), 3000); };

    // --- Pagination Helper Component ---
    const Pagination = ({ totalPages, currentPage, onPageChange, totalItems, label }: { totalPages: number, currentPage: number, onPageChange: (p: number) => void, totalItems: number, label: string }) => (
        <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalItems} {label}</span>
            <div className="flex items-center gap-2">
                <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white">Prev</button>
                <span className="text-xs font-bold text-gray-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white">Next</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: dashboardBackground }}>
            <Header currentUser={currentUser} onLogout={onLogout} branding={branding} notifications={myNotifications} setNotifications={setNotifications} />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="border-b border-gray-300">
                        <nav className="-mb-px flex space-x-8">
                            {[{ id: 'bookings', label: 'Dashboard', icon: DocumentTextIcon }, { id: 'analytics', label: 'Analytics', icon: PresentationChartLineIcon }, { id: 'users', label: 'User Management', icon: UserGroupIcon }, { id: 'calendar', label: 'Calendar', icon: CalendarDaysIcon }, { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }].map(item => (
                                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 ${activeTab === item.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><item.icon className="w-5 h-5" /> {item.label}</button>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-6">
                        {activeTab === 'bookings' && (
                            <>
                                {pendingRequests.length > 0 && (
                                    <div className="mb-10 animate-fadeIn">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                            <h2 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Pending Manual Requests ({pendingRequests.length})</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {pendingRequests.map(req => (
                                                <div key={req.id} className="bg-white rounded-xl border-2 border-indigo-100 p-4 shadow-md shadow-indigo-100/50 hover:border-indigo-300 transition-all flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="text-xs font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">{req.vendor.name}</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase">{req.region}</div>
                                                        </div>
                                                        <div className="font-bold text-gray-900 leading-tight mb-1">{req.businessName}</div>
                                                        <div className="text-xs text-gray-500 mb-3">{req.clientName}</div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-3">
                                                            <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                                                            {new Date(req.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            <span className="text-gray-300">|</span>
                                                            <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                                                            {req.time}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setRequestToReview(req)} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-sm transition-all">Review & Action</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mt-4">
                                    <div className="flex-grow max-w-2xl">
                                        <div className="relative flex items-center">
                                            <MagnifyingGlassIcon className="absolute left-3 w-5 h-5 text-gray-400" />
                                            <input type="text" className="block w-full rounded-xl border-0 py-3 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-black transition-all bg-white" placeholder="Search by name, phone, website, address..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveLeadsPage(1); }} />
                                            {searchTerm && (
                                                <button onClick={() => { setSearchTerm(''); setActiveLeadsPage(1); }} className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button onClick={() => setIsManualBookingOpen(true)} className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 shadow-md transition-all font-bold uppercase text-xs tracking-widest flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Book Lead</button>
                                        <button onClick={() => exportBookingsToCSV(allBookings, 'leads_report')} className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4" /> Export</button>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-12 pb-20">
                                    {/* 1. ACTIVE LEADS */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4 border-b pb-2">
                                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2"><ClockIcon className="w-5 h-5 text-indigo-600" /> Active Leads</h2>
                                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Rolling 7-Day Window</span>
                                        </div>
                                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Client & Business</th>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact & Address</th>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team</th>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Region</th>
                                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-100">
                                                        {sortedActiveDates.map(date => {
                                                            const [y, m, d] = date.split('-').map(Number);
                                                            const displayDate = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                            return (
                                                                <React.Fragment key={date}>
                                                                    <tr className="bg-gray-50/50"><td colSpan={7} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-tighter">{displayDate}</td></tr>
                                                                    {groupedActiveLeads[date].map(b => (
                                                                        <tr key={b.id} className="hover:bg-gray-50 transition-all">
                                                                            <td className="px-6 py-4">
                                                                                <div className="text-sm font-bold text-gray-900">{b.clientName}</div>
                                                                                <div className="text-xs text-gray-400">{b.businessName}</div>
                                                                                {b.clientWebsite && (<a href={b.clientWebsite.startsWith('http') ? b.clientWebsite : `https://${b.clientWebsite}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline truncate max-w-[150px] block transition-colors mt-0.5">{b.clientWebsite}</a>)}
                                                                            </td>
                                                                            <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-xs text-gray-900 font-bold mb-1"><PhoneIcon className="w-3.5 h-3.5 text-indigo-400" /><a href={`tel:${b.clientPhone}`} className="hover:text-indigo-600 transition-colors">{b.clientPhone}</a></div><div className="text-[10px] text-gray-500 max-w-[180px] leading-tight break-words">{b.address}</div></td>
                                                                            <td className="px-6 py-4 text-xs text-gray-500 font-bold">{b.vendor.name}</td>
                                                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{b.time}</td>
                                                                            <td className="px-6 py-4"><span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600 uppercase">{b.region}</span></td>
                                                                            <td className="px-6 py-4">{getStatusPill(b.status)}</td>
                                                                            <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><select className="text-[10px] border-gray-200 rounded-lg p-1 font-bold outline-none" value={b.bdmId || ''} onChange={(e) => handleAssignBdm(b.id, Number(e.target.value))}><option value="">Assign BDM</option>{bdmsByRegion[b.region]?.map(bdm => (<option key={bdm.id} value={bdm.id}>{bdm.name}</option>))}</select><button onClick={() => setBookingToManage(b)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all" title="Reject"><XMarkIcon className="w-4 h-4" /></button><button onClick={() => setBookingToEdit(b)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all" title="Edit"><PencilSquareIcon className="w-4 h-4" /></button><button onClick={() => handleDeleteBooking(b.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button></div></td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                        {activeLeads.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">No active leads in current view.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Pagination totalPages={totalActiveLeadsPages} currentPage={activeLeadsPage} onPageChange={setActiveLeadsPage} totalItems={activeLeads.length} label="Active Leads" />
                                        </div>
                                    </div>

                                    {/* 2. REJECTED LEADS */}
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2"><ExclamationTriangleIcon className="w-5 h-5 text-red-600" /> Rejected Leads</h2>
                                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"><RejectedBookingsList bookings={rejectedLeads} role="manager" searchTerm={searchTerm} /></div>
                                    </div>

                                    {/* 3. ARCHIVED LEADS */}
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5 text-emerald-600" /> Archived Leads (History)</h2>
                                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"><ArchivedBookingsList bookings={archivedLeads} role="manager" searchTerm={searchTerm} /></div>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'analytics' && (
                          <div className="space-y-8 animate-fadeIn pb-20">
                            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Analytics Controls</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    <DateRangePicker startDate={analyticsDateRange.startDate} endDate={analyticsDateRange.endDate} onDateChange={setAnalyticsDateRange} />
                                    <div className="flex flex-col">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Trend Grouping</label>
                                        <div className="flex rounded-md shadow-sm">
                                            {['daily', 'weekly', 'monthly', 'yearly'].map(p => (<button key={p} onClick={() => setAnalyticsTimePeriod(p as any)} className={`flex-1 py-2 text-sm border capitalize transition-all ${analyticsTimePeriod === p ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{p}</button>))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <AnalyticsDashboard bookings={analyticsBookings} isManager={true} /><BdmOutcomePerformance bookings={analyticsBookings} bdms={bdms} /><TrendAnalytics bookings={analyticsBookings} period={analyticsTimePeriod} /><div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><StatusAnalytics bookings={analyticsBookings} title="Database Distribution" /><VendorPerformanceAnalytics bookings={analyticsBookings} vendors={vendors} /></div><PerformanceLeadLog bookings={analyticsBookings} bdms={bdms} title="Global Data Report Log" />
                          </div>
                        )}
                        {activeTab === 'users' && (
                            <>
                                <div className="mb-6 border-b border-gray-300">
                                    <nav className="flex space-x-6">
                                        <button onClick={() => setUserMgmtTab('vendors')} className={`pb-4 px-1 border-b-2 font-bold text-sm ${userMgmtTab === 'vendors' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Calling Teams</button>
                                        <button onClick={() => setUserMgmtTab('bdms')} className={`pb-4 px-1 border-b-2 font-bold text-sm ${userMgmtTab === 'bdms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>BDMs</button>
                                        <button onClick={() => setUserMgmtTab('managers')} className={`pb-4 px-1 border-b-2 font-bold text-sm ${userMgmtTab === 'managers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Managers</button>
                                        <button onClick={() => setUserMgmtTab('leave')} className={`pb-4 px-1 border-b-2 font-bold text-sm ${userMgmtTab === 'leave' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Staff Leave</button>
                                    </nav>
                                </div>
                                {userMgmtTab === 'vendors' && (
                                    <div className="space-y-8 animate-fadeIn">
                                        <div className="bg-white p-6 rounded-xl shadow border border-gray-200"><h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-gray-400">Add New Calling Team</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Name</label><input type="text" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Username</label><input type="text" value={newVendorUsername} onChange={e => setNewVendorUsername(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div></div><div className="mb-4"><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Password</label><div className="flex gap-2"><input type="text" value={newVendorPassword} onChange={e => setNewVendorPassword(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/><button onClick={() => setNewVendorPassword(generateSecurePassword())} className="bg-gray-100 border px-3 rounded hover:bg-gray-200 text-xs font-bold transition-colors">Generate</button></div></div></div><div className="mb-4"><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-2">Allowed Regions</label><div className="flex flex-wrap gap-3">{regions.map(r => (<label key={r} className="inline-flex items-center bg-gray-50 px-3 py-1.5 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"><input type="checkbox" checked={newVendorRegions.includes(r)} onChange={() => setNewVendorRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} className="rounded text-indigo-600 focus:ring-indigo-500 mr-2"/><span className="text-sm font-medium text-gray-700">{r}</span></label>))}</div></div><button onClick={handleAddVendor} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 uppercase tracking-widest text-xs">Register Calling Team</button></div>
                                        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Username</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Regions</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-100">
                                                    {paginatedVendors.map(v => (
                                                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{v.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{v.username}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                <div className="flex items-center gap-2"><span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{visiblePasswords[v.id] ? v.password : '••••••••'}</span><button type="button" onClick={() => togglePasswordVisibility(v.id)} className="text-gray-400 hover:text-indigo-600 transition-colors">{visiblePasswords[v.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button></div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-wrap gap-2">{v.allowedRegions?.map(r => (<span key={r} className="text-[10px] px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500 rounded font-bold uppercase tracking-tight">{r}</span>)) || <span className="text-[10px] text-gray-400">ALL</span>}</div></td>
                                                            <td className="px-6 py-4 whitespace-nowrap">{v.active !== false ? <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-full uppercase">Active</span> : <span className="text-red-600 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-full uppercase">Inactive</span>}</td>
                                                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-3"><button onClick={() => setEditingUser({user: v, type: 'vendor'})} className="text-gray-400 hover:text-indigo-600 transition-colors p-1"><PencilSquareIcon className="w-4 h-4" /></button></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <Pagination totalPages={Math.ceil(sortedVendors.length/ITEMS_PER_PAGE)} currentPage={vendorsPage} onPageChange={setVendorsPage} totalItems={sortedVendors.length} label="Calling Teams" />
                                        </div>
                                    </div>
                                )}
                                {userMgmtTab === 'bdms' && (
                                    <div className="space-y-8 animate-fadeIn">
                                        <div className="bg-white p-6 rounded-xl shadow border border-gray-200"><h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-gray-400">Add New BDM</h4><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Name</label><input type="text" value={newBdmName} onChange={e => setNewBdmName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Region</label><select value={newBdmRegion} onChange={e => setNewBdmRegion(e.target.value as any)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Username</label><input type="text" value={newBdmUsername} onChange={e => setNewBdmUsername(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Password</label><div className="flex gap-2"><input type="text" value={newBdmPassword} onChange={e => setNewBdmPassword(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/><button onClick={() => setNewBdmPassword(generateSecurePassword())} className="bg-gray-100 border px-3 rounded hover:bg-gray-200 text-xs font-bold">Gen</button></div></div></div><button onClick={handleAddBdm} className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 uppercase tracking-widest text-xs shadow-md shadow-indigo-100">Register BDM Account</button></div>
                                        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Region</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Username</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-100">
                                                    {paginatedBdms.map(b => (
                                                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{b.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap"><span className="text-[10px] px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500 rounded font-bold uppercase tracking-tight">{b.region}</span></td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{b.username}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                <div className="flex items-center gap-2"><span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{visiblePasswords[b.id] ? b.password : '••••••••'}</span><button type="button" onClick={() => togglePasswordVisibility(b.id)} className="text-gray-400 hover:text-indigo-600">{visiblePasswords[b.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button></div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">{b.active !== false ? <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-full uppercase">Active</span> : <span className="text-red-600 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-full uppercase">Inactive</span>}</td>
                                                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-3"><button onClick={() => setEditingUser({user: b, type: 'bdm'})} className="text-gray-400 hover:text-indigo-600 transition-colors p-1"><PencilSquareIcon className="w-4 h-4" /></button></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <Pagination totalPages={Math.ceil(sortedBdms.length/ITEMS_PER_PAGE)} currentPage={bdmsPage} onPageChange={setBdmsPage} totalItems={sortedBdms.length} label="BDMs" />
                                        </div>
                                    </div>
                                )}
                                {userMgmtTab === 'managers' && (
                                    <div className="space-y-8 animate-fadeIn">
                                        <div className="bg-white p-6 rounded-xl shadow border border-gray-200"><h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-gray-400">Add New Manager</h4><div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Name</label><input type="text" value={newManagerName} onChange={e => setNewManagerName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Username</label><input type="text" value={newManagerUsername} onChange={e => setNewManagerUsername(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/></div><div><label className="text-xs font-bold uppercase tracking-tight text-gray-500 block mb-1">Password</label><div className="flex gap-2"><input type="text" value={newManagerPassword} onChange={e => setNewManagerPassword(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"/><button onClick={() => setNewManagerPassword(generateSecurePassword())} className="bg-gray-100 border px-3 rounded hover:bg-gray-200 text-xs font-bold">Gen</button></div></div></div><button onClick={handleAddManager} className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 uppercase tracking-widest text-xs shadow-md shadow-indigo-100">Register Manager Account</button></div>
                                        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Username</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-100">
                                                    {paginatedManagers.map(m => (
                                                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{m.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{m.username}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600"><div className="flex items-center gap-2"><span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{visiblePasswords[m.id] ? m.password : '••••••••'}</span><button type="button" onClick={() => togglePasswordVisibility(m.id)} className="text-gray-400 hover:text-indigo-600 transition-colors">{visiblePasswords[m.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button></div></td>
                                                            <td className="px-6 py-4 whitespace-nowrap">{m.active !== false ? <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-full uppercase">Active</span> : <span className="text-red-600 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-full uppercase">Inactive</span>}</td>
                                                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-3"><button onClick={() => setEditingUser({user: m, type: 'manager'})} className="text-gray-400 hover:text-indigo-600 transition-colors p-1"><PencilSquareIcon className="w-4 h-4" /></button></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <Pagination totalPages={Math.ceil(sortedManagers.length/ITEMS_PER_PAGE)} currentPage={managersPage} onPageChange={setManagersPage} totalItems={sortedManagers.length} label="Managers" />
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
                                            <div><label className="block text-sm font-normal text-gray-700">Password</label><div className="flex gap-2 mt-1"><div className="relative flex-grow"><input type={showProfilePassword ? "text" : "password"} value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className={`block w-full border border-gray-300 rounded-md p-2 pr-10 shadow-sm ${!isEditingPassword ? 'bg-gray-50' : ''}`} disabled={!isEditingPassword && profileForm.password !== ''}/><button type="button" onClick={() => setShowProfilePassword(!showProfilePassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-indigo-600">{showProfilePassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button></div>{(!isEditingPassword && profileForm.password !== '') ? (<button type="button" onClick={() => setIsEditingPassword(true)} className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 text-xs font-normal whitespace-nowrap flex items-center gap-1"><PencilSquareIcon className="w-3 h-3" /> Edit</button>) : (<button type="button" onClick={() => setProfileForm({...profileForm, password: generateSecurePassword()})} className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-xs font-normal">Gen</button>)}</div></div>
                                            <div><label className="block text-sm font-normal text-gray-700">Recovery Email</label><input type="email" value={profileForm.recoveryEmail} onChange={e => setProfileForm({...profileForm, recoveryEmail: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" /></div>
                                            <div><label className="block text-sm font-normal text-gray-700">Contact Emails</label><div className="flex gap-2 mt-1"><input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="block w-full border border-gray-300 rounded-md shadow-sm" placeholder="Enter email address..." /><button type="button" onClick={() => { if(emailInput && !profileForm.email.includes(emailInput)) { setProfileForm({...profileForm, email: profileForm.email ? `${profileForm.email},${emailInput}` : emailInput}); setEmailInput(''); } }} className="bg-black text-white px-4 py-2 rounded-md font-normal text-sm">Add</button></div><div className="mt-2 flex flex-wrap gap-2">{profileForm.email.split(',').filter(Boolean).map(email => (<span key={email} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-normal border border-indigo-100">{email}<button type="button" onClick={() => setProfileForm({...profileForm, email: profileForm.email.split(',').filter(e => e !== email).join(',')})} className="text-indigo-400 hover:text-indigo-600"><XMarkIcon className="w-3 h-3" /></button></span>))}</div></div>
                                            <div className="pt-4 flex flex-col gap-3"><button type="submit" className="w-full bg-black text-white py-3 rounded-lg font-normal shadow-sm hover:bg-gray-800 transition-all uppercase text-xs tracking-widest">Update Profile</button>{showProfileSuccess && <p className="text-center text-xs font-normal text-green-600">✅ Profile updated successfully!</p>}</div>
                                        </form>
                                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-fit"><h4 className="font-normal text-gray-800 mb-4">Email Notifications</h4><NotificationSettings preferences={profileForm.notificationPreferences} onChange={(p) => setProfileForm({...profileForm, notificationPreferences: p})} role="manager" /></div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200"><h3 className="text-xl font-normal mb-6 flex items-center gap-2"><ChartBarIcon className="w-6 h-6" /> Branding & Appearance</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-8"><div><label className="block text-sm font-normal text-gray-700 mb-2">Company Name</label><input type="text" value={brandingForm.companyName} onChange={e => setBrandingForm({...brandingForm, companyName: e.target.value})} className="w-full border p-2.5 rounded-md" /></div><div><label className="block text-sm font-normal text-gray-700 mb-2">Primary Brand Color</label><div className="flex items-center gap-3"><input type="color" value={brandingForm.primaryColor} onChange={e => setBrandingForm({...brandingForm, primaryColor: e.target.value})} className="w-12 h-10 border p-1 rounded cursor-pointer" /><span className="text-sm font-mono text-gray-500 uppercase">{brandingForm.primaryColor}</span></div></div><div><label className="block text-sm font-normal text-gray-700 mb-2">Logo Upload</label><input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-normal file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />{branding.logoUrl && <img src={branding.logoUrl} alt="Preview" className="h-12 mt-2 object-contain bg-black p-1 rounded" />}</div></div><div className="mt-8 pt-4 border-t flex justify-end"><button onClick={handleSaveBranding} className="px-8 py-2.5 bg-black text-white font-normal rounded-lg hover:bg-gray-800 uppercase tracking-widest text-xs">Save Branding</button></div></div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {bookingToManage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-fadeIn">
                        <div className="flex justify-between items-center p-4 border-b bg-red-600 text-white rounded-t-lg"><h2 className="text-xl font-normal">Reject Appointment</h2><button onClick={() => setBookingToManage(null)} className="text-red-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button></div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 font-normal">Rejecting lead for <strong>{bookingToManage.clientName}</strong>.</p>
                            <div><label className="block text-sm font-normal text-gray-700 mb-1">Reason for Rejection</label><textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} required className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-red-500 focus:border-red-500" placeholder="Explain the rejection..." /></div>
                            <div className="flex justify-end gap-3 pt-2"><button onClick={() => setBookingToManage(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-normal text-sm">Cancel</button><button onClick={handleRejectBooking} disabled={!rejectionReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-normal text-sm disabled:opacity-50">Confirm Rejection</button></div>
                        </div>
                    </div>
                </div>
            )}

            {requestToReview && <ManagerBookingReviewModal booking={requestToReview} onClose={() => setRequestToReview(null)} onApprove={handleApproveRequest} onReject={handleRejectRequest} appointmentTimes={appointmentTimes} />}
            {bookingToEdit && <BookingModal slotInfo={null} bookingToEdit={bookingToEdit} allBookings={allBookings} blockedSlotsForEdit={blockedSlotsForEdit} vendor={bookingToEdit.vendor} onClose={() => setBookingToEdit(null)} onConfirmBooking={() => {}} onUpdateBooking={handleUpdateBooking} onEditFromModal={() => {}} salespeopleCount={salespeopleCount} appointmentTimes={appointmentTimes} />}
            {editingUser && <UserEditModal user={editingUser.user} type={editingUser.type} onClose={() => setEditingUser(null)} onSave={handleSaveUser} regions={regions} />}
            {isManualBookingOpen && (<BdmBookingRequestModal currentUser={currentUser} vendors={vendors} onClose={() => setIsManualBookingOpen(false)} onRequestBooking={handleManualBookingEntry} regions={regions} appointmentTimes={appointmentTimes} />)}
            {importPreview && (<ImportPreviewModal stats={importPreview.stats} newBookings={importPreview.newBookings} onCancel={() => { setImportPreview(null); setImportFile(null); }} onConfirm={() => { if (importPreview) { setAllBookings(prev => [...prev, ...importPreview.newBookings]); setImportPreview(null); setImportFile(null); triggerSystemAlert(`Successfully imported ${importPreview.stats.imported} records.`); } }} />)}
        </div>
    );
};

export default ManagerDashboard;
