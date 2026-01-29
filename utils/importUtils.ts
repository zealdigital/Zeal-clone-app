
import type { Booking, Vendor, Region } from '../types';

// Helper to normalize strings for comparison
const normalize = (str: string) => str ? str.trim().toLowerCase() : '';

/**
 * Robust date and time parser for CSV imports.
 * Handles YYYY-MM-DD, DD/MM/YYYY, and optional time suffixes.
 * Uses LOCAL time components to avoid UTC timezone shifts.
 */
const parseDateTime = (dateTimeStr: string): { date: string, time: string } => {
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    if (!dateTimeStr || dateTimeStr.trim() === '') return { date: today, time: '10:00 AM' };

    try {
        const input = dateTimeStr.trim();
        const parts = input.split(/\s+/);
        let dateStr = parts[0];
        let timeStr = parts.slice(1).join(' ').trim();

        dateStr = dateStr.replace(/[^\d/:-]/g, '').replace(/-+$/, '').trim();

        let finalDate = today;
        
        if (dateStr.includes('/')) {
            const slashParts = dateStr.split('/');
            if (slashParts.length === 3) {
                const day = slashParts[0].padStart(2, '0');
                const month = slashParts[1].padStart(2, '0');
                let year = slashParts[2];
                if (year.length === 2) year = `20${year}`;
                finalDate = `${year}-${month}-${day}`;
            }
        } else if (dateStr.includes('-')) {
            const dashParts = dateStr.split('-');
            if (dashParts.length === 3) {
                const year = dashParts[0].length === 2 ? `20${dashParts[0]}` : dashParts[0];
                const month = dashParts[1].padStart(2, '0');
                const day = dashParts[2].padStart(2, '0');
                finalDate = `${year}-${month}-${day}`;
            }
        }

        let finalTime = '10:00 AM';
        if (timeStr) {
            finalTime = timeStr.toUpperCase();
            if (!finalTime.includes('AM') && !finalTime.includes('PM')) {
                const timeParts = finalTime.split(':');
                if (timeParts.length >= 2) {
                    let h = parseInt(timeParts[0]);
                    let m = timeParts[1].substring(0, 2);
                    const suffix = h >= 12 ? 'PM' : 'AM';
                    h = h % 12;
                    if (h === 0) h = 12;
                    finalTime = `${h.toString().padStart(2, '0')}:${m} ${suffix}`;
                }
            }
        }

        return { date: finalDate, time: finalTime };
    } catch (e) {
        return { date: today, time: '10:00 AM' };
    }
};

export const generateImportTemplate = () => {
    const headers = [
        'Calling team', 'Website', 'Booked Date', 'Appt Date', 'Status', 'Caller', 'Notes',
        'Business Name (Required)', 'Client Name (Required)', 'Region (NSW/VIC)', 'Address', 'Phone'
    ];
    return headers.join(',');
};

const parseCSVLine = (line: string): string[] => {
    const result = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim());
    return result;
};

export const processImportFile = async (
    file: File, 
    existingBookings: Booking[], 
    vendors: Vendor[],
    currentUser: any
): Promise<{ newBookings: Booking[], stats: { imported: number, duplicates: number, skipped: number } }> => {
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) { resolve({ newBookings: [], stats: { imported: 0, duplicates: 0, skipped: 0 } }); return; }

            const allLines = text.split(/\r?\n/);
            if (allLines.length <= 1) { resolve({ newBookings: [], stats: { imported: 0, duplicates: 0, skipped: 0 } }); return; }
            
            const dataLines = allLines.slice(1);
            const newBookings: Booking[] = [];
            let duplicates = 0;
            let imported = 0;
            let skipped = 0;

            const existingBusinessMap = new Map<string, number>();
            existingBookings.forEach(b => {
                if (!b.isBlocker) existingBusinessMap.set(normalize(b.businessName), b.id);
            });

            const baseId = Date.now();

            dataLines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.replace(/,/g, '').trim() === '') return;

                const cols = parseCSVLine(line);
                
                let businessName = cols[7]; 
                if (!businessName || businessName.trim() === '') {
                    businessName = cols[7] || cols[8] || cols[6] || '';
                }

                if (!businessName || businessName.trim() === '') {
                    skipped++;
                    return;
                }

                const callingTeam = cols[0] || 'Imported';
                const website = cols[1] || '';
                const bookedDate = cols[2] || '';
                const apptDateRaw = cols[3] || '';
                const statusRaw = cols[4] || 'active';
                const callerName = cols[5] || callingTeam;
                const notes = cols[6] || '';
                const clientName = cols[8] || 'Imported Lead';
                const regionRaw = cols[9] || 'NSW';
                const address = cols[10] || '';
                const phone = cols[11] || '';

                const { date, time } = parseDateTime(apptDateRaw || bookedDate);
                
                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999 + index, name: callingTeam, username: 'imported', active: true };
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : 'NSW') as Region;
                let status: Booking['status'] = 'active';
                const s = normalize(statusRaw);
                if (['active', 'rejected', 'seen', 'rescheduled', 'cancelled', 'dq', 'sold', 'pending_approval'].includes(s)) {
                    status = s as Booking['status'];
                } else if (s === 'done' || s === 'completed' || s === 'met') {
                    status = 'seen';
                }

                const normalizedBusiness = normalize(businessName);
                const isDuplicate = existingBusinessMap.has(normalizedBusiness);
                const duplicateId = existingBusinessMap.get(normalizedBusiness);

                if (isDuplicate) duplicates++;

                newBookings.push({
                    id: baseId + index,
                    clientName,
                    businessName,
                    date,
                    time,
                    region,
                    address,
                    clientPhone: phone,
                    clientWebsite: website,
                    vendor: matchedVendor,
                    callerName: callerName,
                    notes: notes || `Imported: ${bookedDate}`,
                    status,
                    isDuplicate: !!isDuplicate,
                    duplicateOfBookingId: duplicateId,
                });
                imported++;
                existingBusinessMap.set(normalizedBusiness, baseId + index);
            });

            resolve({ newBookings, stats: { imported, duplicates, skipped } });
        };
        reader.readAsText(file);
    });
};
