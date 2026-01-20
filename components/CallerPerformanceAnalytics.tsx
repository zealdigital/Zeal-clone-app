import React, { useMemo } from 'react';
import type { Booking } from '../types';

interface CallerPerformanceAnalyticsProps {
  bookings: Booking[];
}

const CallerPerformanceAnalytics: React.FC<CallerPerformanceAnalyticsProps> = ({ bookings }) => {
    const analytics = useMemo(() => {
        const bookingsByCaller = bookings.reduce((acc, booking) => {
            if (!booking.callerName) return acc;
            acc[booking.callerName] = (acc[booking.callerName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const sortedCallers = Object.entries(bookingsByCaller)
            // FIX: Explicitly type the destructured array parameters to resolve the type inference error.
            .sort(([, countA]: [string, number], [, countB]: [string, number]) => countB - countA)
            .map(([name, count]) => ({ name, count }));

        const maxCallerBookings = sortedCallers.length > 0 ? sortedCallers[0].count : 0;

        return {
            sortedCallers,
            maxCallerBookings
        };
    }, [bookings]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900">Performance by Caller</h3>
            {analytics.sortedCallers.length === 0 ? (
            <p className="mt-4 text-center text-sm text-gray-500">No caller performance data available.</p>
        ) : (
            <div className="mt-4 space-y-4">
                {analytics.sortedCallers.map(caller => {
                    const widthPercentage = analytics.maxCallerBookings > 0 ? (caller.count / analytics.maxCallerBookings) * 100 : 0;
                    return(
                        <div key={caller.name} className="flex items-center">
                            <p className="w-1/3 text-sm font-medium text-gray-700 truncate pr-2">{caller.name}</p>
                            <div className="w-2/3 flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-5">
                                    <div 
                                        className="bg-green-500 h-5 rounded-full text-white text-xs flex items-center justify-end pr-2 transition-all duration-500"
                                        style={{ width: `${widthPercentage}%` }}
                                    >
                                        {caller.count > 0 && caller.count}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        )}
    </div>
  );
};

export default CallerPerformanceAnalytics;