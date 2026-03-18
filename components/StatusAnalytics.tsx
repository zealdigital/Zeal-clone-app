import React, { useMemo } from 'react';
import type { Booking } from '../types';
import { getStatusPill, getVendorStatusPill } from '../utils/statusUtils';

interface StatusAnalyticsProps {
  bookings: Booking[];
  title: string;
  role?: 'manager' | 'vendor' | 'bdm';
}

const ALL_STATUSES: Booking['status'][] = ['active', 'sold', 'seen', 'rescheduled', 'rescheduled_bdm', 'cancelled', 'dq', 'rejected'];

const StatusAnalytics: React.FC<StatusAnalyticsProps> = ({ bookings, title, role }) => {
    const isVendorRole = role === 'vendor';
    const analytics = useMemo(() => {
        if (!bookings) return { statusBreakdown: {}, maxCount: 1, total: 0 };

        const statusBreakdown = ALL_STATUSES.reduce((acc, status) => {
            acc[status] = bookings.filter(b => b.status === status).length;
            return acc;
        }, {} as Record<Booking['status'], number>);

        const maxCount = Math.max(...Object.values(statusBreakdown), 1); // Use 1 as minimum to avoid division by zero
        const total = bookings.length;

        return { statusBreakdown, maxCount, total };
    }, [bookings]);

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {analytics.total === 0 ? (
                <p className="mt-4 text-center text-sm text-gray-500">No data available to display.</p>
            ) : (
                <div className="mt-4 space-y-4">
                    {ALL_STATUSES.map(status => {
                        const count = analytics.statusBreakdown[status];
                        if (count === 0) return null; // Don't show statuses with zero bookings
                        
                        const widthPercentage = analytics.maxCount > 0 ? (count / analytics.maxCount) * 100 : 0;
                        return (
                            <div key={status} className="flex flex-col sm:flex-row sm:items-center">
                                <div className="w-full sm:w-1/3 text-sm font-medium text-gray-700 truncate pr-2 flex items-center mb-1 sm:mb-0">
                                    {isVendorRole ? getVendorStatusPill(status) : getStatusPill(status)}
                                </div>
                                <div className="w-full sm:w-2/3 flex items-center">
                                    <div className="w-full bg-gray-200 rounded-full h-5">
                                        <div 
                                            className="bg-indigo-500 h-5 rounded-full text-white text-xs font-bold flex items-center justify-end pr-2 transition-all duration-500"
                                            style={{ width: `${widthPercentage}%` }}
                                        >
                                           {count > 0 && count}
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

export default StatusAnalytics;