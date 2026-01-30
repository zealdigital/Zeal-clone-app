
import React from 'react';
import type { Booking } from '../types';
import { PhoneIcon } from './Icons';

interface RejectedBookingsListProps {
  bookings: Booking[];
  role: 'manager' | 'vendor' | 'bdm';
  searchTerm?: string;
}

const RejectedBookingsList: React.FC<RejectedBookingsListProps> = ({ bookings, role, searchTerm }) => {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 bg-white">
        <h3 className="text-lg font-normal text-gray-400 uppercase tracking-widest">{searchTerm ? 'No Results' : 'No Rejected Bookings'}</h3>
      </div>
    );
  }

  const sortedBookings = [...bookings].sort((a, b) => b.id - a.id);

  return (
    <div className="bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Client & Business</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Phone</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Date & Time</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Region</th>
              {role !== 'bdm' && <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Booked By (Calling Team)</th>}
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Reason for Rejection</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-normal text-gray-400 uppercase tracking-widest">Rejected By</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {sortedBookings.map((booking) => (
              <tr 
                key={booking.id} 
                className="group border-2 border-transparent transition-all duration-200"
                style={{ borderBottom: '1px solid #f3f4f6' }}
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-sm font-normal text-[#0F172A] leading-tight">{booking.businessName}</div>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">{booking.clientName}</div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                   <div className="flex items-center gap-1">
                      <PhoneIcon className="w-4 h-4 text-gray-300" />
                      <span className="text-xs text-gray-500">{booking.clientPhone}</span>
                   </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-sm font-normal text-gray-600">
                    {new Date(booking.date + 'T00:00:00Z').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})}
                    <span className="text-gray-400 ml-1">at {booking.time}</span>
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <span className="px-2 py-0.5 inline-flex text-[10px] font-normal rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-tighter">
                    {booking.region}
                  </span>
                </td>
                {role !== 'bdm' && (
                  <td className="px-6 py-5 whitespace-nowrap text-sm font-normal text-gray-500">
                    {booking.vendor.name}
                  </td>
                )}
                <td className="px-6 py-5 whitespace-normal text-sm font-normal text-red-500 max-w-xs leading-snug">
                    {booking.rejectionReason}
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-sm font-normal text-gray-400">
                    {booking.rejectedBy || 'Manager'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RejectedBookingsList;
