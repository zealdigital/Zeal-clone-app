
import type { Booking, Vendor, Region } from '../types';

// Helper to normalize strings for comparison
const normalize = (str: string) => str ? str.trim().toLowerCase() : '';

/**
 * Robust date and time parser for CSV imports.
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
        'Calling team', 'Website', 'Email', 'Booked Date', 'Appt Date', 'Status', 'Caller', 'Notes',
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

            const existingMap = new Map<string, number>();
            existingBookings.forEach(b => {
                if (b.isBlocker || b.status === 'rejected') return;
                const bizKey = normalize(b.businessName);
                const clientKey = normalize(b.clientName);
                const phoneKey = b.clientPhone.replace(/\D/g, '');
                const emailKey = normalize(b.clientEmail || '');

                if (bizKey) existingMap.set('biz_' + bizKey, b.id);
                if (clientKey) existingMap.set('cli_' + clientKey, b.id);
                if (phoneKey) existingMap.set('pho_' + phoneKey, b.id);
                if (emailKey) existingMap.set('eml_' + emailKey, b.id);
            });

            const baseId = Date.now();

            dataLines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.replace(/,/g, '').trim() === '') return;

                const cols = parseCSVLine(line);
                
                let businessName = cols[8]; 
                let clientName = cols[9];
                let phone = cols[12];
                let email = cols[2];
                let website = cols[1];
                let callingTeam = cols[0] || 'Imported';
                let apptDateRaw = cols[4] || cols[3] || '';
                let statusRaw = cols[5] || 'active';
                let callerName = cols[6] || callingTeam;
                let notes = cols[7] || '';
                let regionRaw = cols[10] || 'NSW';
                let address = cols[11] || '';

                if (!businessName || businessName.trim() === '') {
                    skipped++;
                    return;
                }

                const { date, time } = parseDateTime(apptDateRaw);
                
                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999 + index, name: callingTeam, username: 'imported', active: true };
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : 'NSW') as Region;
                let status: Booking['status'] = 'active';
                const s = normalize(statusRaw);
                if (['active', 'rejected', 'seen', 'rescheduled', 'cancelled', 'dq', 'sold', 'pending_approval'].includes(s)) {
                    status = s as Booking['status'];
                }

                const normBiz = normalize(businessName);
                const normCli = normalize(clientName);
                const normPho = phone ? phone.replace(/\D/g, '') : '';
                const normEml = normalize(email);

                const duplicateId = 
                    existingMap.get('biz_' + normBiz) || 
                    existingMap.get('cli_' + normCli) || 
                    (normPho ? existingMap.get('pho_' + normPho) : undefined) || 
                    (normEml ? existingMap.get('eml_' + normEml) : undefined);

                if (duplicateId) duplicates++;

                newBookings.push({
                    id: baseId + index,
                    clientName,
                    businessName,
                    date,
                    time,
                    region,
                    address,
                    clientPhone: phone || '',
                    clientEmail: email || '',
                    clientWebsite: website || '',
                    vendor: matchedVendor,
                    callerName: callerName,
                    notes: notes || `Imported Lead`,
                    status,
                    isDuplicate: !!duplicateId,
                    duplicateOfBookingId: duplicateId,
                });
                imported++;
                
                if (normBiz) existingMap.set('biz_' + normBiz, baseId + index);
                if (normCli) existingMap.set('cli_' + normCli, baseId + index);
                if (normPho) existingMap.set('pho_' + normPho, baseId + index);
                if (normEml) existingMap.set('eml_' + normEml, baseId + index);
            });

            resolve({ newBookings, stats: { imported, duplicates, skipped } });
        };
        reader.readAsText(file);
    });
};
