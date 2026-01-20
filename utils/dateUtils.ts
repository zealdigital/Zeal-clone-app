
import type { PublicHoliday, Region, LeaveDay, AppointmentSlotsConfig } from '../types';

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param date The date to format.
 * @returns A string in YYYY-MM-DD format.
 */
export const formatDateForStorage = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Checks if a given date is a workday based on:
 * 1. Manager Overrides (High Priority)
 * 2. Weekends & Public Holidays (Ranges)
 * 3. Staff Capacity (Are all BDMs on leave?)
 */
export const isWorkday = (
  date: Date, 
  publicHolidays: PublicHoliday[], 
  region: Region,
  leaveDays: LeaveDay[],
  salespeopleCount: Record<Region, number>,
  appointmentTimes: Record<Region, AppointmentSlotsConfig>
): boolean => {
  const dateString = formatDateForStorage(date);
  
  // --- PRIORITY 1: MANAGER OVERRIDE ---
  const regionConfig = appointmentTimes[region];
  if (regionConfig?.overrides?.date?.[dateString] && regionConfig.overrides.date[dateString].length > 0) {
    return true;
  }

  // --- PRIORITY 2: HARD CONSTRAINTS (Weekends & Holidays) ---
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Check Holiday Ranges
  const isHoliday = publicHolidays.some(h => {
      // Check if this holiday applies to the region
      if (!h.regions.includes(region)) return false;
      // Check date range
      return dateString >= h.startDate && dateString <= h.endDate;
  });

  if (isHoliday) {
    return false;
  }
  
  // --- PRIORITY 3: CAPACITY CHECK (Office Events / All Staff Leave) ---
  const totalBdms = salespeopleCount[region] || 0;
  
  // If there are BDMs assigned to this region, check if they are ALL on leave
  if (totalBdms > 0) {
    const bdmsOnAllDayLeave = leaveDays.filter(l => 
        l.date === dateString && 
        l.region === region && 
        (!l.slots || l.slots.length === 0)
    ).length;

    if ((totalBdms - bdmsOnAllDayLeave) <= 0) {
        return false;
    }
  }
  
  return true;
};

/**
 * Calculates the next two available workdays for a specific region.
 */
export const getNextTwoWorkdays = (
    publicHolidays: PublicHoliday[], 
    region: Region,
    leaveDays: LeaveDay[],
    salespeopleCount: Record<Region, number>,
    appointmentTimes: Record<Region, AppointmentSlotsConfig>
): Date[] => {
  const workdays: Date[] = [];
  const today = new Date();
  
  let currentDate = new Date(today);
  let attempts = 0;
  
  // Loop until we find 2 days or hit a safety limit (e.g., 60 days out)
  while (workdays.length < 2 && attempts < 60) {
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
    
    if (isWorkday(currentDate, publicHolidays, region, leaveDays, salespeopleCount, appointmentTimes)) {
      workdays.push(new Date(currentDate));
    }
  }
  return workdays;
};

/**
 * Formats a Date object into a readable string format.
 */
export const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
