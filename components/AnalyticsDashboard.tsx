
import React, { useMemo } from 'react';
import type { Booking } from '../types';
import { ChartBarIcon } from './Icons';
import { REGIONS } from '../constants';

interface AnalyticsDashboardProps {
  bookings: Booking[];
  isManager?: boolean;
}

const StatCard: React.FC<{ title: string; value: string | number, icon?: React.ReactNode, colorClass?: string }> = ({ title, value, icon, colorClass = "text-indigo-600" }) => (
    <div className="bg-white p-5 rounded-lg shadow transition-all">
        <div className="flex justify-between items-start">
            <h4 className="text-sm font-medium text-gray-500 truncate">{title}</h4>
            {icon}
        </div>
        <div className="mt-1 flex items-baseline">
            <p className={`text-3xl font-semibold ${colorClass}`}>{value}</p>
        </div>
    </div>
);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ bookings }) => {
    const analytics = useMemo(() => {
        const totalBookings = bookings.length;

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const bookingsThisMonth = bookings.filter(b => b.date >= firstDayOfMonth).length;

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const bookingsByDay: { [key: string]: number } = { 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0 };
        
        bookings.forEach(b => {
            if (!b.date) return;
            const d = new Date(b.date + 'T00:00:00Z');
            if (isNaN(d.getTime())) return;
            const dayIndex = d.getUTCDay();
            bookingsByDay[dayNames[dayIndex]]++;
        });
        const totalValid = Object.values(bookingsByDay).reduce((acc, count) => acc + count, 0);
        const busiestDay = totalValid > 0 ? Object.entries(bookingsByDay).reduce((a, b) => (b[1] > a[1] ? b : a), ['N/A', 0])[0] : 'N/A';

        const bookingsByRegion = REGIONS.reduce((acc, region) => {
            acc[region] = bookings.filter(b => b.region === region).length;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalBookings,
            bookingsThisMonth,
            busiestDay: busiestDay || 'N/A',
            bookingsByRegion
        };
    }, [bookings]);

    return (
        <div>
             <div className="flex items-center gap-3 mb-6">
                <ChartBarIcon className="h-8 w-8 text-gray-700" />
                <h1 className="text-3xl font-bold text-gray-800">Global Analytics</h1>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Database Leads" value={analytics.totalBookings} />
                <StatCard title="Leads This Month" value={analytics.bookingsThisMonth} />
                <StatCard title="Peak Calling Day" value={analytics.busiestDay} />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900">Leads by Region</h3>
                    {bookings.length === 0 ? (
                        <p className="mt-4 text-center text-sm text-gray-500">No booking data available to display.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {Object.entries(analytics.bookingsByRegion).map(([region, count]: [string, number]) => {
                                const percentage = analytics.totalBookings > 0 ? (count / analytics.totalBookings) * 100 : 0;
                                return (
                                    <div key={region}>
                                        <div className="flex justify-between text-sm font-medium text-gray-700">
                                            <span>{region}</span>
                                            <span>{count}</span>
                                        </div>
                                        <div className="mt-1 bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className={`h-2.5 rounded-full ${region === 'NSW' ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
