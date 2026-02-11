
import React, { useMemo, useState, useEffect } from 'react';
import type { Booking, BDM } from '../types';
import { getStatusPill } from '../utils/statusUtils';
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from './Icons';
import { exportBookingsToCSV } from '../utils/exportUtils';

interface PerformanceLeadLogProps {
  bookings: Booking[];
  bdms?: BDM[];
  title?: string;
  hideFilters?: boolean;
  role?: 'manager' | 'vendor' | 'bdm';
}

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

  const isVendorRole = role === 'vendor';

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, callerFilter, bdmFilter, searchTerm]);

  const uniqueCallers = useMemo(() => {
    const callers = new Set<string>();
    bookings.forEach(b => {
      const name = isVendorRole ? b.callerName : b.vendor?.name;
      if (name) callers.add(name);
    });
    return Array.from(callers).sort((a, b) => a.localeCompare(b));
  }, [bookings, isVendorRole]);

  const allFilteredLeads = useMemo(() => {
    return bookings.filter(b => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const nameToMatch = isVendorRole ? b.callerName : b.vendor?.name;
      const matchesCaller = callerFilter === 'all' || (nameToMatch === callerFilter);
      const matchesBdm = isVendorRole || bdmFilter === 'all' || (b.bdmId?.toString() === bdmFilter);
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
    }).sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id - a.id;
    });
  }, [bookings, statusFilter, callerFilter, bdmFilter, searchTerm, isVendorRole]);

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
      if (lead.isDuplicate) {
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
                  <span className="text-sm font-bold text-gray-700">{lead.callerName}</span>
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
            Detailed breakdown of your filtered leads & history
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

            <select 
              value={callerFilter}
              onChange={(e) => setCallerFilter(e.target.value)}
              className="border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
            >
              <option value="all">{isVendorRole ? 'All Individual Callers' : 'All Calling Teams'}</option>
              {uniqueCallers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {!isVendorRole && (
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
              <option value="sold">Sold</option>
              <option value="seen">Seen</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="rescheduled_bdm">BDM Reschedule</option>
              <option value="rejected">Rejected</option>
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Business, Client & URL</th>
              <th scope="col" className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Lead History & Source</th>
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{isVendorRole ? 'Individual Caller' : 'Calling Team / Source'}</th>
              {!isVendorRole && <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned BDM</th>}
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Region</th>
              <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginatedLeads.length > 0 ? paginatedLeads.map((lead) => {
              const bdm = bdms.find(b => b.id === lead.bdmId);
              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-6 whitespace-nowrap text-sm font-medium text-gray-500">
                    {lead.date}
                  </td>
                  <td className="px-6 py-6 whitespace-nowrap">
                    <div className="text-base font-bold text-gray-900 leading-tight">{lead.businessName}</div>
                    <div className="text-xs font-medium text-gray-500">{lead.clientName}</div>
                    {lead.clientWebsite && (
                        <a 
                            href={lead.clientWebsite.startsWith('http') ? lead.clientWebsite : `https://${lead.clientWebsite}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-blue-500 hover:underline transition-colors block mt-0.5"
                        >
                            {lead.clientWebsite}
                        </a>
                    )}
                  </td>
                  <td className="px-6 py-6 whitespace-nowrap text-center">
                    {getHistoryBadge(lead)}
                  </td>
                  <td className="px-6 py-6 whitespace-nowrap">
                    {getSourceDisplay(lead)}
                  </td>
                  {!isVendorRole && (
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
                    {getStatusPill(lead.status)}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={isVendorRole ? 6 : 7} className="px-6 py-24 text-center">
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
      
      <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest order-2 sm:order-1">
          Showing {Math.min(allFilteredLeads.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} to {Math.min(allFilteredLeads.length, currentPage * ITEMS_PER_PAGE)} of {allFilteredLeads.length} total leads
        </span>
        <div className="flex items-center gap-2 order-1 sm:order-2">
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Prev
            </button>
            <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    if (totalPages > 5 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                        if (Math.abs(p - currentPage) === 3) return <span key={p} className="px-1 text-gray-400">...</span>;
                        return null;
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
        </div>
      </div>
    </div>
  );
};

export default PerformanceLeadLog;
