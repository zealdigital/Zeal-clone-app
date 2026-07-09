import React, { useState, useEffect, useMemo } from 'react';
import type { Booking, Region, BDM, Vendor, User, AppointmentSlotsConfig } from '../types';
import { XMarkIcon, ClockIcon, CalendarDaysIcon, UserGroupIcon, DocumentTextIcon, ExclamationTriangleIcon, MapPinIcon } from './Icons';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';
import { formatToDDMMYY } from '../utils/dateUtils';

interface BdmBookingRequestModalProps {
  currentUser: User;
  vendors: Vendor[];
  onClose: () => void;
  onRequestBooking: (bookingDetails: Omit<Booking, 'id' | 'status'>, slotsToBlock: string[], originalId?: number) => void;
  prefillData?: Booking | null;
  regions: Region[];
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  allBookings: Booking[];
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};

const BdmBookingRequestModal: React.FC<BdmBookingRequestModalProps> = ({ currentUser, vendors, onClose, onRequestBooking, prefillData, regions, appointmentTimes, allBookings }) => {
  const isManager = currentUser.role === 'manager';
  const isVendor = currentUser.role === 'vendor';
  const isBdm = currentUser.role === 'bdm';
  const isReschedule = prefillData?.status === 'rescheduled_bdm';

  const [formData, setFormData] = useState({
    clientName: '',
    businessName: '',
    clientWebsite: '',
    clientPhone: '',
    clientEmail: '',
    address: '',
    date: '',
    notes: '',
    region: (isBdm ? currentUser.region : regions[0]),
    vendorId: isVendor ? currentUser.id.toString() : '',
  });

  const [slotsToBlock, setSlotsToBlock] = useState<string[]>([]);
  const [timeState, setTimeState] = useState({ hour: '10', minute: '00', period: 'AM' });
  const [error, setError] = useState('');

  // Real-time Duplicate Detection (Based only on Website URL)
  const duplicateWarning = useMemo(() => {
    const normalizedWebsite = normalizeWebsite(formData.clientWebsite);

    if (!normalizedWebsite) return null;
    
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
  }, [formData.clientWebsite, allBookings]);

  useEffect(() => {
    if (prefillData) {
        let h = '10', m = '00', p = 'AM';
        if (prefillData.time) {
            const match = prefillData.time.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
            if (match) {
                h = match[1]; m = match[2]; p = match[3];
            }
        }

        setFormData({
            clientName: prefillData.clientName || '',
            businessName: prefillData.businessName || '',
            clientWebsite: prefillData.clientWebsite || '',
            clientPhone: prefillData.clientPhone || '',
            clientEmail: prefillData.clientEmail || '',
            address: prefillData.address || '',
            date: '',
            notes: '',
            region: prefillData.region || (isBdm ? currentUser.region : regions[0]),
            vendorId: prefillData.vendor?.id ? prefillData.vendor.id.toString() : (isVendor ? currentUser.id.toString() : ''),
        });
        setTimeState({ hour: h, minute: m, period: p });
    }
  }, [prefillData, currentUser, isVendor, isBdm, regions]);

  const standardSlotsForDay = useMemo(() => {
    if (!formData.date || !formData.region) return [];
    try {
        const dateObj = new Date(formData.date + 'T00:00:00Z');
        return getAppointmentSlotsForDay(dateObj, formData.region, appointmentTimes);
    } catch (e) {
        return [];
    }
  }, [formData.date, formData.region, appointmentTimes]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTimeChange = (field: keyof typeof timeState, value: string) => {
    setTimeState(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleSlotBlock = (slot: string) => {
    setSlotsToBlock(prev => 
        prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.clientName || !formData.businessName || !formData.date || !formData.clientWebsite || !formData.address) {
      setError('Please fill in all required fields.');
      return;
    }
    
    const formattedTime = `${timeState.hour}:${timeState.minute} ${timeState.period}`;
    
    let selectedVendor: Vendor;
    if (isVendor) {
        selectedVendor = currentUser as Vendor;
    } else if (formData.vendorId) {
        const found = vendors.find(v => v.id === parseInt(formData.vendorId));
        selectedVendor = found || { id: 0, name: 'Direct Entry', username: 'manual' };
    } else {
        selectedVendor = { id: 0, name: isManager ? 'Manager Self-Gen' : 'BDM Self-Gen', username: 'internal' };
    }
    
    const bookingPayload: Omit<Booking, 'id' | 'status'> = {
        clientName: formData.clientName,
        businessName: formData.businessName,
        clientWebsite: formData.clientWebsite,
        clientPhone: formData.clientPhone,
        clientEmail: formData.clientEmail,
        address: formData.address,
        callerName: isReschedule ? (prefillData?.callerName || currentUser.name) : currentUser.name,
        date: formData.date,
        time: formattedTime,
        region: formData.region as Region,
        notes: formData.notes,
        customReason: isReschedule ? 'BDM Reschedule Request' : (isManager ? 'Manager Manual Entry' : isVendor ? 'Caller Manual Request' : 'BDM Requested Booking'),
        bdmId: isBdm ? currentUser.id : (isReschedule ? prefillData?.bdmId : undefined),
        vendor: selectedVendor,
    };

    onRequestBooking(bookingPayload, slotsToBlock, prefillData?.id);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b bg-gray-50/80">
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
                {isManager ? 'Book Lead Directly' : (isReschedule ? 'Request Reschedule Approval' : 'Request Booking Approval')}
              </h2>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="overflow-y-auto flex-1">
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-shake">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    {duplicateWarning && (
                    <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3 animate-pulse shadow-sm">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-bold uppercase tracking-tight">Duplicate Lead Alert</p>
                            <p>This business (<strong>"{duplicateWarning.businessName}"</strong>) or contact info has already been booked.</p>
                            <p className="text-xs mt-1 opacity-75 italic">Managers will see this lead highlighted as a duplicate.</p>
                        </div>
                    </div>
                )}

                {/* Summary Card Logic */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client:</span>
                            <span className="font-bold text-gray-800">{formData.clientName || '---'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business:</span>
                            <span className="font-bold text-gray-800">{formData.businessName || '---'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date:</span>
                            <span className="font-bold text-gray-800 flex items-center gap-1.5">
                                <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                                {formatToDDMMYY(formData.date) || '---'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Requested Time:</span>
                            <span className="font-black text-indigo-600 flex items-center gap-1.5">
                                <ClockIcon className="w-3.5 h-3.5" />
                                {timeState.hour}:{timeState.minute} {timeState.period}
                            </span>
                        </div>
                        <div className="flex flex-col col-span-full pt-2 border-t border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Meeting Address:</span>
                            {formData.address ? (
                                <div className="flex items-start gap-2">
                                    <MapPinIcon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-indigo-600 hover:underline truncate"
                                    >
                                        {formData.address}
                                    </a>
                                </div>
                            ) : (
                                <span className="font-bold text-gray-400 italic">No address provided</span>
                            )}
                        </div>
                    </div>
                    {formData.notes && (
                        <div className="pt-3 border-t border-gray-200">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Notes:</span>
                            <p className="text-xs text-gray-600 italic leading-relaxed">{formData.notes}</p>
                        </div>
                    )}
                </div>

                {/* Input Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-full md:col-span-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Team Assignment</label>
                        {isVendor || isReschedule ? (
                            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm text-gray-600 font-bold">{isReschedule ? prefillData?.vendor.name : currentUser.name}</div>
                        ) : (
                            <select name="vendorId" value={formData.vendorId} onChange={handleChange} className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none">
                                <option value="">Internal / Self-Generated</option>
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Region</label>
                        {isReschedule ? (
                            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm text-gray-600 font-bold">{formData.region}</div>
                        ) : (
                            <select name="region" value={formData.region} onChange={handleChange} className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none">
                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Client Name *</label>
                        <input type="text" name="clientName" value={formData.clientName} onChange={handleChange} required disabled={isReschedule} className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Business Name *</label>
                        <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} required disabled={isReschedule} className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Date *</label>
                        <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-500 transition-all outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Appointment Time *</label>
                        <div className="flex gap-1">
                            <select value={timeState.hour} onChange={(e) => handleTimeChange('hour', e.target.value)} className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-2 py-2 text-sm font-bold focus:border-indigo-500 transition-all outline-none">
                                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <select value={timeState.minute} onChange={(e) => handleTimeChange('minute', e.target.value)} className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-2 py-2 text-sm font-bold focus:border-indigo-500 transition-all outline-none">
                                {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={timeState.period} onChange={(e) => handleTimeChange('period', e.target.value)} className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-2 py-2 text-sm font-bold focus:border-indigo-500 transition-all outline-none">
                                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Website *</label>
                        <input type="text" name="clientWebsite" value={formData.clientWebsite} onChange={handleChange} required disabled={isReschedule} placeholder="example.com" className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Phone</label>
                        <input type="tel" name="clientPhone" value={formData.clientPhone} onChange={handleChange} disabled={isReschedule} className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Client Email</label>
                        <input type="email" name="clientEmail" value={formData.clientEmail} onChange={handleChange} disabled={isReschedule} className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="client@example.com" />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Meeting Address *</label>
                        <input 
                            type="text" 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            required 
                            disabled={isReschedule}
                            placeholder="Full street address, suburb, state"
                            className={`w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 transition-all outline-none ${isReschedule ? 'opacity-60 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-indigo-500 transition-all outline-none" placeholder="Context for the BDM..." />
                    </div>
                </div>

                {/* Slot Removal Logic for Managers */}
                {isManager && (
                    <div className="pt-6 border-t border-gray-100 animate-fadeIn">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Select standard slots to remove/block (if any):</h3>
                            <p className="text-[10px] text-gray-400 font-medium">Selected slots will be marked as 'Blocked' on the Caller Dashboard to prevent overlap.</p>
                        </div>
                        {standardSlotsForDay.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {standardSlotsForDay.map(slot => (
                                    <label key={slot} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${slotsToBlock.includes(slot) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-50 bg-gray-50/50 hover:border-gray-200'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={slotsToBlock.includes(slot)} 
                                            onChange={() => handleToggleSlotBlock(slot)}
                                            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-0 transition-all"
                                        />
                                        <span className={`text-sm font-bold ${slotsToBlock.includes(slot) ? 'text-indigo-700' : 'text-gray-600'}`}>{slot}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <ClockIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 italic">Please select a valid Date and Region above to manage available slots.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
            <div className="p-5 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    <span role="img" aria-label="info">ℹ️</span> 
                    {isManager ? 'Direct entry creates active leads and blocks slots.' : 'Requests require manager review before confirmation.'}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-sm shadow-sm transition-all">Cancel</button>
                    <button 
                        type="submit"
                        className={`flex-1 sm:flex-none px-10 py-2.5 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 ${isManager ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-black hover:bg-gray-800'}`}
                    >
                        {isManager ? 'Book Now' : (isReschedule ? 'Send Reschedule Request' : 'Send Request')}
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default BdmBookingRequestModal;
