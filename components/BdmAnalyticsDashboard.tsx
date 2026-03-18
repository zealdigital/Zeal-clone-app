import React, { useMemo } from 'react';
import type { Booking } from '../types';
import { ChartBarIcon } from './Icons';
import { getStatusPill } from '../utils/statusUtils';

interface BdmAnalyticsDashboardProps {
  bookings: Booking[];
}

// Local StatCard to keep component self-contained
const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-white p-5 rounded-lg shadow">
        <h4 className="text-sm font-medium text-gray-500 truncate">{title}</h4>
        <div className="mt-1">
            <p className="text-3xl font-semibold text-indigo-600">{value}</p>
        </div>
    </div>
);

const statusOrder: Booking['status'][] = ['sold', 'seen', 'rescheduled_bdm', 'rescheduled', 'cancelled', 'dq'];

const BdmAnalyticsDashboard: React.FC<BdmAnalyticsDashboardProps> = ({ bookings }) => {
    const analytics = useMemo(() => {
        const totalAssigned = bookings.length;
        const activeAppointments = bookings.filter(b => b.status === 'active').length;
        
        const actionedBookings = bookings.filter(b => statusOrder.includes(b.status));
        const totalActioned = actionedBookings.length;

        const statusBreakdown = statusOrder.reduce((acc, status) => {
            acc[status] = actionedBookings.filter(b => b.status === status).length;
            return acc;
        }, {} as Record<typeof statusOrder[number], number>);

        const maxCount = Math.max(...Object.values(statusBreakdown), 1); // Use 1 as minimum to avoid division by zero

        return {
            totalAssigned,
            activeAppointments,
            totalActioned,
            statusBreakdown,
            maxCount
        };
    }, [bookings]);

    // FIX: Add missing 'active', 'rejected' and 'pending_approval' properties to satisfy the Record<Booking['status'], string> type.
    const statusLabels: Record<Booking['status'], string> = {
        sold: 'Sold - Sale Confirmed',
        seen: 'Seen - Met with Prospect',
        rescheduled_bdm: 'Rescheduled (BDM)',
        rescheduled: 'Rescheduled (General)',
        cancelled: 'Cancelled by Prospect',
        dq: 'DQ - Disqualified',
        active: 'Active',
        rejected: 'Rejected',
        pending_approval: 'Pending Approval',
    };

    return (
        <div className="mb-8">
             <div className="flex items-center gap-3 mb-6">
                <ChartBarIcon className="h-8 w-8 text-gray-700" />
                <h1 className="text-3xl font-bold text-gray-800">Your Performance Analytics</h1>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Assigned Appointments" value={analytics.totalAssigned} />
                <StatCard title="Pending / Active Appointments" value={analytics.activeAppointments} />
                <StatCard title="Actioned Appointments" value={analytics.totalActioned} />
            </div>

            <div className="mt-8">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900">Appointment Outcome Breakdown</h3>
                     {analytics.totalActioned === 0 ? (
                        <p className="mt-4 text-center text-sm text-gray-500">No data yet. Update an appointment's status to see your performance here.</p>
                    ) : (
                        <div className="mt-4 space-y-4">
                            {statusOrder.map(status => {
                                const count = analytics.statusBreakdown[status];
                                const widthPercentage = analytics.maxCount > 0 ? (count / analytics.maxCount) * 100 : 0;
                                return(
                                    <div key={status} className="flex flex-col sm:flex-row sm:items-center">
                                        <div className="w-full sm:w-1/3 text-sm font-medium text-gray-700 truncate pr-2 flex items-center mb-1 sm:mb-0">
                                            {getStatusPill(status)}
                                            <span className="ml-2 hidden sm:inline">{statusLabels[status]}</span>
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
            </div>

        </div>
    );
};

export default BdmAnalyticsDashboard;