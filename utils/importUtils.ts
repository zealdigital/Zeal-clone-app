import type { Booking, Vendor, Region } from '../types';

// Helper to normalize strings for comparison and header matching
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

        // Remove any non-date characters (Excel sometimes adds weird formatting)
        dateStr = dateStr.replace(/[^\d/:-]/g, '').replace(/-+$/, '').trim();

        let finalDate = today;
        
        if (dateStr.includes('/')) {
            const slashParts = dateStr.split('/');
            if (slashParts.length === 3) {
                // Determine if it's DD/MM or MM/DD based on first part
                let p1 = slashParts[0].padStart(2, '0');
                let p2 = slashParts[1].padStart(2, '0');
                let year = slashParts[2];
                if (year.length === 2) year = `20${year}`;
                
                // Australian/International format (DD/MM) is expected, but check if month > 12
                if (parseInt(p1) > 12) {
                    // It's MM/DD
                    finalDate = `${year}-${p1}-${p2}`;
                } else {
                    // It's DD/MM
                    finalDate = `${year}-${p2}-${p1}`;
                }
            }
        } else if (dateStr.includes('-')) {
            const dashParts = dateStr.split('-');
            if (dashParts.length === 3) {
                let year = dashParts[0].length === 2 ? `20${dashParts[0]}` : dashParts[0];
                let month = dashParts[1].padStart(2, '0');
                let day = dashParts[2].padStart(2, '0');
                // Check if year is at the end
                if (dashParts[2].length === 4) {
                    year = dashParts[2];
                    month = dashParts[1].padStart(2, '0');
                    day = dashParts[0].padStart(2, '0');
                }
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

/**
 * Maps CSV headers to indexes based on keyword matching
 */
const getHeaderMap = (headers: string[]) => {
    const map: Record<string, number> = {};
    headers.forEach((h, i) => {
        const lower = normalize(h);
        if (lower.includes('business')) map['business'] = i;
        else if (lower.includes('client')) map['client'] = i;
        else if (lower.includes('website') || lower.includes('url')) map['website'] = i;
        else if (lower.includes('phone') || lower.includes('mobile')) map['phone'] = i;
        else if (lower.includes('email')) map['email'] = i;
        else if (lower.includes('team')) map['team'] = i;
        else if (lower.includes('status')) map['status'] = i;
        else if (lower.includes('appt') || lower.includes('appointment')) map['apptDate'] = i;
        else if (lower.includes('booked')) map['bookedDate'] = i;
        else if (lower.includes('caller')) map['caller'] = i;
        else if (lower.includes('note')) map['notes'] = i;
        else if (lower.includes('region') || lower.includes('state')) map['region'] = i;
        else if (lower.includes('address')) map['address'] = i;
    });
    return map;
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

            const allLines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (allLines.length <= 1) { resolve({ newBookings: [], stats: { imported: 0, duplicates: 0, skipped: 0 } }); return; }
            
            const headers = parseCSVLine(allLines[0]);
            const headerMap = getHeaderMap(headers);
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
                const cols = parseCSVLine(line);
                if (cols.every(c => !c.trim())) return; // Skip empty rows

                // Use the header map to extract data, with fallbacks for common user file structures
                let businessName = headerMap['business'] !== undefined ? cols[headerMap['business']] : '';
                let clientName = headerMap['client'] !== undefined ? cols[headerMap['client']] : '';
                let website = headerMap['website'] !== undefined ? cols[headerMap['website']] : '';
                let phone = headerMap['phone'] !== undefined ? cols[headerMap['phone']] : '';
                let email = headerMap['email'] !== undefined ? cols[headerMap['email']] : '';
                let callingTeam = headerMap['team'] !== undefined ? cols[headerMap['team']] : 'Imported';
                let apptDateRaw = headerMap['apptDate'] !== undefined ? cols[headerMap['apptDate']] : (headerMap['bookedDate'] !== undefined ? cols[headerMap['bookedDate']] : '');
                let statusRaw = headerMap['status'] !== undefined ? cols[headerMap['status']] : 'active';
                let callerName = headerMap['caller'] !== undefined ? cols[headerMap['caller']] : (headerMap['team'] !== undefined ? cols[headerMap['team']] : 'System');
                let notes = headerMap['notes'] !== undefined ? cols[headerMap['notes']] : '';
                let regionRaw = headerMap['region'] !== undefined ? cols[headerMap['region']] : 'NSW';
                let address = headerMap['address'] !== undefined ? cols[headerMap['address']] : '';

                // SMART FALLBACK: If Business Name is missing, try to get it from the Website URL
                if (!businessName || businessName.trim() === '') {
                    if (website) {
                        try {
                            const domain = website.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
                            businessName = domain.split('.')[0].toUpperCase().replace(/-/g, ' ');
                        } catch {
                            businessName = 'N/A';
                        }
                    } else {
                        businessName = 'N/A';
                    }
                }

                // SMART FALLBACK: If Client Name is missing
                if (!clientName || clientName.trim() === '') {
                    clientName = 'Lead Contact';
                }

                const { date, time } = parseDateTime(apptDateRaw);
                
                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999 + index, name: callingTeam || 'Imported', username: 'imported', active: true };
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : 'NSW') as Region;
                
                // Map status keywords to valid app statuses
                let status: Booking['status'] = 'active';
                const s = normalize(statusRaw);
                if (['active', 'rejected', 'seen', 'rescheduled', 'cancelled', 'dq', 'sold', 'pending_approval', 'rescheduled_bdm'].includes(s)) {
                    status = s as Booking['status'];
                } else if (s.includes('reschedule')) {
                    status = 'rescheduled';
                } else if (s.includes('cancel')) {
                    status = 'cancelled';
                } else if (s.includes('met') || s.includes('seen')) {
                    status = 'seen';
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
                    notes: notes || `Imported Data Record`,
                    status,
                    isDuplicate: !!duplicateId,
                    duplicateOfBookingId: duplicateId,
                });
                imported++;
                
                // Cache for subsequent row duplicate checks within the same file
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