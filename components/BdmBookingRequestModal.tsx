
import React, { useState, useEffect, useMemo } from 'react';
import type { Booking, Region, BDM, Vendor, User, AppointmentSlotsConfig } from '../types';
import { XMarkIcon } from './Icons';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';

interface BdmBookingRequestModalProps {
  currentUser: User;
  vendors: Vendor[];
  onClose: () => void;
  onRequestBooking: (bookingDetails: Omit<Booking, 'id' | 'status'>, slotsToBlock: string[]) => void;
  prefillData?: Booking | null;
  regions: Region[];
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

const BdmBookingRequestModal: React.FC<BdmBookingRequestModalProps> = ({ currentUser, vendors, onClose, onRequestBooking, prefillData, regions, appointmentTimes }) => {
  const isManager = currentUser.role === 'manager';
  const isVendor = currentUser.role === 'vendor';
  const isBdm = currentUser.role === 'bdm';

  // Determine Title based on Role
  const getTitle = () => {
    if (isManager) return "Book Lead";
    if (isVendor) return "Request Manual Date";
    return "Request Booking Approval";
  };

  const [formData, setFormData] = useState({
    clientName: '',
    businessName: '',
    clientWebsite: '',
    clientPhone: '',
    address: '',
    date: '',
    notes: '',
    region: (isBdm ? currentUser.region : regions[0]),
    vendorId: isVendor ? currentUser.id.toString() : '',
  });

  const [slotsToBlock, setSlotsToBlock] = useState<string[]>([]);

  // Split time state for neat dropdowns
  const [timeState, setTimeState] = useState({
    hour: '10',
    minute: '00',
    period: 'AM'
  });

  useEffect(() => {
    if (prefillData) {
        // Attempt to parse existing time if present
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
            address: prefillData.address || '',
            date: '',
            notes: '',
            region: prefillData.region || (isBdm ? currentUser.region : regions[0]),
            vendorId: prefillData.vendor?.id ? prefillData.vendor.id.toString() : (isVendor ? currentUser.id.toString() : ''),
        });
        setTimeState({ hour: h, minute: m, period: p });
    }
  }, [prefillData, currentUser, isVendor, isBdm, regions]);

  // Determine standard slots for the selected date/region
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
    if (!formData.clientName || !formData.businessName || !formData.date || !formData.clientWebsite) {
      alert('Please fill in all required fields.');
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
        address: formData.address,
        callerName: currentUser.name,
        date: formData.date,
        time: formattedTime,
        region: formData.region as Region,
        notes: formData.notes,
        customReason: isManager ? 'Manager Manual Entry' : isVendor ? 'Caller Manual Request' : 'BDM Requested Booking',
        bdmId: isBdm ? currentUser.id : undefined,
        vendor: selectedVendor,
    };

    onRequestBooking(bookingPayload, slotsToBlock);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-black text-white rounded-t-lg">
          <h2 className="text-xl font-black uppercase tracking-tight">{getTitle()}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
            {!isManager && (
                <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200 italic">
                    {isVendor 
                        ? "Use this form to request a booking outside standard logic (e.g. Same Day). Manager approval required."
                        : "Submit this form to the Managers. Once approved, the appointment will be confirmed."}
                </p>
            )}
            
             <div>
                <label htmlFor="vendorId" className="block text-sm font-bold text-gray-700">Calling Team</label>
                {isVendor ? (
                    <div className="mt-1 block w-full bg-gray-100 border border-gray-200 rounded-md p-2 text-sm text-gray-600 font-medium">
                        {currentUser.name}
                    </div>
                ) : (
                    <select 
                        name="vendorId" 
                        id="vendorId" 
                        value={formData.vendorId} 
                        onChange={handleChange} 
                        disabled={!!prefillData?.vendor?.id}
                        className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm ${!!prefillData?.vendor?.id ? 'bg-gray-100' : ''}`}
                    >
                        <option value="">-- Internal / Self-Generated --</option>
                        {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="clientName" className="block text-sm font-bold text-gray-700">Client Name *</label>
                    <input type="text" name="clientName" id="clientName" value={formData.clientName} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
                </div>
                <div>
                     <label htmlFor="region" className="block text-sm font-bold text-gray-700">Region *</label>
                     <select name="region" id="region" value={formData.region} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm">
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                </div>
            </div>

             <div>
                <label htmlFor="businessName" className="block text-sm font-bold text-gray-700">Business Name *</label>
                <input type="text" name="businessName" id="businessName" value={formData.businessName} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="date" className="block text-sm font-bold text-gray-700">Date *</label>
                    <input type="date" name="date" id="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm h-[38px]" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Time *</label>
                    <div className="flex items-center gap-1">
                        <select 
                            value={timeState.hour} 
                            onChange={(e) => handleTimeChange('hour', e.target.value)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm p-1.5 sm:text-sm focus:ring-black focus:border-black"
                        >
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="font-bold text-gray-400">:</span>
                        <select 
                            value={timeState.minute} 
                            onChange={(e) => handleTimeChange('minute', e.target.value)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm p-1.5 sm:text-sm focus:ring-black focus:border-black"
                        >
                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select 
                            value={timeState.period} 
                            onChange={(e) => handleTimeChange('period', e.target.value)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm p-1.5 sm:text-sm focus:ring-black focus:border-black"
                        >
                            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="clientPhone" className="block text-sm font-bold text-gray-700">Phone</label>
                    <input type="tel" name="clientPhone" id="clientPhone" value={formData.clientPhone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="clientWebsite" className="block text-sm font-bold text-gray-700">Website *</label>
                    <input type="text" name="clientWebsite" id="clientWebsite" value={formData.clientWebsite} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
                </div>
            </div>

            <div>
                <label htmlFor="address" className="block text-sm font-bold text-gray-700">Address</label>
                <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={2} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
            </div>

            <div>
                <label htmlFor="notes" className="block text-sm font-bold text-gray-700">Notes</label>
                <textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm" />
            </div>

            {isManager && (
                <div className="pt-4 border-t border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Select standard slots to remove/block (if any):</label>
                    {standardSlotsForDay.length > 0 ? (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="grid grid-cols-2 gap-4">
                                {standardSlotsForDay.map(slot => (
                                    <label key={slot} className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input 
                                                type="checkbox" 
                                                checked={slotsToBlock.includes(slot)} 
                                                onChange={() => handleToggleSlotBlock(slot)}
                                                className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black transition-all"
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">{slot}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-4 text-[11px] text-gray-400 font-medium italic">Selected slots will be marked as 'Blocked' on the Vendor Dashboard.</p>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic px-1">Please select a date with configured slots to block them.</p>
                    )}
                </div>
            )}

            <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-bold text-sm">Cancel</button>
                <button type="submit" className="px-8 py-2 bg-black text-white font-black rounded-md hover:bg-gray-800 uppercase tracking-widest text-xs">
                    {isManager ? 'Confirm Approval' : 'Send Request'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default BdmBookingRequestModal;
