import React, { useState } from 'react';
import type { Booking } from '../types';
import { XMarkIcon } from './Icons';

interface BdmNoteReminderModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (bookingId: number, note: string, reminder: string | null) => void;
}

const BdmNoteReminderModal: React.FC<BdmNoteReminderModalProps> = ({ booking, onClose, onSave }) => {
  const [note, setNote] = useState(booking.bdmPrivateNote || '');
  // Format the reminder date for the datetime-local input, which expects 'YYYY-MM-DDTHH:MM'
  const [reminder, setReminder] = useState(booking.bdmReminder ? booking.bdmReminder.slice(0, 16) : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(booking.id, note.trim(), reminder || null);
  };
  
  const handleClearReminder = () => {
    setReminder('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Notes & Reminder</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md">
              <p className="font-semibold text-indigo-900">{booking.clientName}</p>
              <p className="text-sm text-indigo-800">{booking.businessName}</p>
              <p className="text-xs text-gray-600 mt-1">{new Date(booking.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC'})} at {booking.time}</p>
            </div>
            
            <div>
              <label htmlFor="bdmReminder" className="block text-sm font-medium text-gray-700">Set Reminder</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="datetime-local"
                  id="bdmReminder"
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button type="button" onClick={handleClearReminder} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="bdmPrivateNote" className="block text-sm font-medium text-gray-700">Your Private Note</label>
              <textarea
                id="bdmPrivateNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Add your personal notes here. Only you can see this."
              />
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
            <button type="submit" className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BdmNoteReminderModal;