
import React, { useMemo } from 'react';
import type { Booking } from '../types';
import { getStatusPill } from '../utils/statusUtils';
import { PhoneIcon, CalendarDaysIcon } from './Icons';

interface ArchivedBookingsListProps {
  bookings: Booking[];
  role: 'manager' | 'vendor' | 'bdm';
  searchTerm?: string;
}

const ArchivedBookingsList: React.FC<ArchivedBookingsListProps> = ({ bookings, role, searchTerm }) => {
  const groupedBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: Record<string, Booking[]> = {};
    sorted.forEach(b => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    return groups;
  }, [bookings]);

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
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Client & Business</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Phone</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Region</th>
              {role === 'manager' && <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Booked By</th>}
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedDateKeys.map(date => (
              <React.Fragment key={date}>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <td colSpan={role === 'manager' ? 7 : 6} className="px-6 py-2 text-sm font-normal text-gray-600 uppercase tracking-tight">
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                      {new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>
                </tr>
                {groupedBookings[date].map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-normal text-gray-900 leading-tight">{booking.businessName}</div>
                      <div className="text-xs font-normal text-gray-500">{booking.clientName}</div>
                      {booking.clientWebsite && (
                        <div className="text-[10px] text-indigo-500 font-normal mt-0.5 truncate max-w-[150px]">
                          {booking.clientWebsite}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 hover:text-indigo-600 font-normal transition-colors">
                            <PhoneIcon className="w-4 h-4 text-gray-300" />
                            {booking.clientPhone}
                        </a>
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
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusPill(booking.status)}</td>
                    <td className="px-6 py-4 whitespace-normal text-xs text-gray-400 max-w-xs leading-snug uppercase tracking-tighter">
                        {booking.bdmNote || booking.notes || <span className="italic opacity-50 font-normal">No notes</span>}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedBookingsList;
