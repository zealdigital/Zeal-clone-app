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
 * Determines the correct list of appointment slots for a given day.
 * 
 * Priority order (highest to lowest):
 * 1. Specific date override (one-off) - REPLACES all other slots
 * 2. Day-of-the-week override (recurring) - REPLACES base slots for that day
 * 3. Base schedule (fallback)
 * 
 * This ensures that when a manager sets a day-specific override in the UI,
 * it correctly replaces the standard slots for that day of the week.
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

    // 1. HIGHEST PRIORITY: Check for a specific date override (one-off)
    // This completely replaces all other slots
    const dateString = formatDateForStorage(date);
    if (config.overrides.date && config.overrides.date[dateString]) {
        const dateOverrideSlots = config.overrides.date[dateString];
        // Return date override slots as-is (no merging with base)
        return sortTimeSlots([...dateOverrideSlots]);
    }

    // 2. MEDIUM PRIORITY: Check for a day-of-the-week override (recurring)
    // This replaces the base slots for this specific day of the week
    const dayOfWeek = date.getDay();
    if (config.overrides.dayOfWeek && config.overrides.dayOfWeek[dayOfWeek]) {
        const dayOverrideSlots = config.overrides.dayOfWeek[dayOfWeek]!;
        // Return day override slots as-is (no merging with base)
        return sortTimeSlots([...dayOverrideSlots]);
    }

    // 3. LOWEST PRIORITY: Fall back to the base schedule
    return sortTimeSlots([...config.base]);
};
