
import React from 'react';
import type { Booking } from '../types';
import { XMarkIcon, ChatBubbleLeftRightIcon, CheckBadgeIcon } from './Icons';

interface ManagerSmsActionModalProps {
  booking: Booking;
  onClose: () => void;
  onMarkAsSent: (bookingId: number) => void;
}

const ManagerSmsActionModal: React.FC<ManagerSmsActionModalProps> = ({ booking, onClose, onMarkAsSent }) => {
  if (!booking.smsRequest) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b bg-indigo-600 text-white rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
            SMS Request
          </h2>
          <button onClick={onClose} className="text-indigo-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800 mb-4">
                <strong>Pending Action:</strong> {booking.vendor.name} has requested an SMS be sent to this client.
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-semibold">{booking.clientName}</span>
                </div>
                 <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-semibold select-all">{booking.clientPhone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Request Type:</span>
                    <span className="font-bold text-indigo-600">{booking.smsRequest.type}</span>
                </div>
                <div className="py-2">
                    <span className="text-gray-500 block mb-1">Context/Note:</span>
                    <p className="bg-gray-100 p-2 rounded text-gray-700 italic">
                        {booking.smsRequest.message || "No additional notes."}
                    </p>
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">
                Please send the SMS manually using your device. Once sent, click the button below to notify the calling team.
            </p>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm">Close</button>
            <button 
                onClick={() => onMarkAsSent(booking.id)} 
                className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md text-sm font-medium"
            >
                <CheckBadgeIcon className="w-4 h-4" />
                Mark as Sent
            </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerSmsActionModal;
