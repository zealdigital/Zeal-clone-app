
import React, { useMemo } from 'react';
import type { Booking, Region, LeaveDay, PublicHoliday, AppointmentSlotsConfig } from '../types';
import { getNextTwoWorkdays, formatDDMMYY, formatDateForStorage } from '../utils/dateUtils';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';
import { ClockIcon } from './Icons';

interface CalendarViewProps {
  allBookingsForRegion: Booking[];
  onSelectSlot: (date: Date, time: string, isCustom: boolean, region: Region) => void;
  region: Region;
  salespeopleCount: Record<Region, number>;
  publicHolidays: PublicHoliday[];
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  leaveDays: LeaveDay[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
    allBookingsForRegion, 
    onSelectSlot, 
    region,
    salespeopleCount,
    publicHolidays,
    appointmentTimes,
    leaveDays,
}) => {
  // Updated to pass all necessary data for the new "Smart Capacity" logic
  const availableDays = useMemo(() => {
      return getNextTwoWorkdays(publicHolidays, region, leaveDays, salespeopleCount, appointmentTimes);
  }, [publicHolidays, region, leaveDays, salespeopleCount, appointmentTimes]);
  
  const bookingsCountByDateTime = useMemo(() => {
    const map = new Map<string, number>();
    // Count all bookings that occupy a slot (including blockers and various active statuses)
    const occupiedStatuses = ['active', 'seen', 'rescheduled_bdm', 'pending_approval', 'sold'];
    allBookingsForRegion.filter(b => occupiedStatuses.includes(b.status)).forEach(booking => {
      const key = `${booking.date}_${booking.time}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [allBookingsForRegion]);

  const bookingsCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    // Only count actual, active bookings for the daily total display (excluding blockers).
    const occupiedStatuses = ['active', 'seen', 'rescheduled_bdm', 'pending_approval', 'sold'];
    allBookingsForRegion.filter(b => occupiedStatuses.includes(b.status) && !b.isBlocker).forEach(booking => {
        const key = booking.date;
        map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [allBookingsForRegion]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Available Slots for <span className="text-black">{region}</span></h1>
      {availableDays.length === 0 ? (
          <div className="bg-white/50 p-8 rounded-xl text-center border border-gray-200">
              <p className="text-gray-600 text-lg">No available dates found in the coming weeks.</p>
              <p className="text-gray-500 text-sm mt-2">Please check back later or contact a manager.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableDays.map(day => {
              const dayString = formatDateForStorage(day);
              const totalBookingsForDay = bookingsCountByDay.get(dayString) || 0;
              const normalizedRegion = region.trim().toUpperCase();
              const leavesForDayAndRegion = leaveDays.filter(l => 
                  l.date === dayString && 
                  l.region.trim().toUpperCase() === normalizedRegion
              );
              const slotsForDay = getAppointmentSlotsForDay(day, region, appointmentTimes);

              return (
                <div key={day.toISOString()} className="bg-white p-6 rounded-xl shadow-md animate-fadeIn">
                  <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {formatDDMMYY(day)}
                    </h2>
                    <div className="text-sm font-medium bg-indigo-100 text-indigo-800 rounded-full px-3 py-1">
                      {totalBookingsForDay} {totalBookingsForDay === 1 ? 'Booking' : 'Bookings'}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {slotsForDay.length === 0 ? (
                        <p className="text-gray-500 text-sm italic text-center py-2">No standard slots configured for this day.</p>
                    ) : (
                        slotsForDay.map(time => {
                          const normalizedRegion = region.trim().toUpperCase();
                          const totalCapacity = salespeopleCount[normalizedRegion] || 0;

                          // Calculate reductions for this specific slot
                          const allDayLeavesCount = leavesForDayAndRegion.filter(l => !l.slots || l.slots.length === 0).length;
                          const specificSlotLeavesCount = leavesForDayAndRegion.filter(l => l.slots?.includes(time)).length;
                          const totalLeavesForSlot = allDayLeavesCount + specificSlotLeavesCount;
                          
                          const slotSpecificCapacity = totalCapacity - totalLeavesForSlot;

                          const key = `${dayString}_${time}`;
                          const bookedSlots = bookingsCountByDateTime.get(key) || 0;
                          const availableSlots = Math.max(0, slotSpecificCapacity - bookedSlots); // Ensure non-negative
                          const isFullyBooked = availableSlots <= 0;

                          return (
                            <button
                              key={time}
                              onClick={() => !isFullyBooked && onSelectSlot(day, time, false, region)}
                              disabled={isFullyBooked}
                              className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between border 
                                ${isFullyBooked 
                                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70' 
                                    : 'bg-white border-gray-300 hover:bg-indigo-50 hover:border-indigo-500 shadow-sm hover:shadow-md'}`}
                            >
                              <div className="flex items-center gap-3">
                                <ClockIcon className={`w-5 h-5 ${isFullyBooked ? 'text-gray-400' : 'text-indigo-600'}`} />
                                <p className={`font-semibold ${isFullyBooked ? 'text-gray-500' : 'text-gray-800'}`}>{time}</p>
                              </div>
                              <div className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                                isFullyBooked
                                ? 'bg-gray-200 text-gray-600'
                                : availableSlots === 1
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                              }`}>
                                {isFullyBooked ? 'Fully Booked' : `${availableSlots} / ${slotSpecificCapacity} available`}
                              </div>
                            </button>
                          );
                        })
                    )}
                    <button
                      onClick={() => onSelectSlot(day, '', true, region)}
                      className="w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 bg-red-50 border border-red-300 hover:bg-red-100 hover:border-red-500 mt-2"
                    >
                      <ClockIcon className="w-5 h-5 text-red-600" />
                      <p className="font-semibold text-red-800">Book Custom Slot</p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
};

export default CalendarView;
