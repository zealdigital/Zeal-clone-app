
import type { Booking, Vendor, Region } from '../types';

// Helper to normalize strings for comparison
const normalize = (str: string) => str ? str.trim().toLowerCase() : '';

// Helper to parse date/time string from various formats
const parseDateTime = (dateStr: string): { date: string, time: string } => {
    const today = new Date().toISOString().split('T')[0];
    if (!dateStr || dateStr.trim() === '') return { date: today, time: '10:00 AM' };

    try {
        // Clean up artifacts like trailing dashes (e.g., "02/02/2026-")
        const cleanStr = dateStr.replace(/[^\d/:-]/g, '').replace(/-+$/, '').trim();
        
        // Handle DD/MM/YYYY format specifically
        const slashParts = cleanStr.split('/');
        if (slashParts.length === 3) {
            const day = slashParts[0].padStart(2, '0');
            const month = slashParts[1].padStart(2, '0');
            let year = slashParts[2];
            if (year.length === 2) year = `20${year}`;
            return { date: `${year}-${month}-${day}`, time: '10:00 AM' };
        }

        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return { date: today, time: '10:00 AM' };
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return { date: `${year}-${month}-${day}`, time: '10:00 AM' };
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
                
                // DEEP SCAN: User data often shifts columns. 
                // We look for Business Name in the standard slot (7) OR the first non-empty column.
                let businessName = cols[7]; 
                if (!businessName || businessName.trim() === '') {
                    businessName = cols.find(c => c && c.trim().length > 0) || '';
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
                const clientName = cols[8] || 'Imported Lead';
                const regionRaw = cols[9] || 'NSW';
                const address = cols[10] || '';
                const phone = cols[11] || '';

                const { date, time } = parseDateTime(apptDateRaw || bookedDate);
                
                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999, name: callingTeam, username: 'imported', active: true };
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : 'NSW') as Region;
                let status: Booking['status'] = 'active';
                const s = normalize(statusRaw);
                if (['active', 'rejected', 'seen', 'rescheduled', 'cancelled', 'dq', 'sold', 'pending_approval'].includes(s)) {
                    status = s as Booking['status'];
                } else if (s === 'done' || s === 'completed') {
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
                    callerName: matchedVendor.name,
                    notes: `Imported: ${bookedDate}`.trim(),
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
