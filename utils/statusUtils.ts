
import React from 'react';
import type { Booking } from '../types';

const statusStyles: Record<Booking['status'], string> = {
    active: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    seen: 'bg-green-100 text-green-800',
    rescheduled: 'bg-yellow-100 text-yellow-800',
    rescheduled_bdm: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-gray-100 text-gray-800',
    dq: 'bg-purple-100 text-purple-800',
    sold: 'bg-amber-400 text-amber-900 font-bold',
    pending_approval: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
};

const statusLabels: Record<Booking['status'], string> = {
    active: 'Active',
    rejected: 'Rejected',
    seen: 'Seen',
    rescheduled: 'Rescheduled',
    rescheduled_bdm: 'Rescheduled (BDM)',
    cancelled: 'Cancelled',
    dq: 'DQ',
    sold: 'Sold',
    pending_approval: 'Pending Approval',
};

// FIX: Replaced JSX syntax with React.createElement to resolve errors in a .ts file.
// JSX is not supported in .ts files and causes compilation errors.
export const getStatusPill = (status: Booking['status']) => {
    return React.createElement('span', {
        className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${statusStyles[status]}`
    }, statusLabels[status]);
};