import React, { useState, useMemo } from 'react';
import type { Booking, AppointmentSlotsConfig } from '../types';
import { XMarkIcon } from './Icons';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';

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

  const standardSlotsForDay = useMemo(() => {
      const dateObj = new Date(booking.date + 'T00:00:00Z');
      return getAppointmentSlotsForDay(dateObj, booking.region, appointmentTimes);
  }, [booking, appointmentTimes]);

  const handleSlotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSlotsToRemove(prev => checked ? [...prev, value] : prev.filter(s => s !== value));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b bg-indigo-600 text-white rounded-t-lg">
          <h2 className="text-xl font-bold">Review Booking Request</h2>
          <button onClick={onClose} className="text-indigo-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 space-y-4">
            {/* Booking Summary */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-2 text-sm">
                <div className="flex justify-between"><span className="font-semibold">Client:</span> <span>{booking.clientName}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Business:</span> <span>{booking.businessName}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Requested By:</span> <span>{booking.callerName} (BDM)</span></div>
                <div className="flex justify-between"><span className="font-semibold">Date:</span> <span>{booking.date}</span></div>
                <div className="flex justify-between text-indigo-700 font-bold"><span className="font-semibold">Requested Time:</span> <span>{booking.time}</span></div>
                {booking.notes && <div className="pt-2 border-t border-gray-200 mt-2"><span className="font-semibold block mb-1">Notes:</span> {booking.notes}</div>}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('approve')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'approve' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                >
                    Approve & Configure
                </button>
                <button 
                    onClick={() => setActiveTab('reject')}
                    className={`flex-1 py-2 text-sm font-medium ${activeTab === 'reject' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                >
                    Reject Request
                </button>
            </div>

            {activeTab === 'approve' && (
                <div className="space-y-3 animate-fadeIn">
                    <p className="text-sm text-gray-700 font-medium">Select standard slots to remove/block (if any):</p>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border border-gray-200 max-h-40 overflow-y-auto">
                        {standardSlotsForDay.map(slot => (
                            <label key={slot} className="flex items-center space-x-2 text-sm">
                                <input 
                                    type="checkbox" 
                                    value={slot} 
                                    checked={slotsToRemove.includes(slot)} 
                                    onChange={handleSlotChange}
                                    className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                                />
                                <span>{slot}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500">Selected slots will be marked as 'Blocked' on the Vendor Dashboard.</p>
                    <button 
                        onClick={() => onApprove(booking.id, slotsToRemove)}
                        className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold mt-2"
                    >
                        Confirm Approval
                    </button>
                </div>
            )}

            {activeTab === 'reject' && (
                <div className="space-y-3 animate-fadeIn">
                     <label className="block text-sm font-medium text-gray-700">Reason for Rejection</label>
                     <textarea 
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                        placeholder="Why is this request being rejected?"
                     />
                     <button 
                        onClick={() => onReject(booking.id, rejectionReason)}
                        disabled={!rejectionReason.trim()}
                        className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold mt-2 disabled:bg-gray-400"
                    >
                        Reject Request
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ManagerBookingReviewModal;