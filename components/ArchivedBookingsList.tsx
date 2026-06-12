import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Booking, BDM } from '../types';
import { getStatusPill, getVendorStatusPill, maskSoldText } from '../utils/statusUtils';
import { PhoneIcon, CalendarDaysIcon, PencilSquareIcon, MapPinIcon } from './Icons';
import { formatDDMMYY } from '../utils/dateUtils';

interface ArchivedBookingsListProps {
  bookings: Booking[];
  role: 'manager' | 'vendor' | 'bdm';
  searchTerm?: string;
  onEditBooking?: (booking: Booking) => void;
  bdms?: BDM[];
}

type SortField = 'date' | 'bookedBy' | 'assignedBDM' | 'status';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

// Sort icons
const SortAscIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M8 3.5a.5.5 0 01.354.146l3 3a.5.5 0 01-.708.708L8.5 4.707V12.5a.5.5 0 01-1 0V4.707L5.354 7.354a.5.5 0 11-.708-.708l3-3A.5.5 0 018 3.5z" />
  </svg>
);

const SortDescIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M8 12.5a.5.5 0 01-.354-.146l-3-3a.5.5 0 01.708-.708L7.5 11.293V3.5a.5.5 0 011 0v7.793l2.146-2.147a.5.5 0 01.708.708l-3 3A.5.5 0 018 12.5z" />
  </svg>
);

const SortNeutralIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M8 1a.5.5 0 01.354.146l2 2a.5.5 0 01-.708.708L8.5 2.707V5.5a.5.5 0 01-1 0V2.707L6.354 3.854a.5.5 0 11-.708-.708l2-2A.5.5 0 018 1zm0 14a.5.5 0 01-.354-.146l-2-2a.5.5 0 01.708-.708l1.146 1.147V10.5a.5.5 0 011 0v2.793l1.146-1.147a.5.5 0 01.708.708l-2 2A.5.5 0 018 15z" />
  </svg>
);

// Helper to get BDM name from ID
function getBdmName(bdmId: number | undefined, bdms: BDM[] | undefined): string {
  if (!bdmId || !bdms || bdms.length === 0) return '—';
  const found = bdms.find(b => b.id === bdmId);
  return found ? found.name : '—';
}

const ArchivedBookingsList: React.FC<ArchivedBookingsListProps> = ({
  bookings,
  role,
  searchTerm,
  onEditBooking,
  bdms = [],
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isVendorRole = role === 'vendor';
  const isManagerRole = role === 'manager';

  // Debounce page reset
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setCurrentPage(1);
    }, 150);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [searchTerm, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <SortNeutralIcon className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc'
      ? <SortAscIcon className="w-3 h-3 text-indigo-600" />
      : <SortDescIcon className="w-3 h-3 text-indigo-600" />;
  };

  // Sort and paginate bookings
  const sortedAndPaginatedBookings = useMemo(() => {
    // First, sort the bookings based on current sort field
    const sorted = [...bookings].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date': {
          // Sort by creation date (createdAt) or fallback to id
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
          comparison = timeA - timeB;
          break;
        }
        case 'bookedBy': {
          const nameA = a.vendor?.name || '';
          const nameB = b.vendor?.name || '';
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'assignedBDM': {
          const bdmA = getBdmName(a.bdmId, bdms);
          const bdmB = getBdmName(b.bdmId, bdms);
          comparison = bdmA.localeCompare(bdmB);
          break;
        }
        case 'status': {
          comparison = a.status.localeCompare(b.status);
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Then paginate
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = sorted.slice(start, start + ITEMS_PER_PAGE);
    
    // Group by appointment date for display
    const groups: Record<string, Booking[]> = {};
    paginated.forEach(b => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    
    // Keep appointment date keys sorted descending for display
    const sortedDateKeys = Object.keys(groups).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    
    return { groups, sortedDateKeys, total: sorted.length };
  }, [bookings, sortField, sortDirection, currentPage, bdms]);

  const { groups: groupedBookings, sortedDateKeys, total: totalBookings } = sortedAndPaginatedBookings;
  const totalPages = Math.max(1, Math.ceil(totalBookings / ITEMS_PER_PAGE));

  // Column span for empty state
  const managerColCount = onEditBooking ? 9 : 8;
  const otherColCount = onEditBooking ? 7 : 6;
  const colSpan = isManagerRole ? managerColCount : otherColCount;

  if (bookings.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg border border-gray-100">
        <h3 className="text-lg text-gray-700">
          {searchTerm ? 'No Bookings Found' : 'No Archived Bookings'}
        </h3>
        <p className="text-gray-500 mt-1">
          {searchTerm
            ? `Your search for "${searchTerm}" did not match any archived bookings.`
            : 'Completed or cancelled appointments will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Date Column - Sortable */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-gray-700 transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon field="date" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Client & Business</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Phone</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Region</th>

              {/* Booked By Column - Sortable (manager only) */}
              {isManagerRole && (
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('bookedBy')}
                >
                  <div className="flex items-center gap-1">
                    Booked By
                    <SortIcon field="bookedBy" />
                  </div>
                </th>
              )}

              {/* Assigned BDM Column - Sortable (manager only) */}
              {isManagerRole && (
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('assignedBDM')}
                >
                  <div className="flex items-center gap-1">
                    Assigned BDM
                    <SortIcon field="assignedBDM" />
                  </div>
                </th>
              )}

              {/* Status Column - Sortable */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-gray-700 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Note</th>
              {onEditBooking && (
                <th scope="col" className="px-6 py-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {sortedDateKeys.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-12 text-center text-gray-500 italic">
                  No archived bookings matching your criteria.
                </td>
              </tr>
            ) : (
              sortedDateKeys.map(date => (
                <React.Fragment key={date}>
                  {/* Date group header row */}
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <td
                      colSpan={colSpan}
                      className="px-6 py-2 text-sm font-normal text-gray-600 uppercase tracking-tight"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                        {formatDDMMYY(date)}
                      </div>
                    </td>
                  </tr>

                  {groupedBookings[date].map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      {/* Date (creation date) */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {booking.createdAt ? formatDDMMYY(booking.createdAt) : '-'}
                       </td>

                      {/* Client & Business */}
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

                      {/* Phone + Address */}
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

                      {/* Time */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-normal text-gray-900">{booking.time}</div>
                       </td>

                      {/* Region */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 inline-flex text-[10px] font-normal rounded-full bg-gray-100 text-gray-600 uppercase">
                          {booking.region}
                        </span>
                       </td>

                      {/* Booked By (vendor) - manager only */}
                      {isManagerRole && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-normal text-gray-500">
                          {booking.vendor?.name ?? '—'}
                         </td>
                      )}

                      {/* Assigned BDM - manager only */}
                      {isManagerRole && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-normal text-gray-500">
                          {getBdmName(booking.bdmId, bdms)}
                         </td>
                      )}

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isVendorRole ? getVendorStatusPill(booking.status) : getStatusPill(booking.status)}
                       </td>

                      {/* Note */}
                      <td className="px-6 py-4 whitespace-normal text-xs text-gray-400 max-w-xs leading-snug uppercase tracking-tighter font-normal">
                        {(isVendorRole
                          ? maskSoldText(booking.bdmNote || booking.notes)
                          : (booking.bdmNote || booking.notes)
                        ) || <span className="italic opacity-50">No notes</span>}
                       </td>

                      {/* Actions */}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {sortedDateKeys.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 italic">No archived bookings matching your criteria.</p>
          </div>
        ) : (
          sortedDateKeys.map(date => (
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
                        {booking.createdAt && (
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            Created: {formatDDMMYY(booking.createdAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isVendorRole ? getVendorStatusPill(booking.status) : getStatusPill(booking.status)}
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
                        {(isVendorRole
                          ? maskSoldText(booking.bdmNote || booking.notes)
                          : (booking.bdmNote || booking.notes)
                        ) || 'No notes'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      {isManagerRole && (
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          <div>
                            Booked by: <span className="font-bold text-gray-600">{booking.vendor?.name ?? '—'}</span>
                          </div>
                          <div>
                            Assigned BDM: <span className="font-bold text-gray-600">{getBdmName(booking.bdmId, bdms)}</span>
                          </div>
                        </div>
                      )}
                      {onEditBooking && (
                        <button
                          onClick={() => onEditBooking(booking)}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg ml-auto"
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
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {totalBookings} total archived records
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
            <span className="text-xs font-bold text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
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
