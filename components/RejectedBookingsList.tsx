
import React, { useState, useMemo, useEffect } from 'react';
import type { Booking } from '../types';
import { PhoneIcon } from './Icons';

import { formatToDDMMYY } from '../utils/dateUtils';

interface RejectedBookingsListProps {
  bookings: Booking[];
  role: 'manager' | 'vendor' | 'bdm';
  searchTerm?: string;
}

const ITEMS_PER_PAGE = 10;

const RejectedBookingsList: React.FC<RejectedBookingsListProps> = ({ bookings, role, searchTerm }) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => b.id - a.id);
  }, [bookings]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / ITEMS_PER_PAGE));
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedBookings, currentPage]);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 bg-white">
        <h3 className="text-lg font-normal text-gray-400 uppercase tracking-widest">{searchTerm ? 'No Results' : 'No Rejected Bookings'}</h3>
      </div>
    );
  }

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
            {paginatedBookings.map((booking) => (
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

      {totalPages > 1 && (
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {sortedBookings.length} total rejections
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                    Prev
                </button>
                <span className="text-xs font-bold text-gray-600">Page {currentPage} of {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                    Next
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default RejectedBookingsList;
