import React, { useMemo, useState, useEffect } from 'react';
import type { Booking } from '../types';
import { PencilSquareIcon, TrashIcon, ClockIcon, CheckBadgeIcon, PhoneIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon } from './Icons';
import { getStatusPill, getVendorStatusPill } from '../utils/statusUtils';
import ExpandableNote from './ExpandableNote';
import SmsRequestModal from './SmsRequestModal';
import { formatDDMMYY } from '../utils/dateUtils';

interface MyBookingsListProps {
  bookings: Booking[];
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (bookingId: number) => void;
  searchTerm?: string;
  onRequestSms?: (bookingId: number, type: string, message: string) => void;
}

const ITEMS_PER_PAGE = 10;

const MyBookingsList: React.FC<MyBookingsListProps> = ({ bookings, onEditBooking, onDeleteBooking, searchTerm, onRequestSms }) => {
  const [smsModalBooking, setSmsModalBooking] = useState<Booking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
          const today = new Date(); today.setHours(0,0,0,0);
          const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
          const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

          const formatDate = (d: Date) => d.toISOString().split('T')[0];
          const tStr = formatDate(today);
          const tmStr = formatDate(tomorrow);
          const daStr = formatDate(dayAfter);

          const getPriority = (date: string) => {
              if (date === tStr) return 0;
              if (date === tmStr) return 1;
              if (date === daStr) return 2;
              return 3;
          };

          const pA = getPriority(a.date);
          const pB = getPriority(b.date);

          if (pA !== pB) return pA - pB;

          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return b.id - a.id;
      });
  }, [bookings]);

  const totalPages = Math.max(1, Math.ceil(uniqueBookings.length / ITEMS_PER_PAGE));
  const paginatedUniqueBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return uniqueBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [uniqueBookings, currentPage]);

  const groupedBookings = useMemo(() => {
      const groups: Record<string, Booking[]> = {};
      paginatedUniqueBookings.forEach(b => {
          if (!groups[b.date]) groups[b.date] = [];
          groups[b.date].push(b);
      });
      return groups;
  }, [paginatedUniqueBookings]);

  const sortedGroupKeys = useMemo(() => {
      return Object.keys(groupedBookings).sort((a, b) => {
          const today = new Date(); today.setHours(0,0,0,0);
          const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
          const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

          const formatDate = (d: Date) => d.toISOString().split('T')[0];
          const tStr = formatDate(today);
          const tmStr = formatDate(tomorrow);
          const daStr = formatDate(dayAfter);

          const getPriority = (date: string) => {
              if (date === tStr) return 0;
              if (date === tmStr) return 1;
              if (date === daStr) return 2;
              return 3;
          };

          const pA = getPriority(a);
          const pB = getPriority(b);

          if (pA !== pB) return pA - pB;
          return new Date(b).getTime() - new Date(a).getTime();
      });
  }, [groupedBookings]);

  const renderVendorStatus = (booking: Booking) => {
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
    return getVendorStatusPill(booking.status);
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
    <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
                          {onRequestSms && (
                              <button 
                                onClick={() => setSmsModalBooking(booking)} 
                                disabled={booking.smsRequest?.status === 'sent'}
                                className={`flex items-center gap-1 transition-all ${
                                    booking.smsRequest?.status === 'pending'
                                    ? 'p-1.5 bg-orange-100 text-orange-600 rounded-full border border-orange-200'
                                    : booking.smsRequest?.status === 'sent'
                                    ? 'text-green-600 font-bold'
                                    : 'text-gray-400 hover:text-indigo-600'
                                }`}
                                title={booking.smsRequest?.status === 'pending' ? 'SMS Request Pending' : 'Request SMS'}
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                {booking.smsRequest?.status === 'sent' && <span className="text-[10px] uppercase">Sent</span>}
                              </button>
                          )}
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

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {sortedGroupKeys.map(date => (
          <div key={date} className="animate-fadeIn">
            <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 flex items-center gap-2 border-b border-gray-200">
              <CalendarDaysIcon className="w-3.5 h-3.5" />
              {formatDDMMYY(date)}
            </div>
            <div className="divide-y divide-gray-100">
              {groupedBookings[date].map((booking) => (
                <div key={booking.id} className="p-4 space-y-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{booking.businessName}</h4>
                      <p className="text-xs text-gray-500">{booking.clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{booking.region}</span>
                      {renderVendorStatus(booking)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                      {booking.time}
                    </div>
                    <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 text-indigo-600 font-medium">
                      <PhoneIcon className="w-3.5 h-3.5 text-indigo-400" />
                      {booking.clientPhone}
                    </a>
                  </div>

                  {booking.notes && (
                    <div className="bg-gray-50 p-2 rounded text-[11px] text-gray-600 border border-gray-100">
                      <p className="font-bold text-[9px] uppercase text-gray-400 mb-1">Notes</p>
                      <ExpandableNote text={booking.notes} />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[10px] text-gray-400">
                      Caller: <span className="font-bold text-gray-600">{booking.callerName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {onRequestSms && (
                        <button 
                          onClick={() => setSmsModalBooking(booking)} 
                          disabled={booking.smsRequest?.status === 'sent'}
                          className={`flex items-center gap-1 ${
                            booking.smsRequest?.status === 'pending' ? 'text-orange-600' : 
                            booking.smsRequest?.status === 'sent' ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => onEditBooking(booking)} className="text-gray-400 hover:text-indigo-600">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeleteBooking(booking.id)} className="text-gray-400 hover:text-red-600">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {uniqueBookings.length} total records
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

      {smsModalBooking && <SmsRequestModal booking={smsModalBooking} onClose={() => setSmsModalBooking(null)} onSubmit={handleSmsSubmit} />}
    </div>
  );
};

export default MyBookingsList;