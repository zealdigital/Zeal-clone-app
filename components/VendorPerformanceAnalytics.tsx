
import React, { useMemo } from 'react';
import type { Booking, Vendor } from '../types';

interface VendorPerformanceAnalyticsProps {
  bookings: Booking[];
  vendors: Vendor[];
}

const VendorPerformanceAnalytics: React.FC<VendorPerformanceAnalyticsProps> = ({ bookings, vendors }) => {
    const analytics = useMemo(() => {
        const bookingsByVendor = vendors.map(vendor => ({
            ...vendor,
            count: bookings.filter(b => b.vendor.id === vendor.id).length
        })).sort((a, b) => b.count - a.count);

        const maxVendorBookings = bookingsByVendor.length > 0 ? bookingsByVendor.reduce((max, v) => v.count > max ? v.count : max, 0) : 0;

        return {
            bookingsByVendor,
            maxVendorBookings
        };
    }, [bookings, vendors]);

  return (
    <div className="bg-white p-6 rounded-lg shadow mt-8">
        <h3 className="text-lg font-semibold text-gray-900">Performance by Calling Team</h3>
            {bookings.length === 0 ? (
            <p className="mt-4 text-center text-sm text-gray-500">No calling team performance data available.</p>
        ) : (
            <div className="mt-4 space-y-4">
                {analytics.bookingsByVendor.map(vendor => {
                    const widthPercentage = analytics.maxVendorBookings > 0 ? (vendor.count / analytics.maxVendorBookings) * 100 : 0;
                    return(
                        <div key={vendor.id} className="flex items-center">
                            <p className="w-1/3 text-sm font-medium text-gray-700 truncate pr-2">{vendor.name}</p>
                            <div className="w-2/3 flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-5">
                                    <div 
                                        className="bg-indigo-500 h-5 rounded-full text-white text-xs flex items-center justify-end pr-2 transition-all duration-500"
                                        style={{ width: `${widthPercentage}%` }}
                                    >
                                        {vendor.count > 0 && vendor.count}
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

export default VendorPerformanceAnalytics;
