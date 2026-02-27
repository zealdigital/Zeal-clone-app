
import type { PublicHoliday, Region, LeaveDay, AppointmentSlotsConfig } from '../types';

/**
 * Formats a Date object into a YYYY-MM-DD string using Local Time.
 * This is crucial to avoid UTC shifts that cause dates to move +1 or -1 days.
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
      if (!h.regions.includes(region)) return false;
      return dateString >= h.startDate && dateString <= h.endDate;
  });

  if (isHoliday) {
    return false;
  }
  
  // --- PRIORITY 3: CAPACITY CHECK (Office Events / All Staff Leave) ---
  const totalBdms = salespeopleCount[region] || 0;
  
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
 * Formats a Date object or YYYY-MM-DD string into DD/MM/YY format.
 */
export const formatToDDMMYY = (dateInput: Date | string): string => {
    if (!dateInput) return '-';
    let date: Date;
    if (typeof dateInput === 'string') {
        // Handle YYYY-MM-DD
        const [year, month, day] = dateInput.split('-').map(Number);
        date = new Date(year, month - 1, day);
    } else {
        date = dateInput;
    }
    
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear().toString().slice(-2);
    return `${d}/${m}/${y}`;
};

export const formatDDMMYY = formatToDDMMYY;

/**
 * Formats a Date object into a readable string format using Local components.
 */
export const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
