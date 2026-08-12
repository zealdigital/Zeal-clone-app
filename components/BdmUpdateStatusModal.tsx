
import React, { useState } from 'react';
import type { Booking } from '../types';
import { XMarkIcon, MapPinIcon } from './Icons';

const BDM_STATUSES: Exclude<Booking['status'], 'active' | 'rejected' | 'pending_approval'>[] = ['sold', 'seen', 'rescheduled_bdm', 'rescheduled', 'cancelled', 'dq'];

interface BdmUpdateStatusModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (bookingId: number, status: Booking['status'], note: string) => void;
}

const statusLabels: Record<typeof BDM_STATUSES[number], string> = {
  sold: 'Sold - Sale Confirmed',
  seen: 'Seen - Met with Prospect',
  rescheduled_bdm: 'Reschedule with BDM (BDM ownership)',
  rescheduled: 'Reschedule (Calling Team)',
  cancelled: 'Cancelled by Prospect',
  dq: 'DQ - Disqualified',
};

const BdmUpdateStatusModal: React.FC<BdmUpdateStatusModalProps> = ({ booking, onClose, onSave }) => {
  const [newStatus, setNewStatus] = useState<Booking['status']>('seen');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      alert('A note is required to update the status.');
      return;
    }
    
    onSave(booking.id, newStatus, note.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scaleIn overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Update Lead Result</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Target Client</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">{booking.businessName}</p>
              <p className="text-xs text-gray-500 mb-2">{booking.clientName}</p>
              {booking.address && (
                <div className="pt-2 border-t border-indigo-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Meeting Address</p>
                  <div className="flex items-start gap-1.5">
                    <MapPinIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium block leading-tight transition-colors"
                    >
                      {booking.address}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="newStatus" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Outcome Status</label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as Booking['status'])}
                className="block w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 focus:ring-0 transition-all outline-none"
              >
                {BDM_STATUSES.map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bdmNote" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Update Notes (Required)</label>
              <textarea
                id="bdmNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                rows={4}
                className="block w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                placeholder="Briefly explain the outcome of the meeting..."
              />
            </div>
          </div>
          <div className="p-5 bg-gray-50 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              Submit Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BdmUpdateStatusModal;
