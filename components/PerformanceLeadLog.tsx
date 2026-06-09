import React, { useMemo, useState, useEffect } from 'react';
import type { Booking, BDM } from '../types';
import { getStatusPill, getVendorStatusPill, maskSoldText } from '../utils/statusUtils';
import { formatToDDMMYY } from '../utils/dateUtils';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, MapPinIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';
import { exportBookingsToCSV } from '../utils/exportUtils';

interface PerformanceLeadLogProps {
  bookings: Booking[];
  bdms?: BDM[];
  title?: string;
  hideFilters?: boolean;
  role?: 'manager' | 'vendor' | 'bdm';
}

type SortField = 'date' | 'callingTeam' | 'assignedBDM' | 'status';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const PerformanceLeadLog: React.FC<PerformanceLeadLogProps> = ({ 
  bookings, 
  bdms = [], 
  title = "Global Data Report Log", 
  hideFilters = false,
  role = 'manager'
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [callerFilter, setCallerFilter] = useState<string>('all');
  const [bdmFilter, setBdmFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isVendorRole = role === 'vendor';
  const isBdmRole = role === 'bdm';

  // Mask sold text for vendors
  const mappedBookings = useMemo(() => {
    if (!isVendorRole) return bookings;
    return bookings.map(b => {
      const mapped = b.status === 'sold' ? { ...b, status: 'seen' as const } : b;
      return {
        ...mapped,
        notes: maskSoldText(mapped.notes),
        bdmNote: maskSoldText(mapped.bdmNote)
      };
    });
  }, [bookings, isVendorRole]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, callerFilter, bdmFilter, searchTerm, sortField, sortDirection]);

  // Get unique callers
  const uniqueCallers = useMemo(() => {
    const callers = new Set<string>();
    mappedBookings.forEach(b => {
      if (isVendorRole) {
        const name = b.callerName;
        if (name) callers.add(name);
      } else {
        const name = b.vendor?.name;
        if (name) callers.add(name);
      }
    });
    return Array.from(callers).sort((a, b) => a.localeCompare(b));
  }, [mappedBookings, isVendorRole]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpIcon className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUpIcon className="w-3 h-3 text-indigo-600" />
      : <ArrowDownIcon className="w-3 h-3 text-indigo-600" />;
  };

  // All filtered leads with sorting
  const allFilteredLeads = useMemo(() => {
    const filtered = mappedBookings.filter(b => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      
      let matchesCaller = true;
      if (isVendorRole && callerFilter !== 'all') {
        matchesCaller = (b.callerName || '').toLowerCase() === callerFilter.toLowerCase();
      } else if (!isVendorRole && callerFilter !== 'all') {
        matchesCaller = (b.vendor?.name || '') === callerFilter;
      }
      
      const matchesBdm = isVendorRole || isBdmRole || bdmFilter === 'all' || (b.bdmId?.toString() === bdmFilter);
      
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        b.businessName.toLowerCase().includes(lowerSearch) || 
        b.clientName.toLowerCase().includes(lowerSearch) ||
        b.clientPhone.toLowerCase().includes(lowerSearch) ||
        b.clientWebsite.toLowerCase().includes(lowerSearch) ||
        b.address.toLowerCase().includes(lowerSearch) ||
        (b.notes?.toLowerCase().includes(lowerSearch)) ||
        (b.bdmNote?.toLowerCase().includes(lowerSearch)) ||
        b.date.includes(lowerSearch) ||
        b.time.toLowerCase().includes(lowerSearch) ||
        (b.callerName?.toLowerCase().includes(lowerSearch)) ||
        (b.vendor?.name.toLowerCase().includes(lowerSearch))
      );

      return matchesStatus && matchesCaller && matchesBdm && matchesSearch;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          // Sort by creation date
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
          comparison = timeA - timeB;
          break;
        case 'callingTeam':
          const teamA = (isVendorRole ? a.callerName : a.vendor?.name) || '';
          const teamB = (isVendorRole ? b.callerName : b.vendor?.name) || '';
          comparison = teamA.localeCompare(teamB);
          break;
        case 'assignedBDM':
          const bdmA = bdms.find(bdm => bdm.id === a.bdmId)?.name || '';
          const bdmB = bdms.find(bdm => bdm.id === b.bdmId)?.name || '';
          comparison = bdmA.localeCompare(bdmB);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [mappedBookings, statusFilter, callerFilter, bdmFilter, searchTerm, isVendorRole, isBdmRole, sortField, sortDirection, bdms]);

  const totalPages = Math.max(1, Math.ceil(allFilteredLeads.length / ITEMS_PER_PAGE));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allFilteredLeads.slice(start, start + ITEMS_PER_PAGE);
  }, [allFilteredLeads, currentPage]);

  const handleExport = () => {
    exportBookingsToCSV(allFilteredLeads, 'performance_log_report');
  };

  const getHistoryBadge = (lead: Booking) => {
      if (lead.status === 'rescheduled_bdm') {
          return <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded font-black text-[9px] uppercase tracking-tighter">BDM Reschedule</span>;
      }
      if (lead.isDuplicate && (new Date(lead.date) >= new Date(new Date().setFullYear(new Date().getFullYear() - 1)))) {
          return <span className="px-2 py-1 bg-red-100 text-red-600 rounded font-black text-[9px] uppercase tracking-tighter">Duplicate Lead</span>;
      }
      if (lead.customReason?.toLowerCase().includes('manual') || lead.customReason?.toLowerCase().includes('request')) {
          return <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded font-black text-[9px] uppercase tracking-tighter">Rebooked/Manual</span>;
      }
      return <span className="px-2 py-1 bg-green-100 text-green-600 rounded font-black text-[9px] uppercase tracking-tighter">Fresh Lead</span>;
  };

  const getSourceDisplay = (lead: Booking) => {
      if (isVendorRole) {
          return (
              <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">{lead.callerName || 'Unknown'}</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">INDIVIDUAL CALLER</span>
              </div>
          );
      }
      const isInternal = lead.vendor?.username === 'internal' || lead.vendor?.username === 'manual';
      const teamName = lead.vendor?.name || 'Internal';
      const subText = isInternal ? 'INTERNAL / SELF-GEN' : 'VENDOR TEAM';
      
      return (
          <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-700">{teamName}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{subText}</span>
          </div>
      );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-8 shadow-sm">
      <div className="p-8 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            {isVendorRole ? 'Detailed breakdown of leads you have booked' : 'Detailed breakdown of your filtered leads & history'}
          </p>
        </div>
        
        {!hideFilters && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search leads, phones, notes..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none w-full md:w-64 font-medium bg-gray-50/30"
              />
            </div>

            {/* Caller Filter - Hide for vendors */}
            {!isVendorRole && uniqueCallers.length > 0 && (
              <select 
                value={callerFilter}
                onChange={(e) => setCallerFilter(e.target.value)}
                className="border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
              >
                <option value="all">All Calling Teams</option>
                {uniqueCallers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            {/* BDM Filter - Hide for vendors and BDMs */}
            {!isVendorRole && !isBdmRole && (
              <select 
                value={bdmFilter}
                onChange={(e) => setBdmFilter(e.target.value)}
                className="border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
              >
                <option value="all">All BDMs</option>
                {bdms.map(bdm => (
                  <option key={bdm.id} value={bdm.id.toString()}>{bdm.name}</option>
                ))}
              </select>
            )}

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              {!isVendorRole && <option value="sold">Sold</option>}
              <option value="seen">Seen</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="rescheduled_bdm">BDM Reschedule</option>
              <option value="rejected">{isVendorRole ? 'Declined' : 'Rejected'}</option>
              <option value="dq">DQ</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-[#10B981] text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-600 transition-all active:scale-95 uppercase tracking-widest"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> Export
            </button>
          </div>
        )}
      </div>

      {/* Desktop Table View with Sortable Headers */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              {/* Date Column - Sortable */}
              <th 
                scope="col" 
                className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:text-gray-600 transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon field="date" />
                </div>
              </th>
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Business, Client & URL</th>
              <th scope="col" className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Lead History & Source</th>
              {/* Calling Team Column - Sortable */}
              <th 
                scope="col" 
                className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:text-gray-600 transition-colors"
                onClick={() => handleSort('callingTeam')}
              >
                <div className="flex items-center gap-1">
                  {isVendorRole ? 'Individual Caller' : 'Calling Team / Source'}
                  <SortIcon field="callingTeam" />
                </div>
              </th>
              {/* Assigned BDM Column - Sortable (only for managers) */}
              {!isVendorRole && !isBdmRole && (
                <th 
                  scope="col" 
                  className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:text-gray-600 transition-colors"
                  onClick={() => handleSort('assignedBDM')}
                >
                  <div className="flex items-center gap-1">
                    Assigned BDM
                    <SortIcon field="assignedBDM" />
                  </div>
                </th>
              )}
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Region</th>
              {/* Status Column - Sortable */}
              <th 
                scope="col" 
                className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:text-gray-600 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginatedLeads.length > 0 ? paginatedLeads.map((lead) => {
              const bdm = bdms.find(b => b.id === lead.bdmId);
              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-6 whitespace-nowrap text-sm font-medium text-gray-500">
                    {formatToDDMMYY(lead.date)}
                    {lead.createdAt && (
                      <div className="text-[9px] text-gray-300 mt-0.5">
                        Created: {formatToDDMMYY(lead.createdAt)}
                      </div>
                    )}
                   </td>
                  <td className="px-6 py-6 whitespace-normal">
                    <div className="text-base font-bold text-gray-900 leading-tight">{lead.businessName}</div>
                    <div className="text-xs font-medium text-gray-500">{lead.clientName}</div>
                    <div className="flex flex-col gap-1 mt-1">
                      {lead.clientWebsite && (
                          <a 
                              href={lead.clientWebsite.startsWith('http') ? lead.clientWebsite : `https://${lead.clientWebsite}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs text-blue-500 hover:underline transition-colors block"
                          >
                              {lead.clientWebsite}
                          </a>
                      )}
                      {lead.address && (
                        <div className="flex items-start gap-1.5 max-w-[200px]">
                          <MapPinIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium leading-tight break-words transition-colors"
                          >
                            {lead.address}
                          </a>
                        </div>
                      )}
                    </div>
                   </td>
                  <td className="px-6 py-6 whitespace-nowrap text-center">
                    {getHistoryBadge(lead)}
                   </td>
                  <td className="px-6 py-6 whitespace-nowrap">
                    {getSourceDisplay(lead)}
                   </td>
                  {!isVendorRole && !isBdmRole && (
                    <td className="px-6 py-6 whitespace-nowrap">
                      {bdm ? (
                          <span className="text-sm font-bold text-gray-700">{bdm.name}</span>
                      ) : (
                          <span className="text-sm font-medium text-gray-300 italic">Unassigned</span>
                      )}
                     </td>
                  )}
                  <td className="px-6 py-6 whitespace-nowrap">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{lead.region}</span>
                   </td>
                  <td className="px-6 py-6 whitespace-nowrap">
                    {isVendorRole ? getVendorStatusPill(lead.status) : getStatusPill(lead.status)}
                   </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={isVendorRole ? 6 : (isBdmRole ? 6 : 7)} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <MagnifyingGlassIcon className="w-12 h-12 text-gray-100" />
                    <p className="text-gray-400 font-bold italic">No records found matching your search criteria.</p>
                  </div>
                 </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginatedLeads.length > 0 ? paginatedLeads.map((lead) => {
          const bdm = bdms.find(b => b.id === lead.bdmId);
          return (
            <div key={lead.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-gray-900 truncate">{lead.businessName}</h4>
                  <p className="text-xs text-gray-500">{lead.clientName}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isVendorRole ? getVendorStatusPill(lead.status) : getStatusPill(lead.status)}
                  <span className="text-[10px] font-black text-gray-400 uppercase">
                    {formatToDDMMYY(lead.date)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {getHistoryBadge(lead)}
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded font-black text-[9px] uppercase tracking-tighter">
                  {lead.region}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Source</p>
                  {getSourceDisplay(lead)}
                </div>
                {!isVendorRole && !isBdmRole && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Assigned BDM</p>
                    <p className="font-bold text-gray-700">{bdm ? bdm.name : 'Unassigned'}</p>
                  </div>
                )}
              </div>

              {lead.clientWebsite && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Website</p>
                  <a 
                    href={lead.clientWebsite.startsWith('http') ? lead.clientWebsite : `https://${lead.clientWebsite}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-blue-500 hover:underline break-all"
                  >
                    {lead.clientWebsite}
                  </a>
                </div>
              )}

              {lead.address && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Address</p>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline flex items-start gap-1.5"
                  >
                    <MapPinIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {lead.address}
                  </a>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="p-12 text-center">
            <MagnifyingGlassIcon className="w-10 h-10 text-gray-100 mx-auto mb-3" />
            <p className="text-gray-400 font-bold italic text-sm">No records found matching your search criteria.</p>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest order-2 sm:order-1">
          Showing {allFilteredLeads.length > 0 ? Math.min(allFilteredLeads.length, (currentPage - 1) * ITEMS_PER_PAGE + 1) : 0} to {Math.min(allFilteredLeads.length, currentPage * ITEMS_PER_PAGE)} of {allFilteredLeads.length} total leads
        </span>
        <div className="flex items-center gap-2 order-1 sm:order-2">
            <button 
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                First
            </button>
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Prev
            </button>
            <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    let p: number;
                    if (totalPages <= 5) {
                        p = i + 1;
                    } else if (currentPage <= 3) {
                        p = i + 1;
                        if (i === 4) return <span key="end-ellipsis" className="px-1 text-gray-400">...</span>;
                    } else if (currentPage >= totalPages - 2) {
                        p = totalPages - 4 + i;
                        if (i === 0) return <span key="start-ellipsis" className="px-1 text-gray-400">...</span>;
                    } else {
                        if (i === 0) return <span key="start-ellipsis" className="px-1 text-gray-400">...</span>;
                        if (i === 4) return <span key="end-ellipsis" className="px-1 text-gray-400">...</span>;
                        p = currentPage - 2 + i;
                    }
                    return (
                        <button 
                            key={p} 
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 text-xs font-bold rounded-md transition-all ${currentPage === p ? 'bg-black text-white' : 'border hover:bg-gray-100'}`}
                        >
                            {p}
                        </button>
                    );
                })}
            </div>
            <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
            <button 
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Last
            </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceLeadLog;
