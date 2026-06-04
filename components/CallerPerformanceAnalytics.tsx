import React, { useMemo, useState } from 'react';
import type { Booking } from '../types';

interface CallerPerformanceAnalyticsProps {
  bookings: Booking[];
}

// List of values that should NOT appear as caller names
const INVALID_CALLER_VALUES = new Set([
  'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt',
  'active', 'seen', 'sold', 'rejected', 'cancelled', 'rescheduled', 'dq', 'pending_approval', 'rescheduled_bdm',
  'caller', 'name', 'team', 'region', 'status', 'lead', 'booking'
]);

const ITEMS_PER_PAGE = 5;

const CallerPerformanceAnalytics: React.FC<CallerPerformanceAnalyticsProps> = ({ bookings }) => {
    const [currentPage, setCurrentPage] = useState(1);

    const analytics = useMemo(() => {
        // Track both count and the latest activity timestamp for each caller
        // Use case-insensitive grouping (store by lowercase key, but keep original case for display)
        const callersMap = bookings.reduce((acc, booking) => {
            if (!booking.callerName) return acc;
            
            const rawName = booking.callerName.trim();
            const normalizedKey = rawName.toLowerCase(); // Normalize to lowercase for grouping
            
            // Skip invalid caller names (empty, regions, statuses, etc.)
            if (!rawName || rawName.length === 0) return acc;
            if (INVALID_CALLER_VALUES.has(normalizedKey)) return acc;
            if (rawName.length < 2) return acc;
            
            if (!acc[normalizedKey]) {
                acc[normalizedKey] = { 
                    count: 0, 
                    lastActive: 0,
                    displayName: rawName  // Keep original case for display
                };
            }
            acc[normalizedKey].count += 1;
            acc[normalizedKey].lastActive = Math.max(acc[normalizedKey].lastActive, booking.id);
            return acc;
        }, {} as Record<string, { count: number, lastActive: number, displayName: string }>);
    
        // Sort by count (highest first) then by name
        const sortedCallers = Object.entries(callersMap)
            .sort(([, a], [, b]) => {
                // Sort by count descending first
                if (a.count !== b.count) return b.count - a.count;
                // Then alphabetically by name (case-insensitive)
                return a.displayName.localeCompare(b.displayName);
            })
            .map(([, data]) => ({ 
                name: data.displayName,
                count: data.count,
                lastActive: data.lastActive 
            }));
    
        const maxCallerBookings = sortedCallers.length > 0 
            ? Math.max(...sortedCallers.map(c => c.count)) 
            : 0;
    
        return {
            sortedCallers,
            maxCallerBookings
        };
    }, [bookings]);

    const totalPages = Math.max(1, Math.ceil(analytics.sortedCallers.length / ITEMS_PER_PAGE));
    
    // Reset to page 1 when bookings change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [bookings]);

    const paginatedCallers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return analytics.sortedCallers.slice(start, start + ITEMS_PER_PAGE);
    }, [analytics.sortedCallers, currentPage]);

    const totalCallers = analytics.sortedCallers.length;

    if (analytics.sortedCallers.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow h-fit">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Caller</h3>
                <p className="text-center text-sm text-gray-500">No caller performance data available.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow h-fit">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Performance by Caller</h3>
                <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded uppercase tracking-widest">
                    Showing {paginatedCallers.length} of {totalCallers} entries
                </span>
            </div>
            
            <div className="space-y-4">
                {paginatedCallers.map(caller => {
                    const widthPercentage = analytics.maxCallerBookings > 0 
                        ? (caller.count / analytics.maxCallerBookings) * 100 
                        : 0;
                    
                    return (
                        <div key={caller.name.toLowerCase()} className="flex items-center group">
                            <div className="w-1/3 text-sm font-medium text-gray-700 truncate pr-2" title={caller.name}>
                                {caller.name}
                            </div>
                            <div className="w-2/3 flex items-center">
                                <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                        className="bg-green-500 h-5 rounded-full text-white text-xs flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                                        style={{ width: `${widthPercentage}%` }}
                                    >
                                        {caller.count > 0 && (
                                            <span className="font-bold drop-shadow-sm">{caller.count}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Page {currentPage} of {totalPages}
                        </span>
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
        </div>
    );
};

export default CallerPerformanceAnalytics;
