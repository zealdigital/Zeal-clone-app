import type { Region, AppointmentSlotsConfig } from '../types';
import { formatDateForStorage } from './dateUtils';

/**
 * Parses a time string (e.g., "10:00 AM") into minutes since midnight for sorting
 */
const parseTimeToMinutes = (timeStr: string): number => {
    try {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    } catch {
        return 0;
    }
};

/**
 * Sorts time slots chronologically (e.g., 10:00 AM before 2:00 PM)
 */
const sortTimeSlots = (slots: string[]): string[] => {
    return [...slots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
};

/**
 * Determines the correct list of appointment slots for a given day,
 * considering specific date overrides, then day-of-the-week overrides,
 * and finally the base schedule for the region.
 * 
 * IMPORTANT: Overrides are MERGED with base slots instead of replacing them,
 * ensuring that all standard slots remain available while allowing additional
 * custom slots for specific dates.
 */
export const getAppointmentSlotsForDay = (
    date: Date,
    region: Region,
    appointmentSlotsConfig: Record<Region, AppointmentSlotsConfig>
): string[] => {
    const config = appointmentSlotsConfig[region];
    if (!config) {
        return [];
    }

    // Start with base slots as the foundation
    let allSlots = [...config.base];

    // 1. Check for a specific date override and merge with base slots
    const dateString = formatDateForStorage(date);
    if (config.overrides.date && config.overrides.date[dateString]) {
        const dateOverrideSlots = config.overrides.date[dateString];
        // Merge date override slots with base slots (remove duplicates)
        allSlots = [...new Set([...allSlots, ...dateOverrideSlots])];
    }

    // 2. Check for a day-of-the-week override and merge with existing slots
    const dayOfWeek = date.getDay();
    if (config.overrides.dayOfWeek && config.overrides.dayOfWeek[dayOfWeek]) {
        const dayOverrideSlots = config.overrides.dayOfWeek[dayOfWeek]!;
        // Merge day override slots with existing slots (remove duplicates)
        allSlots = [...new Set([...allSlots, ...dayOverrideSlots])];
    }

    // Return chronologically sorted slots
    return sortTimeSlots(allSlots);
};
