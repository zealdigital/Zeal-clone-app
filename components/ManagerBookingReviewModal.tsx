import React, { useState, useMemo } from 'react';
import type { Booking, AppointmentSlotsConfig } from '../types';
import { XMarkIcon } from './Icons';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';
import { formatDDMMYY } from '../utils/dateUtils';

interface ManagerBookingReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onApprove: (bookingId: number, slotsToRemove: string[]) => void;
  onReject: (bookingId: number, reason: string) => void;
  appointmentTimes: Record<string, AppointmentSlotsConfig>;
}

const ManagerBookingReviewModal: React.FC<ManagerBookingReviewModalProps> = ({ 
    booking, onClose, onApprove, onReject, appointmentTimes 
}) => {
  const [slotsToRemove, setSlotsToRemove] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState<'approve' | 'reject'>('approve');

  // Get all available slots for this specific date and region
  const standardSlotsForDay = useMemo(() => {
      const dateObj = new Date(booking.date + 'T00:00:00Z');
      const slots = getAppointmentSlotsForDay(dateObj, booking.region, appointmentTimes);
      return slots;
  }, [booking, appointmentTimes]);

  const handleSlotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSlotsToRemove(prev => checked ? [...prev, value] : prev.filter(s => s !== value));
  };

  const handleSelectAll = () => {
    setSlotsToRemove([...standardSlotsForDay]);
  };

  const handleClearAll = () => {
    setSlotsToRemove([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg animate-scaleIn">
        <div className="flex justify-between items-center p-4 border-b bg-indigo-600 text-white rounded-t-lg">
          <h2 className="text-xl font-bold">Review Booking Request</h2>
          <button onClick={onClose} className="text-indigo-100 hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Booking Summary */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-sm shadow-sm">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Client:</span> 
                  <span className="font-semibold text-gray-900">{booking.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Business:</span> 
                  <span className="font-semibold text-gray-900">{booking.businessName}</span>
                </div>
                {booking.clientWebsite && (
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Website:</span>
                        <a 
                            href={booking.clientWebsite.startsWith('http') ? booking.clientWebsite : `https://${booking.clientWebsite}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:text-indigo-800 font-bold underline transition-colors truncate max-w-[220px]"
                            title={booking.clientWebsite}
                        >
                            {booking.clientWebsite}
                        </a>
                    </div>
                )}
                <div className="flex justify-between">
                  <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Requested By:</span> 
                  <span className="font-semibold text-gray-900">{booking.callerName || booking.vendor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Date:</span> 
                  <span className="font-semibold text-gray-900">{formatDDMMYY(booking.date)}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-black">
                  <span className="font-bold text-indigo-500 uppercase text-[10px] tracking-wider">Requested Time:</span> 
                  <span className="bg-indigo-100 px-2 py-0.5 rounded">{booking.time}</span>
                </div>
                {booking.notes && (
                  <div className="pt-3 border-t border-gray-200 mt-2">
                    <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider block mb-1">Notes:</span> 
                    <p className="text-gray-700 italic leading-relaxed bg-white/50 p-2 rounded border border-gray-100">{booking.notes}</p>
                  </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('approve')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'approve' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Approve & Configure
                </button>
                <button 
                    onClick={() => setActiveTab('reject')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'reject' ? 'bg-white text-red-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Reject Request
                </button>
            </div>

            {activeTab === 'approve' && (
                <div className="space-y-3 animate-fadeIn">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                            Select slots to block ({slotsToRemove.length} selected):
                        </label>
                        <div className="flex gap-2">
                            {standardSlotsForDay.length > 0 && (
                                <>
                                    <button 
                                        onClick={handleSelectAll}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                    >
                                        Select All
                                    </button>
                                    {slotsToRemove.length > 0 && (
                                        <button 
                                            onClick={handleClearAll}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-700"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    
                    {standardSlotsForDay.length === 0 ? (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                            <p className="text-sm text-amber-700">No standard slots available for this date.</p>
                            <p className="text-xs text-amber-500 mt-1">The appointment will still be approved without blocking any slots.</p>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="grid grid-cols-2 gap-2">
                                {standardSlotsForDay.map(slot => (
                                    <label key={slot} className="flex items-center gap-3 cursor-pointer group p-2 rounded hover:bg-white transition-colors">
                                        <input 
                                            type="checkbox" 
                                            value={slot} 
                                            checked={slotsToRemove.includes(slot)} 
                                            onChange={handleSlotChange}
                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer" 
                                        />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600">{slot}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <p className="text-[10px] text-gray-400 font-medium italic">
                        Selected slots will be marked as 'Blocked' on the Vendor Dashboard to prevent overlap.
                    </p>
                    
                    <button 
                        onClick={() => onApprove(booking.id, slotsToRemove)}
                        className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black uppercase tracking-widest text-xs shadow-lg shadow-green-100 transition-all active:scale-95"
                    >
                        Confirm Approval {slotsToRemove.length > 0 ? `(${slotsToRemove.length} slot${slotsToRemove.length !== 1 ? 's' : ''} will be blocked)` : ''}
                    </button>
                </div>
            )}

            {activeTab === 'reject' && (
                <div className="space-y-4 animate-fadeIn">
                     <div>
                       <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Reason for Rejection</label>
                       <textarea 
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={4}
                          className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl p-4 text-sm focus:border-red-500 focus:ring-0 transition-all outline-none"
                          placeholder="Please explain why this request is being rejected..."
                       />
                     </div>
                     <button 
                        onClick={() => onReject(booking.id, rejectionReason)}
                        disabled={!rejectionReason.trim()}
                        className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-black uppercase tracking-widest text-xs shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Rejection
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ManagerBookingReviewModal;
