
import React, { useState, useEffect, useMemo } from 'react';
import type { Booking, Vendor, Region, AppointmentSlotsConfig } from '../types';
import { XMarkIcon, UserGroupIcon, PencilSquareIcon, ExclamationTriangleIcon } from './Icons';
import { formatDateForStorage, formatDDMMYY } from '../utils/dateUtils';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';
import TimePicker from './TimePicker';

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};

interface SlotManagementInfo {
  date: Date;
  time: string;
  isCustom: boolean;
  region: Region;
}

interface BookingModalProps {
  slotInfo: SlotManagementInfo | null;
  bookingToEdit?: Booking | null;
  allBookings: Booking[];
  blockedSlotsForEdit?: string[];
  vendor: Vendor;
  onClose: () => void;
  onConfirmBooking: (bookingDetails: Omit<Booking, 'id' | 'vendor' | 'status'>, slotsToRemove: string[]) => void;
  onUpdateBooking: (bookingDetails: Omit<Booking, 'id' | 'vendor' | 'region' | 'status'>, slotsToRemove: string[]) => void;
  onEditFromModal: (booking: Booking) => void;
  salespeopleCount: Record<Region, number>;
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
}

interface BookingFormProps {
    onSubmit: (e: React.FormEvent) => void;
    isCustom: boolean;
    formData: {
        clientName: string; businessName: string; clientWebsite: string;
        clientPhone: string; clientEmail: string; address: string; customTime: string; customReason: string;
        callerName: string; notes: string;
    };
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onCustomTimeChange: (newTime: string) => void;
    theme: { border: string; button: string; };
    standardSlotsForDay: string[];
    slotsToRemove: string[];
    onSlotRemoveChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error: string;
    onClose: () => void;
    isEditMode: boolean;
    duplicateWarning: Booking | null;
}

const BookingForm: React.FC<BookingFormProps> = ({
    onSubmit, isCustom, formData, onChange, onCustomTimeChange, theme, standardSlotsForDay,
    slotsToRemove, onSlotRemoveChange, error, onClose, isEditMode, duplicateWarning
}) => (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
        {duplicateWarning && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3 animate-pulse shadow-sm">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                    <p className="font-bold uppercase tracking-tight">Duplicate Lead Alert</p>
                    <p>This business (<strong>"{duplicateWarning.businessName}"</strong>) or contact information has already been booked in our database.</p>
                    <p className="text-xs mt-1 opacity-75 italic">Please verify if this is a fresh lead before submitting.</p>
                </div>
            </div>
        )}

        {isCustom && (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 space-y-4">
                <div>
                    <label htmlFor="customTime" className="block text-sm font-medium text-gray-700 mb-1">Custom Time</label>
                    <TimePicker 
                        value={formData.customTime} 
                        onChange={onCustomTimeChange} 
                    />
                </div>
                <div>
                    <label htmlFor="customReason" className="block text-sm font-medium text-gray-700">Reason for Custom Appointment</label>
                    <textarea name="customReason" id="customReason" value={formData.customReason} onChange={onChange} required rows={2} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., Client could only meet at this specific time." />
                </div>
                <div>
                    <p className="block text-sm font-medium text-gray-700 mb-2">Remove Conflicting Standard Slots</p>
                    <div className="grid grid-cols-2 gap-2">
                        {standardSlotsForDay.map(slotTime => (
                            <label key={slotTime} className="flex items-center space-x-2 text-sm">
                                <input type="checkbox" value={slotTime} checked={slotsToRemove.includes(slotTime)} onChange={onSlotRemoveChange} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                <span>{slotTime}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">Client Name</label>
                <input type="text" name="clientName" id="clientName" value={formData.clientName} onChange={onChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
            <div>
                <label htmlFor="callerName" className="block text-sm font-medium text-gray-700">Caller Name</label>
                <input type="text" name="callerName" id="callerName" value={formData.callerName} onChange={onChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">Business Name</label>
                <input type="text" name="businessName" id="businessName" value={formData.businessName} onChange={onChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
             <div>
                <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700">Client's Phone</label>
                <input type="tel" name="clientPhone" id="clientPhone" value={formData.clientPhone} onChange={onChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="clientWebsite" className="block text-sm font-medium text-gray-700">Client's Website</label>
                <input type="text" name="clientWebsite" id="clientWebsite" value={formData.clientWebsite} onChange={onChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., example.com"/>
            </div>
            <div>
                <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700">Client Email</label>
                <input type="email" name="clientEmail" id="clientEmail" value={formData.clientEmail} onChange={onChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., client@email.com"/>
            </div>
        </div>
        <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Meeting Address</label>
            <textarea name="address" id="address" value={formData.address} onChange={onChange} required rows={2} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Additional Notes</label>
            <textarea name="notes" id="notes" value={formData.notes} onChange={onChange} rows={2} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Important details for the BDM..."/>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
            <button type="submit" className={`px-4 py-2 text-white rounded-md ${theme.button}`}>
                {isEditMode ? 'Update Booking' : 'Confirm Booking'}
            </button>
        </div>
    </form>
);

const ExistingBookingsView: React.FC<{ bookingsInSlot: Booking[]; onEditFromModal: (booking: Booking) => void; }> = ({ bookingsInSlot, onEditFromModal }) => (
    <div className="p-6 space-y-4">
        {bookingsInSlot.length > 0 ? (
            <ul className="divide-y divide-gray-200">
                {bookingsInSlot.map(booking => (
                    <li key={booking.id} className="py-4 flex items-center justify-between">
                        <div>
                            <p className="text-md font-semibold text-gray-900">{booking.clientName}</p>
                            <p className="text-sm text-gray-600">{booking.businessName}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <UserGroupIcon className="w-3.5 h-3.5" />
                                <span>Booked by: {booking.vendor.name}</span>
                            </div>
                        </div>
                        <button onClick={() => onEditFromModal(booking)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors">
                            <PencilSquareIcon className="w-4 h-4" /> Edit
                        </button>
                    </li>
                ))}
            </ul>
        ) : ( <p className="text-center text-gray-500 py-4">No bookings found for this slot.</p> )}
    </div>
);

const BookingModal: React.FC<BookingModalProps> = ({ 
    slotInfo, bookingToEdit, allBookings, blockedSlotsForEdit = [],
    vendor, onClose, onConfirmBooking, onUpdateBooking, onEditFromModal,
    salespeopleCount, appointmentTimes,
}) => {
  const isEditMode = !!bookingToEdit;
  const initialData = isEditMode ? bookingToEdit : slotInfo;
  
  const [activeTab, setActiveTab] = useState<'book' | 'view'>('book');
  const [formData, setFormData] = useState({
    clientName: '', businessName: '', clientWebsite: '', clientPhone: '', clientEmail: '', address: '', customTime: '10:00 AM', customReason: '', callerName: '', notes: '',
  });
  const [slotsToRemove, setSlotsToRemove] = useState<string[]>([]);
  const [error, setError] = useState('');

  const { date, time, region, isCustom, standardSlotsForDay } = useMemo(() => {
    if (isEditMode && bookingToEdit) {
      const bookingDate = new Date(bookingToEdit.date + 'T00:00:00Z');
      const slotsForBookingDay = getAppointmentSlotsForDay(bookingDate, bookingToEdit.region, appointmentTimes);
      const isCustomTime = !slotsForBookingDay.includes(bookingToEdit.time);
      return {
        date: bookingDate,
        time: bookingToEdit.time,
        region: bookingToEdit.region,
        isCustom: isCustomTime,
        standardSlotsForDay: slotsForBookingDay,
      };
    }
    if (slotInfo) {
      const slots = getAppointmentSlotsForDay(slotInfo.date, slotInfo.region, appointmentTimes);
      return { ...slotInfo, standardSlotsForDay: slots };
    }
    return { date: undefined, time: undefined, region: undefined, isCustom: undefined, standardSlotsForDay: [] };
  }, [slotInfo, bookingToEdit, isEditMode, appointmentTimes]);

  const { bookingsInSlot, canBookNew } = useMemo(() => {
    if (!date || !time || !region) return { bookingsInSlot: [], availableSlots: 0, canBookNew: false };
    const dateString = formatDateForStorage(date);
    const normalizedRegion = region.trim().toUpperCase();
    const occupiedStatuses = ['active', 'seen', 'rescheduled_bdm', 'pending_approval', 'sold'];
    const occupiedBookingsInSlot = allBookings.filter(b => 
        b.date === dateString && 
        b.time === time && 
        b.region.trim().toUpperCase() === normalizedRegion && 
        occupiedStatuses.includes(b.status)
    );
    const totalCapacity = salespeopleCount[normalizedRegion] || 0;
    const available = totalCapacity - occupiedBookingsInSlot.length;
    return { bookingsInSlot: occupiedBookingsInSlot.filter(b => !b.isBlocker), availableSlots: available, canBookNew: available > 0 };
  }, [allBookings, date, time, region, salespeopleCount]);

  // Real-time Duplicate Detection (Based only on Website URL)
  const duplicateWarning = useMemo(() => {
    const normalizedWebsite = normalizeWebsite(formData.clientWebsite);

    if (isEditMode || !normalizedWebsite) return null;
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const match = allBookings.find(b => {
        if (b.isBlocker || b.status === 'rejected') return false;
        
        const bookingDate = new Date(b.date);
        if (bookingDate < oneYearAgo) return false;

        const websiteMatch = normalizedWebsite && normalizeWebsite(b.clientWebsite) === normalizedWebsite;

        return websiteMatch;
    });

    return match || null;
  }, [formData.clientWebsite, allBookings, isEditMode]);
  
  useEffect(() => {
    if (isEditMode && bookingToEdit) {
      setActiveTab('book');
      setFormData({
        clientName: bookingToEdit.clientName, businessName: bookingToEdit.businessName,
        clientWebsite: bookingToEdit.clientWebsite, clientPhone: bookingToEdit.clientPhone,
        clientEmail: bookingToEdit.clientEmail || '',
        address: bookingToEdit.address, customTime: isCustom ? bookingToEdit.time : '10:00 AM',
        customReason: bookingToEdit.customReason || '',
        callerName: bookingToEdit.callerName || '',
        notes: bookingToEdit.notes || '',
      });
      setSlotsToRemove(blockedSlotsForEdit);
    } else if (slotInfo) {
      setFormData({ clientName: '', businessName: '', clientWebsite: '', clientPhone: '', clientEmail: '', address: '', customTime: '10:00 AM', customReason: '', callerName: '', notes: '' });
      setSlotsToRemove([]);
      setError('');
      setActiveTab(canBookNew || !!slotInfo.isCustom ? 'book' : 'view');
    }
  }, [bookingToEdit, isEditMode, isCustom, blockedSlotsForEdit, slotInfo, canBookNew]);

  if (!initialData || !date) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCustomTimeChange = (newTime: string) => {
      setFormData({ ...formData, customTime: newTime });
  };

  const handleSlotRemoveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSlotsToRemove(prev => checked ? [...prev, value] : prev.filter(slot => slot !== value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { clientName, businessName, clientWebsite, clientPhone, address, customTime, customReason, callerName } = formData;
    if (!clientName || !businessName || !clientWebsite || !clientPhone || !address || !callerName) {
      setError('Please fill out all fields.'); return;
    }
    if (isCustom && !customTime) {
      setError('Please specify a custom time.'); return;
    }
     if (isCustom && !customReason) {
      setError('Please provide a reason for the custom appointment.'); return;
    }

    const finalTime = isCustom ? customTime : time!;
    const bookingPayload = { ...formData, date: formatDateForStorage(date), time: finalTime };

    if(isEditMode) {
        onUpdateBooking({ ...bookingPayload, time: finalTime }, slotsToRemove);
    } else {
        onConfirmBooking({ ...bookingPayload, region: region! }, slotsToRemove);
    }
  };

  const theme = {
    bg: isCustom ? 'bg-red-50' : 'bg-indigo-50',
    border: isCustom ? 'border-red-500' : 'border-indigo-500',
    button: isCustom ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700',
    title: isCustom ? 'text-red-900' : 'text-indigo-900',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fadeIn`}>
        <div className={`flex justify-between items-center p-4 border-b ${theme.bg}`}>
          <h2 className={`text-xl font-bold ${theme.title}`}>
            {isEditMode ? 'Edit Appointment' : isCustom ? 'Book Custom Appointment' : `Manage Slot: ${time}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="p-3 bg-gray-50 text-sm grid grid-cols-2 gap-x-4 border-b">
            <p><strong>Region:</strong> {region}</p>
            {!isCustom && <p><strong>Time:</strong> {time}</p>}
            <p><strong>Date:</strong> {formatDDMMYY(date)}</p>
            {!isCustom && !isEditMode && <p><strong>Capacity:</strong> {bookingsInSlot.length + (allBookings.filter(b => b.date === formatDateForStorage(date) && b.time === time && b.region === region && b.isBlocker && b.status === 'active').length)} / {salespeopleCount[region.trim().toUpperCase()] || 0}</p>}
        </div>

        {!isCustom && !isEditMode && (
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 px-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('book')}
                disabled={!canBookNew}
                className={`py-3 px-2 border-b-2 font-medium text-sm ${activeTab === 'book' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'} disabled:text-gray-300 disabled:hover:border-transparent`}
              >
                Book New Appointment
              </button>
              <button
                onClick={() => setActiveTab('view')}
                className={`py-3 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'view' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Existing Bookings
                <span className={`ml-1 rounded-full px-2 text-xs ${activeTab === 'view' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-800'}`}>{bookingsInSlot.length}</span>
              </button>
            </nav>
          </div>
        )}
        
        <div className="overflow-y-auto">
            {activeTab === 'book' ? (
                <BookingForm
                    onSubmit={handleSubmit}
                    isCustom={isCustom ?? false}
                    formData={formData}
                    onChange={handleChange}
                    onCustomTimeChange={handleCustomTimeChange}
                    theme={theme}
                    standardSlotsForDay={standardSlotsForDay}
                    slotsToRemove={slotsToRemove}
                    onSlotRemoveChange={handleSlotRemoveChange}
                    error={error}
                    onClose={onClose}
                    isEditMode={isEditMode}
                    duplicateWarning={duplicateWarning}
                />
            ) : (
                <ExistingBookingsView
                    bookingsInSlot={bookingsInSlot}
                    onEditFromModal={onEditFromModal}
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
