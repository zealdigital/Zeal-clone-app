
import React, { useMemo } from 'react';
import type { Booking } from '../types';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface TrendAnalyticsProps {
  bookings: Booking[];
  period: TimePeriod;
}

const TrendAnalytics: React.FC<TrendAnalyticsProps> = ({ bookings, period }) => {
  const trendData = useMemo(() => {
    const groups: Record<string, { active: number, total: number }> = {};
    const now = new Date();

    // Sort bookings by date
    const sortedBookings = [...bookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedBookings.forEach(b => {
        const date = new Date(b.date);
        let key = '';

        if (period === 'daily') {
            // Show last 14 days or selected range if filtered
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (period === 'weekly') {
            // Get start of week (Monday)
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(date.setDate(diff));
            key = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } else if (period === 'monthly') {
            key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
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

  const keys = Object.keys(trendData);
  // If too many data points, slice for display (e.g. last 12 months) if not explicitly filtered? 
  // For now, we trust the parent filter or show all.
  
  const maxTotal = Math.max(...Object.values(trendData).map((d: { active: number; total: number }) => d.total), 1);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">{period} Booking Trends</h3>
        
        {keys.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No booking data available for this period.</p>
        ) : (
            <div className="space-y-4">
                <div className="flex justify-between text-xs text-gray-500 border-b pb-2 mb-2">
                    <span>Period</span>
                    <span>Volume</span>
                </div>
                <div className="space-y-6">
                    {keys.map(key => {
                        const data = trendData[key];
                        const totalPercent = (data.total / maxTotal) * 100;
                        const activePercent = (data.active / data.total) * 100;

                        return (
                            <div key={key} className="group">
                                <div className="flex justify-between text-sm font-medium mb-1">
                                    <span className="text-gray-700">{key}</span>
                                    <div className="flex gap-3 text-xs">
                                        <span className="text-indigo-600">{data.total} Total</span>
                                        <span className="text-green-600">{data.active} Active/Seen</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                    {/* Total Volume Bar */}
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-indigo-200 rounded-full transition-all duration-500"
                                        style={{ width: `${totalPercent}%` }}
                                    ></div>
                                    {/* Quality/Active Portion overlay */}
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full opacity-80 transition-all duration-500"
                                        style={{ width: `${(data.active / maxTotal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
    </div>
  );
};

export default TrendAnalytics;
