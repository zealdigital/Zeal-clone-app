
import React, { useMemo, useState } from 'react';
import type { Booking } from '../types';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface TrendAnalyticsProps {
  bookings: Booking[];
  period: TimePeriod;
}

const ITEMS_PER_PAGE = 10;

const TrendAnalytics: React.FC<TrendAnalyticsProps> = ({ bookings, period }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const trendData = useMemo(() => {
    const groups: Record<string, { active: number, total: number }> = {};
    
    // Filter out invalid dates and blockers
    const validBookings = bookings.filter(b => {
        if (!b.date || b.isBlocker) return false;
        const d = new Date(b.date);
        return !isNaN(d.getTime());
    });

    // Sort bookings by date
    const sortedBookings = [...validBookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedBookings.forEach(b => {
        const date = new Date(b.date);
        let key = '';

        if (period === 'daily') {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else if (period === 'weekly') {
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setDate(diff));
            key = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (period === 'monthly') {
            key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else if (period === 'yearly') {
            key = date.getFullYear().toString();
        }

        if (!groups[key]) groups[key] = { active: 0, total: 0 };
        groups[key].total += 1;
        if (['active', 'seen', 'sold'].includes(b.status)) {
            groups[key].active += 1;
        }
    });

    return groups;
  }, [bookings, period]);

  const allKeys = useMemo(() => {
    return Object.keys(trendData).sort((a, b) => {
        let dateA: Date;
        let dateB: Date;

        if (period === 'daily') {
            dateA = new Date(a);
            dateB = new Date(b);
        } else if (period === 'weekly') {
            dateA = new Date(a.replace('Week of ', ''));
            dateB = new Date(b.replace('Week of ', ''));
        } else if (period === 'monthly' || period === 'yearly') {
            dateA = new Date(a);
            dateB = new Date(b);
        } else {
            dateA = new Date(a);
            dateB = new Date(b);
        }
        return dateA.getTime() - dateB.getTime();
    });
  }, [trendData, period]);

  const totalPages = Math.max(1, Math.ceil(allKeys.length / ITEMS_PER_PAGE));
  
  // Reset to page 1 if period changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  const paginatedKeys = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allKeys.slice(start, start + ITEMS_PER_PAGE);
  }, [allKeys, currentPage]);

  const maxTotal = Math.max(...Object.values(trendData).map((d: { active: number; total: number }) => d.total), 1);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 capitalize">{period} Booking Trends</h3>
            <span className="text-[10px] font-black text-gray-400 capitalize bg-gray-50 px-2 py-1 rounded">Total Periods: {allKeys.length}</span>
        </div>
        
        {allKeys.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No booking data available for this period.</p>
        ) : (
            <div className="space-y-4">
                <div className="flex justify-between text-xs text-gray-500 border-b pb-2 mb-2">
                    <span>Period</span>
                    <span>Volume</span>
                </div>
                <div className="space-y-6">
                    {paginatedKeys.map(key => {
                        const data = trendData[key];
                        const totalPercent = (data.total / maxTotal) * 100;

                        return (
                            <div key={key} className="group">
                                <div className="flex justify-between text-sm font-medium mb-1">
                                    <span className="text-gray-700">{key}</span>
                                    <div className="flex gap-3 text-xs">
                                        <span className="text-indigo-600 font-bold">{data.total} Total</span>
                                        <span className="text-green-600 font-bold">{data.active} Active/Seen</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-indigo-200 rounded-full transition-all duration-500"
                                        style={{ width: `${totalPercent}%` }}
                                    ></div>
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full opacity-80 transition-all duration-500"
                                        style={{ width: `${(data.active / maxTotal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="mt-8 pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Showing {paginatedKeys.length} of {allKeys.length} entries</span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(1)} 
                                disabled={currentPage === 1} 
                                className="px-3 py-1 text-[10px] font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white uppercase"
                            >
                                First
                            </button>
                            <button 
                                onClick={() => setCurrentPage(curr => Math.max(1, curr - 1))} 
                                disabled={currentPage === 1} 
                                className="px-3 py-1 text-[10px] font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white uppercase"
                            >
                                Prev
                            </button>
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Page {currentPage} of {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(curr => Math.min(totalPages, curr + 1))} 
                                disabled={currentPage === totalPages} 
                                className="px-3 py-1 text-[10px] font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white uppercase"
                            >
                                Next
                            </button>
                            <button 
                                onClick={() => setCurrentPage(totalPages)} 
                                disabled={currentPage === totalPages} 
                                className="px-3 py-1 text-[10px] font-bold border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white uppercase"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default TrendAnalytics;
