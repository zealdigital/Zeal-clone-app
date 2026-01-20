
import React, { useState } from 'react';
import type { Booking } from '../types';
import { XMarkIcon, ChatBubbleLeftRightIcon } from './Icons';

interface SmsRequestModalProps {
  booking: Booking;
  onClose: () => void;
  onSubmit: (bookingId: number, type: string, message: string) => void;
}

const SMS_TYPES = [
    'Address Confirmation',
    'Time Confirmation',
    'General Reminder',
    'Custom'
] as const;

const SmsRequestModal: React.FC<SmsRequestModalProps> = ({ booking, onClose, onSubmit }) => {
  const [type, setType] = useState<typeof SMS_TYPES[number]>('Address Confirmation');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(booking.id, type, message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b bg-indigo-600 text-white rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
            Request SMS
          </h2>
          <button onClick={onClose} className="text-indigo-100 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
                Ask the Manager to send an SMS to <strong>{booking.clientName}</strong>.
            </p>
            
            <div>
              <label htmlFor="smsType" className="block text-sm font-medium text-gray-700">Request Type</label>
              <select
                id="smsType"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {SMS_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="smsMessage" className="block text-sm font-medium text-gray-700">Additional Context (Optional)</label>
              <textarea
                id="smsMessage"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Please confirm they know it's Unit 4, not 5."
              />
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium">Send Request</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SmsRequestModal;
