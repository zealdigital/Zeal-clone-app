import type { Region, AppointmentSlotsConfig } from '../types';
import { formatDateForStorage } from './dateUtils';

/**
 * Determines the correct list of appointment slots for a given day,
 * considering specific date overrides, then day-of-the-week overrides,
 * and finally the base schedule for the region.
 */
export const getAppointmentSlotsForDay = (
    date: Date,
    region: Region,
    appointmentSlotsConfig: Record<Region, AppointmentSlotsConfig>
): string[] => {
    const config = appointmentSlotsConfig[region];
    
    // Debug logging
    console.log(`getAppointmentSlotsForDay called with:`, {
        date: date.toISOString(),
        region,
        hasConfig: !!config,
        configBase: config?.base,
        configOverrides: config?.overrides
    });
    
    if (!config) {
        console.warn(`No appointment config found for region: ${region}`);
        return [];
    }

    // 1. Check for a specific date override
    const dateString = formatDateForStorage(date);
    if (config.overrides.date && config.overrides.date[dateString]) {
        console.log(`Using date override for ${dateString}:`, config.overrides.date[dateString]);
        return config.overrides.date[dateString];
    }

    // 2. Check for a day-of-the-week override (0=Sun, 1=Mon, ..., 6=Sat)
    const dayOfWeek = date.getDay();
    if (config.overrides.dayOfWeek && config.overrides.dayOfWeek[dayOfWeek]) {
        console.log(`Using day override for ${dayOfWeek}:`, config.overrides.dayOfWeek[dayOfWeek]);
        return config.overrides.dayOfWeek[dayOfWeek]!;
    }

    // 3. Fall back to the base schedule
    console.log(`Using base schedule for ${region}:`, config.base);
    return config.base;
};
