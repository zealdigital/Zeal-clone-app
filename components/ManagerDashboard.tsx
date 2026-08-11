import React, { useState, useMemo, useEffect } from 'react';
import type { Booking, Region, LeaveDay, PublicHoliday, AppointmentSlotsConfig, Vendor, BDM, User, ManagerAppointment, Notification, Branding, Manager, NotificationPreferences } from '../types';
import { Header } from './Header';
import { Cog6ToothIcon, TrashIcon, XMarkIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PlusIcon, UserGroupIcon, ChartBarIcon, DocumentTextIcon, CalendarDaysIcon, ClockIcon, PencilSquareIcon, ArrowDownTrayIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, CheckBadgeIcon, CloudArrowUpIcon, DocumentArrowDownIcon, PhoneIcon, ChatBubbleLeftRightIcon, PresentationChartLineIcon, MapPinIcon } from './Icons';
import AnalyticsDashboard from './AnalyticsDashboard';
import RejectedBookingsList from './RejectedBookingsList';
import ArchivedBookingsList from './ArchivedBookingsList';
import VendorPerformanceAnalytics from './VendorPerformanceAnalytics';
import PerformanceLeadLog from './PerformanceLeadLog';
import { getStatusPill } from '../utils/statusUtils';
import { formatToDDMMYY } from '../utils/dateUtils';
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

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};
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
    isSyncing: boolean;
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
                    {type === 'bdm' && (<div><label className="block text-sm font-bold text-gray-700 Region">Region</label><select name="region" value={formData.region} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>)}
                    {type === 'vendor' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Allowed Regions</label>
                            <div className="flex flex-wrap gap-2">
                                {regions.map(r => (
                                    <label key={r} className="inline-flex items-center bg-gray-50 px-2 py-1 rounded border cursor-pointer hover:bg-gray-100 transition-colors">
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
    bdms: BDM[];
    isSyncing: boolean;
}

const Pagination = ({ totalPages, currentPage, onPageChange, totalItems, label }: { totalPages: number, currentPage: number, onPageChange: (p: number) => void, totalItems: number, label: string }) => (
    <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalItems} {label}</span>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => onPageChange(1)} 
                disabled={currentPage === 1} 
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
                First
            </button>
            <button 
                onClick={() => onPageChange(Math.max(1, currentPage - 1))} 
                disabled={currentPage === 1} 
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
                Prev
            </button>
            <span className="text-xs font-bold text-gray-600">Page {currentPage} of {totalPages}</span>
            <button 
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} 
                disabled={currentPage === totalPages} 
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
                Next
            </button>
            <button 
                onClick={() => onPageChange(totalPages)} 
                disabled={currentPage === totalPages} 
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
                Last
            </button>
        </div>
    </div>
);

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ onCancel, onConfirm, stats, newBookings, bdms, isSyncing }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const totalPages = Math.max(1, Math.ceil(newBookings.length / itemsPerPage));
    
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return newBookings.slice(start, start + itemsPerPage);
    }, [newBookings, currentPage]);

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
                        Preview (Data Entries):
                    </h3>
                    
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Business</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Client</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Phone</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Email</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Website</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Date</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Region</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Team</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">BDM</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Caller</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Address</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Notes</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Status</th>
                                        <th className="p-3 text-gray-400 font-bold uppercase tracking-tighter">Duplicate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-100">
                                    {paginatedBookings.map((b, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${b.isDuplicate && (new Date(b.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'bg-amber-50/50' : ''}`}>
                                            <td className="p-3 font-bold text-gray-900 whitespace-nowrap">{b.businessName || '-'}</td>
                                            <td className="p-3 text-gray-600 whitespace-nowrap">{b.clientName || '-'}</td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.clientPhone || '-'}</td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.clientEmail || '-'}</td>
                                            <td className="p-3 text-indigo-600 truncate max-w-[120px]" title={b.clientWebsite}>{b.clientWebsite || '-'}</td>
                                            <td className="p-3 text-gray-600 whitespace-nowrap">{formatToDDMMYY(b.date)}</td>
                                            <td className="p-3">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded font-bold uppercase text-[9px]">{b.region}</span>
                                            </td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.vendor.name || '-'}</td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">
                                                {b.bdmId ? (bdms.find(bdm => bdm.id === b.bdmId)?.name || b.bdmId) : '-'}
                                            </td>
                                            <td className="p-3 text-gray-500 whitespace-nowrap">{b.callerName || '-'}</td>
                                            <td className="p-3 text-gray-500 truncate max-w-[150px]" title={b.address}>{b.address || '-'}</td>
                                            <td className="p-3 text-gray-500 truncate max-w-[150px]" title={b.notes}>{b.notes || '-'}</td>
                                            <td className="p-3">
                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold uppercase text-[9px]">{b.status}</span>
                                            </td>
                                            <td className="p-3">
                                                {b.isDuplicate && (new Date(b.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 
                                                    <span className="text-amber-600 font-black text-[9px] uppercase">YES</span> : 
                                                    <span className="text-green-600 font-black text-[9px] uppercase">NEW</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {newBookings.length === 0 && (
                                        <tr><td colSpan={13} className="p-10 text-center text-gray-400 italic">No valid records found in file.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {newBookings.length > 0 && (
                            <Pagination 
                                totalPages={totalPages} 
                                currentPage={currentPage} 
                                onPageChange={setCurrentPage} 
                                totalItems={newBookings.length} 
                                label="Data Entries" 
                            />
                        )}
                    </div>
                </div>
                <div className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Verify that all columns match your expectations before confirming.
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={onCancel} className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-sm shadow-sm transition-all">Cancel</button>
                        <button 
                            onClick={onConfirm} 
                            disabled={newBookings.length === 0 || isSyncing} 
                            className="flex-1 sm:flex-none px-10 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-md shadow-green-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSyncing ? 'SYNCING...' : 'CONFIRM BULK IMPORT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
    currentUser, onLogout, allBookings, setAllBookings, salespeopleCount, publicHolidays, setPublicHolidays,
    appointmentTimes, setAppointmentTimes, leaveDays, setLeaveDays, vendors, setVendors, bdms, setBdms, managers, setManagers, managerAppointments, setManagerAppointments, notifications, setNotifications, branding, setBranding, onUpdateProfile, regions, setRegions, regionColors, setRegionColors, isSyncing
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

    const myNotifications = useMemo(() => (notifications || []).filter(n => n.vendorId === 0), [notifications]);

    const visibleBookings = useMemo(() => {
        return (allBookings || []).filter(b => !b.isBlocker);
    }, [allBookings]);

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

        return visibleBookings.filter(b => {
            const matchesStatus = ['active', 'rescheduled_bdm'].includes(b.status);
            if (!matchesStatus) return false;
            if (dateRange.startDate && b.date < dateRange.startDate) return false;
            if (dateRange.endDate && b.date > dateRange.endDate) return false;
            
            if (!search) return true;
            return (
                b.clientName.toLowerCase().includes(search) ||
                b.businessName.toLowerCase().includes(search) ||
                b.clientPhone.toLowerCase().includes(search) ||
                b.clientWebsite.toLowerCase().includes(search) ||
                b.address.toLowerCase().includes(search) ||
                b.callerName.toLowerCase().includes(search) ||
                b.vendor.name.toLowerCase().includes(search) ||
                (b.notes?.toLowerCase() || '').includes(search) ||
                (b.bdmNote?.toLowerCase() || '').includes(search) ||
                b.date.includes(search) ||
                b.time.toLowerCase().includes(search) ||
                b.region.toLowerCase().includes(search) ||
                b.status.toLowerCase().includes(search)
            );
        }).sort((a, b) => {
            const pA = getPriority(a.date);
            const pB = getPriority(b.date);

            if (pA !== pB) return pA - pB;

            const dateDiff = b.date.localeCompare(a.date);
            if (dateDiff !== 0) return -dateDiff;
            return b.id - a.id; 
        });
    }, [visibleBookings, searchTerm, dateRange]);

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

    const sortedActiveDates = useMemo(() => {
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

        return Object.keys(groupedActiveLeads).sort((a, b) => {
            const pA = getPriority(a);
            const pB = getPriority(b);

            if (pA !== pB) return pA - pB;
            return b.localeCompare(a);
        });
    }, [groupedActiveLeads]);

    const rejectedLeads = useMemo(() => {
        return visibleBookings.filter(b => {
            if (b.status !== 'rejected') return false;
            if (dateRange.startDate && b.date < dateRange.startDate) return false;
            if (dateRange.endDate && b.date > dateRange.endDate) return false;
            return matchesGlobalSearch(b, searchTerm);
        }).sort((a, b) => b.id - a.id);
    }, [visibleBookings, searchTerm, dateRange]);

    const archivedLeads = useMemo(() => {
        return visibleBookings.filter(b => {
            const isArchived = ['seen', 'sold', 'rescheduled', 'cancelled', 'dq'].includes(b.status);
            if (!isArchived) return false;
            if (dateRange.startDate && b.date < dateRange.startDate) return false;
            if (dateRange.endDate && b.date > dateRange.endDate) return false;
            return matchesGlobalSearch(b, searchTerm);
        }).sort((a, b) => b.id - a.id);
    }, [visibleBookings, searchTerm, dateRange]);

    const bdmsByRegion = useMemo(() => (bdms || []).reduce((acc, bdm) => { 
        if (bdm && bdm.active !== false) { 
            if (!acc[bdm.region]) acc[bdm.region] = []; 
            acc[bdm.region].push(bdm); 
        } 
        return acc; 
    }, {} as Record<Region, BDM[]>), [bdms]);
    
    const pendingRequests = useMemo(() => {
        return (allBookings || []).filter(b => b.status === 'pending_approval' && !b.isBlocker)
            .sort((a, b) => b.id - a.id);
    }, [allBookings]);

    const analyticsBookings = useMemo(() => {
        return (allBookings || []).filter(b => {
            if (b.isBlocker) return false;
            const bDate = new Date(b.date);
            if (analyticsDateRange.startDate && bDate < new Date(analyticsDateRange.startDate)) return false;
            if (analyticsDateRange.endDate && bDate > new Date(analyticsDateRange.endDate)) return false;
            return true;
        });
    }, [allBookings, analyticsDateRange]);

    const allBookingsForCalendar = useMemo(() => {
        return (allBookings || []).filter(b => !b.isBlocker);
    }, [allBookings]);

    const blockedSlotsForEdit = useMemo(() => {
        return bookingToEdit ? (allBookings || []).filter(b => b.parentBookingId === bookingToEdit.id).map(b => b.time) : [];
    }, [bookingToEdit, allBookings]);

    const sortedVendors = useMemo(() => [...(vendors || [])].filter(Boolean).sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [vendors]);
    const sortedBdms = useMemo(() => [...(bdms || [])].filter(Boolean).sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [bdms]);
    const sortedManagers = useMemo(() => [...(managers || [])].filter(Boolean).sort((a, b) => (a.active !== false === b.active !== false) ? a.name.localeCompare(b.name) : (a.active !== false ? -1 : 1)), [managers]);
    
    const paginatedVendors = useMemo(() => sortedVendors.slice((vendorsPage - 1) * ITEMS_PER_PAGE, vendorsPage * ITEMS_PER_PAGE), [sortedVendors, vendorsPage]);
    const paginatedBdms = useMemo(() => sortedBdms.slice((bdmsPage - 1) * ITEMS_PER_PAGE, bdmsPage * ITEMS_PER_PAGE), [sortedBdms, bdmsPage]);
    const paginatedManagers = useMemo(() => sortedManagers.slice((managersPage - 1) * ITEMS_PER_PAGE, managersPage * ITEMS_PER_PAGE), [sortedManagers, managersPage]);

    const handleAssignBdm = (bookingId: number, bdmId: number) => { 
        setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bdmId } : b)); 
        const bdm = bdms.find(b => b.id === bdmId);
        const booking = allBookings.find(b => b.id === bookingId);
        
        if (bdm) {
            setNotifications(prev => [...prev, { id: Date.now(), vendorId: bdm.id, bookingId, message: `New Lead Assigned: ${booking?.clientName} (${booking?.businessName})`, read: false, timestamp: new Date().toISOString() }]);
            if (bdm.notificationPreferences?.newAssignment && bdm.email) {
                sendEmailNotification(
                  bdm.email, 
                  `New Lead Assigned: ${booking?.businessName}`, 
                  booking || {}, 
                  `Hello ${bdm.name}, you have been assigned a new lead for ${booking?.businessName}. Please review the details in your dashboard.`,
                  "NEW LEAD ASSIGNED"
                );
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
        if (bookingToManage.vendor.notificationPreferences?.statusChange && bookingToManage.vendor.email) {
            sendEmailNotification(
              bookingToManage.vendor.email, 
              `Lead Rejected: ${bookingToManage.businessName}`, 
              bookingToManage, 
              `The lead for ${bookingToManage.businessName} was rejected. Reason: ${reasonStr}`,
              "BOOKING REJECTED"
            );
        }
        setBookingToManage(null); 
        setRejectionReason('');
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
                bookedAt: bookingToEdit.bookedAt || new Date().toISOString(),
                isDuplicate: !!existingMatch,
                duplicateOfBookingId: existingMatch?.id
            };
            const newBlockers: Booking[] = slotsToRemove.map((time, index) => ({ id: Date.now() + index + 1, clientName: `Slot Blocked`, businessName: `Conflict`, clientWebsite: '', clientPhone: '', address: '', callerName: 'System', date: updatedBooking.date, time: time, vendor: bookingToEdit.vendor, region: updatedBooking.region, isBlocker: true, parentBookingId: updatedBooking.id, status: 'active', bookedAt: new Date().toISOString() }));
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
            slotsToRemove.forEach((time, index) => { newBookings.push({ id: Date.now() + index + 1, clientName: 'Manual Block', businessName: booking.clientName, clientWebsite: '', clientPhone: '', address: '', callerName: 'Manager', date: booking.date, time: time, vendor: booking.vendor, region: booking.region, isBlocker: true, parentBookingId: bookingId, status: 'active', bookedAt: new Date().toISOString() }); });
            return newBookings;
        });

        if (approvedBooking) {
            const targetId = approvedBooking.bdmId || approvedBooking.vendor.id;
            setNotifications(prev => [...prev, { id: Date.now(), vendorId: targetId, bookingId, message: `Request Approved: ${approvedBooking?.clientName} on ${formatToDDMMYY(approvedBooking?.date || '')}`, read: false, timestamp: new Date().toISOString() }]);
            const targetUser = approvedBooking.bdmId ? bdms.find(b => b.id === approvedBooking?.bdmId) : vendors.find(v => v.id === approvedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision && targetUser.email) {
                 sendEmailNotification(
                   targetUser.email, 
                   `Request Approved: ${approvedBooking.businessName}`, 
                   approvedBooking, 
                   `Your booking request for ${approvedBooking.businessName} has been approved and confirmed.`,
                   "REQUEST DECISION"
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

         setNotifications(prev => [...prev, { id: Date.now(), vendorId: targetId, bookingId, message: `Request Rejected for ${bookingId}. Reason: ${reason}`, read: false, timestamp: new Date().toISOString() }]);
         if (rejectedBooking) {
            const targetUser = rejectedBooking.bdmId ? bdms.find(b => b.id === rejectedBooking?.bdmId) : vendors.find(v => v.id === rejectedBooking?.vendor.id);
            if (targetUser && targetUser.notificationPreferences?.requestDecision && targetUser.email) {
                 sendEmailNotification(
                   targetUser.email, 
                   `Request Rejected: ${rejectedBooking.businessName}`, 
                   rejectedBooking, 
                   `Your booking request for ${rejectedBooking.businessName} was rejected. Reason: ${reason}`,
                   "REQUEST DECISION"
                 );
            }
         }
         setRequestToReview(null);
    };

    const handleManualBookingEntry = (bookingDetails: Omit<Booking, 'id' | 'status'>, slotsToBlock: string[]) => {
        const mainBookingId = Date.now();
        
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
            status: 'active',
            date: bookingDetails.date.trim(),
            time: bookingDetails.time.trim(),
            isDuplicate: !!existingMatch,
            duplicateOfBookingId: existingMatch?.id,
            bookedAt: new Date().toISOString()
        };

        const targetRegion = bookingDetails.region;
        const targetDate = bookingDetails.date.trim();

        const blockers: Booking[] = slotsToBlock.map((slotTime, index) => ({
            id: mainBookingId + (index + 1),
            clientName: 'Slot Blocked',
            businessName: 'Manual Block',
            clientWebsite: '',
            clientPhone: '',
            address: '',
            callerName: 'Manager Adjustment',
            date: targetDate,
            time: slotTime.trim(),
            vendor: newBooking.vendor,
            region: targetRegion,
            isBlocker: true,
            parentBookingId: mainBookingId,
            status: 'active',
            bookedAt: new Date().toISOString()
        }));

        sendEmailNotification(
          "pia@zealdigital.com.au", 
          `New Lead Booked (Admin): ${bookingDetails.businessName}`, 
          newBooking, 
          `Hello, Admin ${currentUser.name} has manually entered a new lead for ${bookingDetails.clientName} at ${bookingDetails.businessName}.`,
          "ADMIN MANUAL BOOKING"
        );
        
        setAllBookings(prev => [...prev, newBooking, ...blockers]);
        setIsManualBookingOpen(false);
        triggerSystemAlert(existingMatch ? `Lead booked (Duplicate Detected).` : `Lead booked directly.`);
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

    const handleAddManager = () => {
        if (!newManagerName.trim() || !newManagerUsername.trim() || !newManagerPassword.trim()) return;
        const newManager: Manager = {
            id: Date.now(),
            name: newManagerName.trim(),
            username: newManagerUsername.trim().toLowerCase(),
            password: newManagerPassword.trim(),
            active: true,
            notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES
        };
        setManagers(prev => [...prev, newManager]);
        setNewManagerName(''); setNewManagerUsername(''); setNewManagerPassword('');
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
    const handleUpdateMyProfile = (e: React.FormEvent) => { e.preventDefault(); onUpdateProfile({ ...currentUser, ...profileForm } as any); setShowProfileSuccess(true); setIsEditingPassword(false); setTimeout(() => setShowProfileSuccess(false), 3000); };

    const handleMarkSmsSent = (bookingId: number) => {
        let updatedBooking: Booking | undefined;
        setAllBookings(prev => prev.map(b => {
            if (b.id === bookingId) {
                updatedBooking = { ...b, smsRequest: b.smsRequest ? { ...b.smsRequest, status: 'sent', sentAt: new Date().toISOString() } : undefined };
                return updatedBooking;
            }
            return b;
        }));

        if (updatedBooking) {
            setNotifications(prev => [...prev, { id: Date.now(), vendorId: updatedBooking!.vendor.id, bookingId, message: `Manager sent the requested SMS to ${updatedBooking!.clientName}.`, read: false, timestamp: new Date().toISOString() }]);
            if (updatedBooking.vendor.notificationPreferences?.smsSent && updatedBooking.vendor.email) {
                sendEmailNotification(
                  updatedBooking.vendor.email, 
                  `SMS Sent: ${updatedBooking.businessName}`, 
                  updatedBooking, 
                  `Hello, the manager has sent the SMS you requested for ${updatedBooking.clientName}.`,
                  "SMS SENT TO CLIENT"
                );
            }
            triggerSystemAlert("SMS marked as sent. Caller notified.");
        }
        setSmsActionBooking(null);
    };

    return (
        <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: dashboardBackground }}>
            <Header currentUser={currentUser} onLogout={onLogout} branding={branding} notifications={myNotifications} setNotifications={setNotifications} />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="border-b border-gray-300">
                        <nav className="flex flex-wrap gap-x-6 gap-y-2 -mb-px">
                            {[
                                { id: 'bookings', label: 'Bookings', icon: DocumentTextIcon },
                                { id: 'analytics', label: 'Analytics & Reports', icon: PresentationChartLineIcon },
                                { id: 'users', label: 'User Management', icon: UserGroupIcon },
                                { id: 'calendar', label: 'My Calendar', icon: CalendarDaysIcon },
                                { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }
                            ].map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setActiveTab(item.id as any)} 
                                    className={`py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-all ${activeTab === item.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <item.icon className="w-5 h-5" /> 
                                    <span>{item.label}</span>
                                </button>
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
                                                <div key={req.id} className={`bg-white rounded-xl border-2 p-4 shadow-md transition-all flex flex-col justify-between ${req.isDuplicate && (new Date(req.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))) ? 'border-amber-400 shadow-amber-100/50 bg-amber-50/30' : (req.smsRequest?.status === 'pending' ? 'border-purple-400 shadow-purple-100/50 bg-purple-50/30' : 'border-indigo-100 shadow-indigo-100/50 hover:border-indigo-300')}`}>
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded w-fit">{req.vendor.name}</div>
                                                                {req.isDuplicate && (
                                                                    <div className="flex items-center gap-1 text-[8px] font-black text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded uppercase tracking-tighter w-fit animate-pulse">
                                                                        <ExclamationTriangleIcon className="w-2.5 h-2.5" /> Potential Duplicate
                                                                    </div>
                                                                )}
                                                                {req.smsRequest?.status === 'pending' && (
                                                                    <div className="flex items-center gap-1 text-[8px] font-black text-purple-700 bg-purple-200 px-1.5 py-0.5 rounded uppercase tracking-tighter w-fit animate-pulse">
                                                                        SMS REQUESTED
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase">{req.region}</div>
                                                        </div>
                                                        <div className="font-bold text-gray-900 text-sm leading-tight truncate">{req.businessName}</div>
                                                        <div className="text-[11px] text-gray-500 truncate">{req.clientName}</div>
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 mt-2">
                                                            <CalendarDaysIcon className="w-3 h-3 text-gray-400" />
                                                            {formatToDDMMYY(req.date)}
                                                            <span className="text-gray-300">|</span>
                                                            <ClockIcon className="w-3 h-3 text-gray-400" />
                                                            {req.time}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex justify-end">
                                                        <button 
                                                            onClick={() => setRequestToReview(req)}
                                                            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                                        >
                                                            Review Request
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Active Leads Table - UPDATED with black header and date rows */}
                                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-8">
                                    <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                                <ClockIcon className="w-5 h-5 text-green-500" />
                                                Active Leads
                                            </h2>
                                            <p className="text-sm text-gray-500">All currently active appointments</p>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} />
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            {/* BLACK HEADER */}
                                            <thead className="bg-black">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">Client & Business</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">Calling Team</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">Time</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">Status</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">Notes</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-widest">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {sortedActiveDates.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No active leads matching your criteria.</td>
                                                    </tr>
                                                ) : (
                                                    sortedActiveDates.map(dateKey => (
                                                        <React.Fragment key={dateKey}>
                                                            {/* BLACK DATE ROW */}
                                                            <tr className="bg-black border-y border-gray-800">
                                                                <td colSpan={6} className="px-6 py-3 text-sm font-bold text-white uppercase tracking-tight">
                                                                    <div className="flex items-center gap-2">
                                                                        <CalendarDaysIcon className="w-4 h-4 text-white opacity-70" />
                                                                        {formatToDDMMYY(dateKey)}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {groupedActiveLeads[dateKey].map(booking => (
                                                                <tr key={booking.id} className={`hover:bg-gray-50 transition-colors ${booking.isDuplicate ? 'bg-amber-50' : ''}`}>
                                                                    <td className="px-6 py-4">
                                                                        <div className="text-sm font-bold text-gray-900">{booking.clientName}</div>
                                                                        <div className="text-xs text-gray-500">{booking.businessName}</div>
                                                                        {booking.clientWebsite && (
                                                                            <a href={booking.clientWebsite.startsWith('http') ? booking.clientWebsite : `https://${booking.clientWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                                                {booking.clientWebsite}
                                                                            </a>
                                                                        )}
                                                                        {booking.isDuplicate && (
                                                                            <div className="mt-1 text-[10px] font-bold text-amber-600">⚠️ Duplicate</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-gray-600">{booking.vendor.name}</td>
                                                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{booking.time}</td>
                                                                    <td className="px-6 py-4">{getStatusPill(booking.status)}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                                                                        <ExpandableNote text={booking.bdmNote || booking.notes} />
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                                                        <button
                                                                            onClick={() => setBookingToManage(booking)}
                                                                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                                                                        >
                                                                            <PencilSquareIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteBooking(booking.id)}
                                                                            className="text-red-600 hover:text-red-900"
                                                                        >
                                                                            <TrashIcon className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {totalActiveLeadsPages > 1 && (
                                        <div className="px-6 py-4 bg-gray-50 border-t">
                                            <Pagination
                                                totalPages={totalActiveLeadsPages}
                                                currentPage={activeLeadsPage}
                                                onPageChange={setActiveLeadsPage}
                                                totalItems={activeLeads.length}
                                                label="Active Leads"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Archived Leads - using the updated component */}
                                <div className="mt-8">
                                    <ArchivedBookingsList
                                        bookings={archivedLeads}
                                        role="manager"
                                        searchTerm={searchTerm}
                                        onEditBooking={setBookingToEdit}
                                        bdms={bdms}
                                    />
                                </div>

                                {/* Rejected Leads */}
                                {rejectedLeads.length > 0 && (
                                    <div className="mt-8">
                                        <RejectedBookingsList bookings={rejectedLeads} role="manager" searchTerm={searchTerm} />
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'analytics' && (
                            <div className="space-y-8">
                                <AnalyticsDashboard bookings={analyticsBookings} />
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <StatusAnalytics bookings={analyticsBookings} title="Booking Status Breakdown" role="manager" />
                                    <VendorPerformanceAnalytics bookings={analyticsBookings} vendors={vendors} />
                                </div>
                                <BdmOutcomePerformance bookings={analyticsBookings} bdms={bdms} />
                                <PerformanceLeadLog bookings={analyticsBookings} bdms={bdms} title="Global Data Report Log" role="manager" />
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div>
                                <div className="border-b border-gray-200 mb-6">
                                    <nav className="-mb-px flex space-x-8">
                                        {['vendors', 'bdms', 'managers', 'leave'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setUserMgmtTab(tab as any)}
                                                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${userMgmtTab === tab ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                            >
                                                {tab === 'vendors' ? 'Calling Teams' : tab}
                                            </button>
                                        ))}
                                    </nav>
                                </div>

                                {userMgmtTab === 'vendors' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold">Calling Teams</h3>
                                            <button
                                                onClick={() => {
                                                    const name = prompt('Enter vendor name:');
                                                    if (name) {
                                                        const username = prompt('Enter username:');
                                                        const password = prompt('Enter password:');
                                                        if (username && password) {
                                                            setNewVendorName(name);
                                                            setNewVendorUsername(username);
                                                            setNewVendorPassword(password);
                                                            handleAddVendor();
                                                        }
                                                    }
                                                }}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                <PlusIcon className="w-4 h-4 inline mr-1" /> Add Vendor
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-xl shadow overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowed Regions</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {paginatedVendors.map(vendor => (
                                                        <tr key={vendor.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-sm text-gray-900">{vendor.name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{vendor.username}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 text-xs rounded-full ${vendor.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {vendor.active !== false ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                                {vendor.allowedRegions?.join(', ') || 'All'}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setEditingUser({ user: vendor, type: 'vendor' })}
                                                                    className="text-indigo-600 hover:text-indigo-900"
                                                                >
                                                                    <PencilSquareIcon className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {vendors.length > ITEMS_PER_PAGE && (
                                                <Pagination
                                                    totalPages={Math.ceil(vendors.length / ITEMS_PER_PAGE)}
                                                    currentPage={vendorsPage}
                                                    onPageChange={setVendorsPage}
                                                    totalItems={vendors.length}
                                                    label="Vendors"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {userMgmtTab === 'bdms' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold">BDMs</h3>
                                            <button
                                                onClick={() => {
                                                    const name = prompt('Enter BDM name:');
                                                    if (name) {
                                                        const username = prompt('Enter username:');
                                                        const password = prompt('Enter password:');
                                                        if (username && password) {
                                                            setNewBdmName(name);
                                                            setNewBdmUsername(username);
                                                            setNewBdmPassword(password);
                                                            handleAddBdm();
                                                        }
                                                    }
                                                }}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                <PlusIcon className="w-4 h-4 inline mr-1" /> Add BDM
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-xl shadow overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {paginatedBdms.map(bdm => (
                                                        <tr key={bdm.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-sm text-gray-900">{bdm.name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{bdm.username}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{bdm.region}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 text-xs rounded-full ${bdm.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {bdm.active !== false ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setEditingUser({ user: bdm, type: 'bdm' })}
                                                                    className="text-indigo-600 hover:text-indigo-900"
                                                                >
                                                                    <PencilSquareIcon className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {bdms.length > ITEMS_PER_PAGE && (
                                                <Pagination
                                                    totalPages={Math.ceil(bdms.length / ITEMS_PER_PAGE)}
                                                    currentPage={bdmsPage}
                                                    onPageChange={setBdmsPage}
                                                    totalItems={bdms.length}
                                                    label="BDMs"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {userMgmtTab === 'managers' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold">Managers</h3>
                                            <button
                                                onClick={() => {
                                                    const name = prompt('Enter manager name:');
                                                    if (name) {
                                                        const username = prompt('Enter username:');
                                                        const password = prompt('Enter password:');
                                                        if (username && password) {
                                                            setNewManagerName(name);
                                                            setNewManagerUsername(username);
                                                            setNewManagerPassword(password);
                                                            handleAddManager();
                                                        }
                                                    }
                                                }}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                <PlusIcon className="w-4 h-4 inline mr-1" /> Add Manager
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-xl shadow overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {paginatedManagers.map(manager => (
                                                        <tr key={manager.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-sm text-gray-900">{manager.name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{manager.username}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 text-xs rounded-full ${manager.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {manager.active !== false ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setEditingUser({ user: manager, type: 'manager' })}
                                                                    className="text-indigo-600 hover:text-indigo-900"
                                                                >
                                                                    <PencilSquareIcon className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {managers.length > ITEMS_PER_PAGE && (
                                                <Pagination
                                                    totalPages={Math.ceil(managers.length / ITEMS_PER_PAGE)}
                                                    currentPage={managersPage}
                                                    onPageChange={setManagersPage}
                                                    totalItems={managers.length}
                                                    label="Managers"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {userMgmtTab === 'leave' && (
                                    <div>
                                        <div className="bg-white p-6 rounded-xl shadow">
                                            <h3 className="text-lg font-bold mb-4">Manage BDM Leave Days</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {bdms.map(bdm => (
                                                    <label key={bdm.id} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            value={bdm.id}
                                                            checked={selectedBdmIds.includes(bdm.id)}
                                                            onChange={handleBdmCheckboxChange}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <span className="text-sm">{bdm.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={leaveStartDate}
                                                        onChange={e => setLeaveStartDate(e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={leaveEndDate}
                                                        onChange={e => setLeaveEndDate(e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">Reason</label>
                                                <input
                                                    type="text"
                                                    value={leaveReason}
                                                    onChange={e => setLeaveReason(e.target.value)}
                                                    placeholder="e.g., Annual Leave, Sick Leave"
                                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                                                <select
                                                    value={leaveType}
                                                    onChange={e => setLeaveType(e.target.value as 'allDay' | 'specificSlots')}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                >
                                                    <option value="allDay">All Day</option>
                                                    <option value="specificSlots">Specific Slots</option>
                                                </select>
                                            </div>
                                            {leaveType === 'specificSlots' && (
                                                <div className="mt-4">
                                                    <label className="block text-sm font-medium text-gray-700">Select Slots</label>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'].map(slot => (
                                                            <label key={slot} className="flex items-center space-x-1">
                                                                <input
                                                                    type="checkbox"
                                                                    value={slot}
                                                                    checked={leaveSlots.includes(slot)}
                                                                    onChange={e => {
                                                                        if (e.target.checked) {
                                                                            setLeaveSlots([...leaveSlots, slot]);
                                                                        } else {
                                                                            setLeaveSlots(leaveSlots.filter(s => s !== slot));
                                                                        }
                                                                    }}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span className="text-sm">{slot}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={handleAddLeave}
                                                className="mt-4 px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                Add Leave Days
                                            </button>
                                        </div>
                                        <div className="mt-8">
                                            <h4 className="text-lg font-bold mb-4">Existing Leave Days</h4>
                                            <div className="bg-white rounded-xl shadow overflow-hidden">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BDM</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slots</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {leaveDays.map(leave => (
                                                            <tr key={leave.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 text-sm text-gray-900">{leave.bdmName}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-500">{formatToDDMMYY(leave.date)}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-500">{leave.reason || '—'}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-500">{leave.slots?.join(', ') || 'All Day'}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        onClick={() => handleDeleteLeave(leave.id)}
                                                                        className="text-red-600 hover:text-red-900"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'calendar' && (
                            <ManagerCalendar
                                allBookings={allBookingsForCalendar}
                                currentUser={currentUser}
                                managerAppointments={managerAppointments}
                                setManagerAppointments={setManagerAppointments}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Profile Settings */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Profile Settings</h2>
                                    <form onSubmit={handleUpdateMyProfile}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                                <input
                                                    type="text"
                                                    value={profileForm.name}
                                                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                                <input
                                                    type="email"
                                                    value={profileForm.email}
                                                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Username</label>
                                                <input
                                                    type="text"
                                                    value={profileForm.username}
                                                    onChange={e => setProfileForm({ ...profileForm, username: e.target.value })}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type={showProfilePassword ? "text" : "password"}
                                                        value={profileForm.password}
                                                        onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProfilePassword(!showProfilePassword)}
                                                        className="mt-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                                                    >
                                                        {showProfilePassword ? "Hide" : "Show"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700">Recovery Email</label>
                                            <input
                                                type="email"
                                                value={profileForm.recoveryEmail}
                                                onChange={e => setProfileForm({ ...profileForm, recoveryEmail: e.target.value })}
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                        </div>
                                        <div className="mt-6">
                                            <button
                                                type="submit"
                                                className="px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                Update Profile
                                            </button>
                                            {showProfileSuccess && (
                                                <span className="ml-4 text-green-600 text-sm">Profile updated successfully!</span>
                                            )}
                                        </div>
                                    </form>
                                </div>

                                {/* Appointment Slot Configuration */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Appointment Slot Configuration</h2>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Region</label>
                                        <select
                                            value={slotConfigRegion}
                                            onChange={e => setSlotConfigRegion(e.target.value as Region)}
                                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                        >
                                            {regions.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Base Slots</label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {appointmentTimes[slotConfigRegion]?.base.map(slot => (
                                                <span key={slot} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm">
                                                    {slot}
                                                    <button
                                                        onClick={() => handleRemoveBaseSlot(slot)}
                                                        className="ml-2 text-red-600 hover:text-red-800"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <select
                                                value={newBaseSlot}
                                                onChange={e => setNewBaseSlot(e.target.value)}
                                                className="block border border-gray-300 rounded-md p-2"
                                            >
                                                {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAddBaseSlot}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                Add Slot
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Day Specific Overrides</label>
                                        <div className="flex gap-2 mt-2">
                                            <select
                                                value={newDayOverrideDay}
                                                onChange={e => setNewDayOverrideDay(e.target.value)}
                                                className="block border border-gray-300 rounded-md p-2"
                                            >
                                                {DAYS_OF_WEEK.map((day, index) => (
                                                    <option key={index} value={index}>{day}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={tempDaySlot}
                                                onChange={e => setTempDaySlot(e.target.value)}
                                                className="block border border-gray-300 rounded-md p-2"
                                            >
                                                {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAddDaySlotToStaging}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                Add Slot
                                            </button>
                                        </div>
                                        {newDayOverrideSlots.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-sm font-medium">Staging: </span>
                                                {newDayOverrideSlots.map(slot => (
                                                    <span key={slot} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm ml-2">
                                                        {slot}
                                                        <button
                                                            onClick={() => handleRemoveDaySlotFromStaging(slot)}
                                                            className="ml-2 text-red-600 hover:text-red-800"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={handleAddDayOverride}
                                                    className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
                                                >
                                                    Save Day Override
                                                </button>
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            {Object.entries(appointmentTimes[slotConfigRegion]?.overrides.dayOfWeek || {}).map(([day, slots]) => (
                                                <div key={day} className="inline-flex items-center px-3 py-1 bg-blue-100 rounded-full text-sm ml-2 mt-2">
                                                    {DAYS_OF_WEEK[parseInt(day)]}: {slots.join(', ')}
                                                    <button
                                                        onClick={() => handleRemoveDayOverride(parseInt(day))}
                                                        className="ml-2 text-red-600 hover:text-red-800"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Specific Date Overrides</label>
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                type="date"
                                                value={newDateOverrideDate}
                                                onChange={e => setNewDateOverrideDate(e.target.value)}
                                                className="block border border-gray-300 rounded-md p-2"
                                            />
                                            <select
                                                value={tempDateSlot}
                                                onChange={e => setTempDateSlot(e.target.value)}
                                                className="block border border-gray-300 rounded-md p-2"
                                            >
                                                {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAddDateSlotToStaging}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                            >
                                                Add Slot
                                            </button>
                                        </div>
                                        {newDateOverrideSlots.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-sm font-medium">Staging: </span>
                                                {newDateOverrideSlots.map(slot => (
                                                    <span key={slot} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm ml-2">
                                                        {slot}
                                                        <button
                                                            onClick={() => handleRemoveDateSlotFromStaging(slot)}
                                                            className="ml-2 text-red-600 hover:text-red-800"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={handleAddDateOverride}
                                                    className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
                                                >
                                                    Save Date Override
                                                </button>
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            {Object.entries(appointmentTimes[slotConfigRegion]?.overrides.date || {}).map(([date, slots]) => (
                                                <div key={date} className="inline-flex items-center px-3 py-1 bg-green-100 rounded-full text-sm ml-2 mt-2">
                                                    {date}: {slots.join(', ')}
                                                    <button
                                                        onClick={() => handleRemoveDateOverride(date)}
                                                        className="ml-2 text-red-600 hover:text-red-800"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Holiday Management */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Holiday & Event Management</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Holiday Name</label>
                                            <input
                                                type="text"
                                                value={newHolidayName}
                                                onChange={e => setNewHolidayName(e.target.value)}
                                                placeholder="e.g., Christmas Day"
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input
                                                type="date"
                                                value={newHolidayStartDate}
                                                onChange={e => setNewHolidayStartDate(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                                            <input
                                                type="date"
                                                value={newHolidayEndDate}
                                                onChange={e => setNewHolidayEndDate(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Regions</label>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {regions.map(r => (
                                                    <label key={r} className="inline-flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={newHolidayRegions.includes(r)}
                                                            onChange={() => toggleHolidayRegion(r)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <span className="ml-1 text-sm">{r}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSaveHoliday}
                                        className="mt-4 px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                    >
                                        {editingHolidayOriginal ? 'Update Holiday' : 'Add Holiday'}
                                    </button>
                                    <div className="mt-6">
                                        <h4 className="text-lg font-bold mb-4">Configured Holidays</h4>
                                        <div className="space-y-2">
                                            {publicHolidays.map(holiday => (
                                                <div key={holiday.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                                    <div>
                                                        <span className="font-bold">{holiday.name}</span>
                                                        <span className="ml-4 text-sm text-gray-600">
                                                            {formatToDDMMYY(holiday.startDate)} - {formatToDDMMYY(holiday.endDate)}
                                                        </span>
                                                        <span className="ml-4 text-sm text-gray-600">
                                                            {holiday.regions.join(', ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditHoliday(holiday)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                        >
                                                            <PencilSquareIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteHoliday(holiday.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Region Management */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Region Management</h2>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newRegionName}
                                            onChange={e => setNewRegionName(e.target.value)}
                                            placeholder="New Region Name"
                                            className="block w-full border border-gray-300 rounded-md p-2"
                                        />
                                        <button
                                            onClick={handleAddRegion}
                                            className="px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                        >
                                            Add Region
                                        </button>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {regions.map(region => (
                                            <div key={region} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full">
                                                <input
                                                    type="color"
                                                    value={regionColors[region] || '#CBD5E1'}
                                                    onChange={e => handleRegionColorChange(region, e.target.value)}
                                                    className="w-6 h-6 rounded-full border-0 p-0 mr-2"
                                                />
                                                <span className="text-sm">{region}</span>
                                                <button
                                                    onClick={() => handleDeleteRegion(region)}
                                                    className="ml-2 text-red-600 hover:text-red-800"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Branding */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Branding</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                            <input
                                                type="text"
                                                value={brandingForm.companyName}
                                                onChange={e => setBrandingForm({ ...brandingForm, companyName: e.target.value })}
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Primary Color</label>
                                            <input
                                                type="color"
                                                value={brandingForm.primaryColor}
                                                onChange={e => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                                                className="mt-1 block w-full h-12 border border-gray-300 rounded-md p-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Logo</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                            />
                                            {brandingForm.logoUrl && (
                                                <img src={brandingForm.logoUrl} alt="Logo" className="mt-2 h-12 object-contain" />
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSaveBranding}
                                        className="mt-4 px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                    >
                                        Save Branding
                                    </button>
                                </div>

                                {/* Data Management */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h2 className="text-xl font-bold mb-4">Data Management</h2>
                                    <div className="flex flex-wrap gap-4">
                                        <button
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = '.csv';
                                                input.onchange = async (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (file) {
                                                        const result = await processImportFile(file, allBookings, vendors, bdms, currentUser);
                                                        setImportPreview(result);
                                                    }
                                                };
                                                input.click();
                                            }}
                                            className="px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                        >
                                            <CloudArrowUpIcon className="w-4 h-4 inline mr-1" /> Bulk Import
                                        </button>
                                        <button
                                            onClick={() => exportBookingsToCSV(allBookings, 'full_database')}
                                            className="px-6 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800"
                                        >
                                            <DocumentArrowDownIcon className="w-4 h-4 inline mr-1" /> Export Full Database
                                        </button>
                                        <button
                                            onClick={() => {
                                                const template = generateImportTemplate();
                                                const blob = new Blob([template], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'import_template.csv';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="px-6 py-2 bg-gray-600 text-white rounded-lg text-sm font-bold hover:bg-gray-700"
                                        >
                                            Download Template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modals */}
            {bookingToManage && (
                <ManagerBookingReviewModal
                    booking={bookingToManage}
                    onClose={() => setBookingToManage(null)}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                    appointmentTimes={appointmentTimes}
                />
            )}

            {requestToReview && (
                <ManagerBookingReviewModal
                    booking={requestToReview}
                    onClose={() => setRequestToReview(null)}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                    appointmentTimes={appointmentTimes}
                />
            )}

            {bookingToEdit && (
                <BookingModal
                    slotInfo={null}
                    bookingToEdit={bookingToEdit}
                    allBookings={allBookings}
                    blockedSlotsForEdit={blockedSlotsForEdit}
                    vendor={bookingToEdit.vendor}
                    onClose={() => setBookingToEdit(null)}
                    onConfirmBooking={() => {}}
                    onUpdateBooking={handleUpdateBooking}
                    onEditFromModal={() => {}}
                    salespeopleCount={salespeopleCount}
                    appointmentTimes={appointmentTimes}
                    role="manager"
                    regions={regions}
                />
            )}

            {isManualBookingOpen && (
                <BdmBookingRequestModal
                    currentUser={currentUser}
                    vendors={vendors}
                    onClose={() => setIsManualBookingOpen(false)}
                    onRequestBooking={(bookingDetails) => {
                        handleManualBookingEntry(bookingDetails, []);
                    }}
                    regions={regions}
                    appointmentTimes={appointmentTimes}
                    allBookings={allBookings}
                />
            )}

            {smsActionBooking && (
                <ManagerSmsActionModal
                    booking={smsActionBooking}
                    onClose={() => setSmsActionBooking(null)}
                    onSendSms={handleMarkSmsSent}
                />
            )}

            {importPreview && (
                <ImportPreviewModal
                    onCancel={() => setImportPreview(null)}
                    onConfirm={() => {
                        setAllBookings(prev => [...prev, ...importPreview.newBookings]);
                        setImportPreview(null);
                        triggerSystemAlert(`Successfully imported ${importPreview.newBookings.length} bookings!`);
                    }}
                    stats={importPreview.stats}
                    newBookings={importPreview.newBookings}
                    bdms={bdms}
                    isSyncing={isSyncing}
                />
            )}

            {editingUser && (
                <UserEditModal
                    user={editingUser.user}
                    type={editingUser.type}
                    onClose={() => setEditingUser(null)}
                    onSave={handleSaveUser}
                    regions={regions}
                />
            )}
        </div>
    );
};

export default ManagerDashboard;
