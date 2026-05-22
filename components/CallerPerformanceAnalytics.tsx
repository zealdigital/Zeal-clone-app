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

const CallerPerformanceAnalytics: React.FC<CallerPerformanceAnalyticsProps> = ({ bookings }) => {
    const [showAll, setShowAll] = useState(false);

    const analytics = useMemo(() => {
        // Track both count and the latest activity timestamp for each caller
        const callersMap = bookings.reduce((acc, booking) => {
            if (!booking.callerName) return acc;
            
            const rawName = booking.callerName.trim();
            const normalizedKey = rawName.toLowerCase();
            
            // Skip invalid caller names (empty, regions, statuses, etc.)
            if (!rawName || rawName.length === 0) return acc;
            if (INVALID_CALLER_VALUES.has(normalizedKey)) return acc;
            // Also skip if it's just whitespace or single character
            if (rawName.length < 2) return acc;
            
            if (!acc[normalizedKey]) {
                acc[normalizedKey] = { 
                    count: 0, 
                    lastActive: 0,
                    displayName: rawName
                };
            }
            acc[normalizedKey].count += 1;
            acc[normalizedKey].lastActive = Math.max(acc[normalizedKey].lastActive, booking.id);
            return acc;
        }, {} as Record<string, { count: number, lastActive: number, displayName: string }>);
    
        // Sort by lastActive (most recent activity at the top)
        const sortedCallers = Object.entries(callersMap)
            .sort(([, a], [, b]) => b.lastActive - a.lastActive)
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

    const displayedCallers = showAll 
        ? analytics.sortedCallers 
        : analytics.sortedCallers.slice(0, 10);

    const hasMore = analytics.sortedCallers.length > 10;

    return (
        <div className="bg-white p-6 rounded-lg shadow h-fit">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Performance by Caller</h3>
                {!showAll && hasMore && (
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        Showing Top 10
                    </span>
                )}
            </div>
            
            {analytics.sortedCallers.length === 0 ? (
                <p className="mt-4 text-center text-sm text-gray-500">No caller performance data available.</p>
            ) : (
                <div className="space-y-4">
                    {displayedCallers.map(caller => {
                        const widthPercentage = analytics.maxCallerBookings > 0 
                            ? (caller.count / analytics.maxCallerBookings) * 100 
                            : 0;
                        
                        return (
                            <div key={caller.name} className="flex items-center group">
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

                    {hasMore && (
                        <div className="pt-2 border-t border-gray-50 mt-4 text-center">
                            <button 
                                onClick={() => setShowAll(!showAll)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center justify-center gap-1 mx-auto py-1"
                            >
                                {showAll ? (
                                    <>Show Less <span className="text-lg leading-none">▴</span></>
                                ) : (
                                    <>Show All {analytics.sortedCallers.length} Callers <span className="text-lg leading-none">▾</span></>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CallerPerformanceAnalytics;
