
import React, { useMemo } from 'react';
import type { Booking, BDM } from '../types';
import { ArrowDownTrayIcon } from './Icons';

interface BdmOutcomePerformanceProps {
  bookings: Booking[];
  bdms: BDM[];
}

const BdmOutcomePerformance: React.FC<BdmOutcomePerformanceProps> = ({ bookings, bdms }) => {
    const bdmPerformance = useMemo(() => {
        return bdms.map(bdm => {
            const bdmBookings = bookings.filter(b => b.bdmId === bdm.id);
            const total = bdmBookings.length;
            const sold = bdmBookings.filter(b => b.status === 'sold').length;
            const seen = bdmBookings.filter(b => b.status === 'seen').length;
            const reschedBdm = bdmBookings.filter(b => b.status === 'rescheduled_bdm').length;
            const resched = bdmBookings.filter(b => b.status === 'rescheduled').length;
            const cancelled = bdmBookings.filter(b => b.status === 'cancelled').length;
            const dq = bdmBookings.filter(b => b.status === 'dq').length;
            const soldRate = total > 0 ? ((sold / total) * 100).toFixed(1) : '0.0';

            return {
                ...bdm,
                total,
                sold,
                seen,
                reschedBdm,
                resched,
                cancelled,
                dq,
                soldRate
            };
        }).sort((a, b) => b.total - a.total);
    }, [bookings, bdms]);

    const handleExport = () => {
        const headers = ['BDM Name', 'Region', 'Total Assigned', 'Sold', 'Seen', 'Resched (BDM)', 'Rescheduled', 'Cancelled', 'DQ', 'Sold %'];
        const csvContent = [
            headers.join(','),
            ...bdmPerformance.map(p => [
                p.name, p.region, p.total, p.sold, p.seen, p.reschedBdm, p.resched, p.cancelled, p.dq, `"${p.soldRate}%"`
            ].join(','))
        ].join('\n');

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bdm_performance_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mt-8 animate-fadeIn">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">BDM Outcome Performance</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Click the counts below to view specific leads
                    </p>
                </div>
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-gray-800 shadow-md transition-all active:scale-95 uppercase tracking-widest"
                >
                    <ArrowDownTrayIcon className="w-4 h-4" /> Export Analytics
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">BDM Name</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Assigned</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Sold</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Seen</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Resched (BDM)</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Rescheduled</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Cancelled</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">DQ</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Sold %</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {bdmPerformance.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900">{p.name}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase">{p.region}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-600 underline decoration-gray-200 cursor-pointer">{p.total}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-indigo-600 underline decoration-indigo-100 cursor-pointer">{p.sold}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-600 underline decoration-gray-200 cursor-pointer">{p.seen}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-600 underline decoration-gray-200 cursor-pointer">{p.reschedBdm}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-300">{p.resched}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-800">{p.cancelled}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-200">{p.dq}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-green-600">{p.soldRate}%</td>
                            </tr>
                        ))}
                        {bdmPerformance.length === 0 && (
                            <tr><td colSpan={9} className="p-12 text-center text-gray-400 italic">No BDMs found in database.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BdmOutcomePerformance;
