
import React, { useMemo, useState, useEffect } from 'react';
import type { Booking } from '../types';
import { getStatusPill, getVendorStatusPill, maskSoldText } from '../utils/statusUtils';
import { PhoneIcon, CalendarDaysIcon, PencilSquareIcon, MapPinIcon } from './Icons';
import { formatDDMMYY } from '../utils/dateUtils';

interface ArchivedBookingsListProps {
  bookings: Booking[];
  role: 'manager' | 'vendor' | 'bdm';
  searchTerm?: string;
  onEditBooking?: (booking: Booking) => void;
}

const ITEMS_PER_PAGE = 10;

const ArchivedBookingsList: React.FC<ArchivedBookingsListProps> = ({ bookings, role, searchTerm, onEditBooking }) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bookings]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / ITEMS_PER_PAGE));
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedBookings, currentPage]);

  const groupedBookings = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    paginatedBookings.forEach(b => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    return groups;
  }, [paginatedBookings]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedBookings).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedBookings]);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg border border-gray-100">
        <h3 className="text-lg text-gray-700">{searchTerm ? 'No Bookings Found' : 'No Archived Bookings'}</h3>
        <p className="text-gray-500 mt-1">
          {searchTerm
            ? `Your search for "${searchTerm}" did not match any archived bookings.`
            : 'Completed or cancelled appointments will appear here.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-black">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Client & Business</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Phone</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Region</th>
              {role === 'manager' && <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Booked By</th>}
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Note</th>
              {onEditBooking && <th scope="col" className="px-6 py-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedDateKeys.map(date => (
              <React.Fragment key={date}>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <td colSpan={role === 'manager' ? (onEditBooking ? 8 : 7) : (onEditBooking ? 7 : 6)} className="px-6 py-2 text-sm font-normal text-gray-600 uppercase tracking-tight">
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                      {formatDDMMYY(date)}
                    </div>
                  </td>
                </tr>
                {groupedBookings[date].map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-normal text-gray-900 leading-tight">{booking.businessName}</div>
                      <div className="text-xs font-normal text-gray-500">{booking.clientName}</div>
                      {booking.clientWebsite && (
                        <a 
                          href={booking.clientWebsite.startsWith('http') ? booking.clientWebsite : `https://${booking.clientWebsite}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline truncate max-w-[150px] block transition-colors mt-0.5"
                        >
                          {booking.clientWebsite}
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">
                        <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 hover:text-indigo-600 font-normal transition-colors">
                            <PhoneIcon className="w-4 h-4 text-gray-300" />
                            {booking.clientPhone}
                        </a>
                        {booking.address && (
                          <div className="mt-1 flex items-start gap-1.5 max-w-[180px]">
                            <MapPinIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium leading-tight break-words transition-colors"
                            >
                              {booking.address}
                            </a>
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-normal text-gray-900">{booking.time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 inline-flex text-[10px] font-normal rounded-full bg-gray-100 text-gray-600 uppercase">
                        {booking.region}
                      </span>
                    </td>
                    {role === 'manager' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-normal text-gray-500">{booking.vendor.name}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                        {role === 'vendor' ? getVendorStatusPill(booking.status) : getStatusPill(booking.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-xs text-gray-400 max-w-xs leading-snug uppercase tracking-tighter font-normal">
                        {(role === 'vendor' ? maskSoldText(booking.bdmNote || booking.notes) : (booking.bdmNote || booking.notes)) || <span className="italic opacity-50">No notes</span>}
                    </td>
                    {onEditBooking && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => onEditBooking(booking)} 
                          className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-all"
                          title="Edit Archived Lead"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {sortedDateKeys.map(date => (
          <div key={date}>
            <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 border-y border-gray-100">
              <CalendarDaysIcon className="w-3.5 h-3.5" />
              {formatDDMMYY(date)}
            </div>
            <div className="divide-y divide-gray-100">
              {groupedBookings[date].map((booking) => (
                <div key={booking.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{booking.businessName}</h4>
                      <p className="text-xs text-gray-500">{booking.clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {role === 'vendor' ? getVendorStatusPill(booking.status) : getStatusPill(booking.status)}
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gray-100 text-gray-600 uppercase">
                        {booking.region}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Contact</p>
                      <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 text-indigo-600 font-medium">
                        <PhoneIcon className="w-3.5 h-3.5" />
                        {booking.clientPhone}
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Time</p>
                      <p className="font-medium text-gray-700">{booking.time}</p>
                    </div>
                  </div>

                  {booking.address && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Address</p>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-start gap-1.5"
                      >
                        <MapPinIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {booking.address}
                      </a>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Notes</p>
                    <p className="text-xs text-gray-500 leading-relaxed italic">
                      {(role === 'vendor' ? maskSoldText(booking.bdmNote || booking.notes) : (booking.bdmNote || booking.notes)) || 'No notes'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    {role === 'manager' && (
                      <div className="text-[10px] text-gray-400">
                        Booked by: <span className="font-bold text-gray-600">{booking.vendor.name}</span>
                      </div>
                    )}
                    {onEditBooking && (
                      <button 
                        onClick={() => onEditBooking(booking)}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                        Edit Record
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {bookings.length} total archived records
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                    First
                </button>
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
                <button 
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                    Last
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedBookingsList;
