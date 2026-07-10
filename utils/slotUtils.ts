import type { Region, AppointmentSlotsConfig } from '../types';
import { formatDateForStorage } from './dateUtils';

/**
 * Determines the correct list of appointment slots for a given day,
 * considering specific date overrides, then day-of-the-week overrides,
 * and finally the base schedule for the region.
 * @param date The date for which to get slots.
 * @param region The region (NSW or VIC).
 * @param appointmentSlotsConfig The entire configuration object for all regions.
 * @returns An array of strings representing the available time slots.
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

    // 1. Check for a specific date override
    const dateString = formatDateForStorage(date);
    if (config.overrides.date && config.overrides.date[dateString]) {
        return config.overrides.date[dateString];
    }

    // 2. Check for a day-of-the-week override (0=Sun, 1=Mon, ..., 6=Sat)
    const dayOfWeek = date.getDay();
    if (config.overrides.dayOfWeek && config.overrides.dayOfWeek[dayOfWeek]) {
        return config.overrides.dayOfWeek[dayOfWeek]!;
    }

    // 3. Fall back to the base schedule
    return config.base;
};
