
import React, { useMemo, useState } from 'react';
import type { Booking } from '../types';
import { PencilSquareIcon, TrashIcon, ClockIcon, CheckBadgeIcon, PhoneIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon } from './Icons';
import { getStatusPill } from '../utils/statusUtils';
import ExpandableNote from './ExpandableNote';
import SmsRequestModal from './SmsRequestModal';

interface MyBookingsListProps {
  bookings: Booking[];
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (bookingId: number) => void;
  searchTerm?: string;
  onRequestSms?: (bookingId: number, type: string, message: string) => void;
}

const MyBookingsList: React.FC<MyBookingsListProps> = ({ bookings, onEditBooking, onDeleteBooking, searchTerm, onRequestSms }) => {
  const [smsModalBooking, setSmsModalBooking] = useState<Booking | null>(null);

  const uniqueBookings = useMemo(() => {
      const nonBlockers = bookings.filter(b => !b.isBlocker);
      const grouped = nonBlockers.reduce((acc, booking) => {
          const key = `${booking.businessName.trim().toLowerCase()}|${booking.date}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(booking);
          return acc;
      }, {} as Record<string, Booking[]>);

      const displayList: Booking[] = [];
      Object.values(grouped).forEach((group: Booking[]) => {
          if (group.length === 1) displayList.push(group[0]);
          else {
              const sortedGroup = group.sort((a, b) => b.id - a.id);
              displayList.push(sortedGroup[0]);
          }
      });

      return displayList.sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return b.id - a.id;
      });
  }, [bookings]);

  const groupedBookings = useMemo(() => {
      const groups: Record<string, Booking[]> = {};
      uniqueBookings.forEach(b => {
          if (!groups[b.date]) groups[b.date] = [];
          groups[b.date].push(b);
      });
      return groups;
  }, [uniqueBookings]);

  const sortedGroupKeys = useMemo(() => {
      return Object.keys(groupedBookings).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedBookings]);

  const renderVendorStatus = (booking: Booking) => {
    if (booking.status === 'sold') return getStatusPill('seen');
    if (booking.status === 'pending_approval') {
        return (
            <span className="px-2 inline-flex items-center gap-1 text-xs leading-5 font-normal rounded-full whitespace-nowrap bg-purple-100 text-purple-800 border border-purple-200">
                <ClockIcon className="w-3 h-3 pointer-events-none" />
                Rebooking Request Sent
            </span>
        );
    }
    if (booking.status === 'active' && booking.customReason === 'BDM Requested Booking') {
        return (
            <span className="px-2 inline-flex items-center gap-1 text-xs leading-5 font-normal rounded-full whitespace-nowrap bg-teal-100 text-teal-800 border border-teal-200">
                <CheckBadgeIcon className="w-3 h-3 pointer-events-none" />
                Approved by Managers
            </span>
        );
    }
    return getStatusPill(booking.status);
  };

  const handleSmsSubmit = (bookingId: number, type: string, message: string) => {
      if (onRequestSms) onRequestSms(bookingId, type, message);
      setSmsModalBooking(null);
  };

  if (uniqueBookings.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg mt-4">
        <h3 className="text-lg font-normal text-gray-700">{searchTerm ? 'No Bookings Found' : 'Your Bookings Will Appear Here'}</h3>
        <p className="text-gray-500 mt-1 font-normal">
          {searchTerm ? `Your search for "${searchTerm}" did not match.` : 'Start booking appointments to see them here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Client & Business</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Phone</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Caller</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Region</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Notes</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Status & Lead Cycle</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-400 uppercase tracking-wider">Address</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedGroupKeys.map(date => (
              <React.Fragment key={date}>
                <tr className="bg-gray-50 border-y border-gray-200">
                    <td colSpan={9} className="px-6 py-2 text-sm font-normal text-gray-600">
                        <div className="flex items-center gap-2">
                            <CalendarDaysIcon className="w-4 h-4 text-gray-400"/>
                            {new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </td>
                </tr>
                {groupedBookings[date].map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-normal text-gray-900 leading-tight">{booking.businessName}</div>
                        <div className="text-xs font-normal text-gray-500">{booking.clientName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 hover:text-indigo-600 font-normal transition-colors">
                              <PhoneIcon className="w-4 h-4 text-gray-300" />
                              {booking.clientPhone}
                          </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-normal">{booking.callerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-normal text-gray-900">{booking.time}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 inline-flex text-[10px] font-normal rounded-full bg-gray-100 text-gray-600 uppercase">
                          {booking.region}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-xs text-gray-400 max-w-xs leading-snug uppercase tracking-tighter font-normal">
                          <ExpandableNote text={booking.notes} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderVendorStatus(booking)}
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-xs text-gray-500 max-w-xs leading-snug font-normal">
                        {booking.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-normal">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => onEditBooking(booking)} className="text-gray-400 hover:text-indigo-900"><PencilSquareIcon className="w-4 h-4" /></button>
                          <button onClick={() => onDeleteBooking(booking.id)} className="text-gray-400 hover:text-red-900"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {smsModalBooking && <SmsRequestModal booking={smsModalBooking} onClose={() => setSmsModalBooking(null)} onSubmit={handleSmsSubmit} />}
    </div>
  );
};

export default MyBookingsList;
