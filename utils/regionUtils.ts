
import type { Region } from '../types';

const PASTEL_COLORS: string[] = [
    '#ffedd5', // orange-100
    '#ffe4e6', // rose-100
    '#f3e8ff', // purple-100
    '#ccfbf1', // teal-100
    '#fef3c7', // amber-100
    '#ecfccb', // lime-100
    '#cffafe', // cyan-100
    '#fae8ff', // fuchsia-100
    '#d1fae5', // emerald-100
    '#e0f2fe', // sky-100
    '#fce7f3', // pink-100
    '#ede9fe'  // violet-100
];

/**
 * Returns a Hex Color for the region background.
 * Uses the user's custom preference if available.
 * Otherwise falls back to NSW/VIC defaults or a deterministic hash.
 */
export const getRegionBackgroundColor = (region: Region, regionColors: Record<string, string> = {}): string => {
    // 1. Check user preference
    if (regionColors[region]) {
        return regionColors[region];
    }

    // 2. Defaults for Legacy Regions (if not in map)
    if (region === 'NSW') return '#CFE59C';
    if (region === 'VIC') return '#DBEAFE'; // blue-100

    // 3. Simple hash function for new regions to get a stable default color
    let hash = 0;
    for (let i = 0; i < region.length; i++) {
        hash = region.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
};
