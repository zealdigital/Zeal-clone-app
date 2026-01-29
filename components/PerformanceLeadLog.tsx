
import React, { useMemo, useState } from 'react';
import type { Booking } from '../types';
import { getStatusPill } from '../utils/statusUtils';
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from './Icons';
import { exportBookingsToCSV } from '../utils/exportUtils';

interface PerformanceLeadLogProps {
  bookings: Booking[];
  title?: string;
  hideFilters?: boolean;
}

const PerformanceLeadLog: React.FC<PerformanceLeadLogProps> = ({ bookings, title = "Lead Performance Log", hideFilters = false }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [callerFilter, setCallerFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const uniqueCallers = useMemo(() => {
    const callers = new Set<string>();
    bookings.forEach(b => {
      const name = b.callerName?.trim();
      if (name) {
        callers.add(name);
      } else if (b.vendor?.name) {
        callers.add(b.vendor.name);
      }
    });
    return Array.from(callers).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filteredLeads = useMemo(() => {
    return bookings.filter(b => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const bCaller = b.callerName?.trim() || b.vendor?.name;
      const matchesCaller = callerFilter === 'all' || (bCaller === callerFilter);
      const lowerSearch = searchTerm.toLowerCase();
      
      // SEARCH ACROSS ALL FIELDS (Phone, Website, Address, Business, Client, Caller, Team, Notes)
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

      return matchesStatus && matchesCaller && matchesSearch;
    }).sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id - a.id;
    });
  }, [bookings, statusFilter, callerFilter, searchTerm]);

  const handleExport = () => {
    exportBookingsToCSV(filteredLeads, 'performance_report');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-8 shadow-sm">
      <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            {hideFilters ? `Found ${filteredLeads.length} matches` : 'Cross-team performance insights'}
          </p>
        </div>
        
        {!hideFilters && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search leads..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full md:w-44 font-medium transition-all bg-gray-50/50"
              />
            </div>

            <div className="relative">
              <select 
                value={callerFilter}
                onChange={(e) => setCallerFilter(e.target.value)}
                className="appearance-none border border-gray-200 rounded-xl py-2 pl-3 pr-10 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer min-w-[150px] shadow-sm hover:border-indigo-300"
              >
                <option value="all">👥 All Callers ({uniqueCallers.length})</option>
                {uniqueCallers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>

            <div className="relative">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none border border-gray-200 rounded-xl py-2 pl-3 pr-10 text-sm font-bold bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer min-w-[150px] shadow-sm hover:border-indigo-300"
              >
                <option value="all">⚡ All Statuses</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="seen">Seen</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="rejected">Rejected</option>
                <option value="dq">DQ</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>

            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-95 uppercase tracking-widest"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> Export Report
            </button>
          </div>
        )}
        
        {hideFilters && (
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-gray-800 shadow-md transition-all active:scale-95 uppercase tracking-widest"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> Export Results
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Business & Client</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Caller/Team</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Info</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredLeads.length > 0 ? filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-indigo-50/40 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                  {lead.date}<br/>
                  <span className="text-[10px] text-gray-400 font-normal">{lead.time}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-black text-gray-900 group-hover:text-indigo-900">{lead.businessName}</div>
                  <div className="text-[11px] font-medium text-gray-400">{lead.clientName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                    {lead.callerName || lead.vendor.name}
                  </span>
                  <div className="mt-1 text-[9px] font-black text-gray-400 uppercase">{lead.region}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-[11px] text-gray-500">
                   <div className="font-bold text-gray-700">{lead.clientPhone}</div>
                   <div className="text-indigo-500 truncate max-w-[150px]">{lead.clientWebsite}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusPill(lead.status)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MagnifyingGlassIcon className="w-10 h-10 text-gray-200" />
                    <p className="text-gray-400 font-bold italic">No matching leads found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
          Found {filteredLeads.length} entries
        </span>
      </div>
    </div>
  );
};

export default PerformanceLeadLog;
