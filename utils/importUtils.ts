import type { Booking, Vendor, Region } from '../types';

// Helper to normalize strings for comparison and header matching
const normalize = (str: string) => str ? str.trim().toLowerCase() : '';

const extractBusinessFromUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    // If it doesn't look like a URL (no dots or slashes), it might already be a business name
    if (!trimmed.includes('.') && !trimmed.includes('/')) return trimmed.toUpperCase();
    try {
        const domain = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
        const name = domain.split('.')[0];
        if (!name) return trimmed.toUpperCase();
        return name.toUpperCase().replace(/-/g, ' ');
    } catch {
        return trimmed.toUpperCase();
    }
};

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
        'Calling Team', 'Website', 'Booked Date', 'Appt Date', 'Status', 'Caller', 'Notes',
        'Business Name', 'Client Name', 'Region', 'Address', 'Phone', 'Email',
        'Lead : First Name', 'Lead : Last Name', 'Lead : Emails', 'Lead : Phone Number', 'Lead : Mobile',
        'Lead : Address', 'Lead : Suburb', 'Lead : State', 'Lead : Post Code', 'Company : Website'
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
        // Business
        if (lower === 'business name' || lower === 'business') map['business'] = i;
        else if (lower === 'company : website') map['companyWebsite'] = i;
        else if (lower === 'website' || lower === 'url') map['website'] = i;
        
        // Client
        if (lower === 'client name' || lower === 'client') map['client'] = i;
        else if (lower === 'lead : first name' || lower === 'first name') map['firstName'] = i;
        else if (lower === 'lead : last name' || lower === 'last name') map['lastName'] = i;
        
        // Phone
        if (lower === 'phone' || lower === 'lead : phone number') map['phone'] = i;
        else if (lower === 'lead : mobile' || lower === 'mobile') map['mobile'] = i;
        
        // Email
        if (lower === 'email' || lower === 'lead : emails') map['email'] = i;
        
        // Team/Caller
        if (lower === 'calling team' || lower === 'calling teamc' || lower === 'team') map['team'] = i;
        else if (lower === 'caller') map['caller'] = i;
        
        // Status
        if (lower === 'status') map['status'] = i;
        
        // Dates
        if (lower === 'appt date' || lower === 'appointment') map['apptDate'] = i;
        else if (lower === 'booked date') map['bookedDate'] = i;
        
        // Notes
        if (lower === 'notes') map['notes'] = i;
        
        // Region/Address
        if (lower === 'lead : state') map['region'] = i;
        else if (lower === 'region' || lower === 'state') map['region'] = i;
        
        if (lower === 'lead : address') map['address'] = i;
        else if (lower === 'address') map['address'] = i;
        
        if (lower === 'lead : suburb' || lower === 'suburb') map['suburb'] = i;
        if (lower === 'lead : post code' || lower === 'post code') map['postCode'] = i;
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

                // Use the header map to extract data based on user defined mappings
                let businessName = '';
                if (headerMap['business'] !== undefined && cols[headerMap['business']]) {
                    businessName = cols[headerMap['business']];
                } else if (headerMap['companyWebsite'] !== undefined && cols[headerMap['companyWebsite']]) {
                    businessName = extractBusinessFromUrl(cols[headerMap['companyWebsite']]);
                } else if (headerMap['website'] !== undefined && cols[headerMap['website']]) {
                    businessName = extractBusinessFromUrl(cols[headerMap['website']]);
                }
                if (!businessName || businessName.trim() === '' || businessName === '-') businessName = '-';

                let clientName = '';
                if (headerMap['client'] !== undefined && cols[headerMap['client']]) {
                    clientName = cols[headerMap['client']];
                } else if (headerMap['firstName'] !== undefined || headerMap['lastName'] !== undefined) {
                    const first = headerMap['firstName'] !== undefined ? cols[headerMap['firstName']] : '';
                    const last = headerMap['lastName'] !== undefined ? cols[headerMap['lastName']] : '';
                    clientName = `${first} ${last}`.trim();
                }
                if (!clientName || clientName.trim() === '' || clientName === '-') clientName = '-';

                let website = headerMap['website'] !== undefined ? cols[headerMap['website']] : '';
                if (!website && headerMap['companyWebsite'] !== undefined) website = cols[headerMap['companyWebsite']];

                let phone = '';
                if (headerMap['phone'] !== undefined && cols[headerMap['phone']]) phone = cols[headerMap['phone']];
                else if (headerMap['mobile'] !== undefined && cols[headerMap['mobile']]) phone = cols[headerMap['mobile']];
                if (!phone || phone.trim() === '') phone = '-';

                let email = '';
                if (headerMap['email'] !== undefined && cols[headerMap['email']]) email = cols[headerMap['email']];
                if (!email || email.trim() === '') email = '-';

                let callingTeam = headerMap['team'] !== undefined ? cols[headerMap['team']] : 'Imported';
                let callerName = headerMap['caller'] !== undefined ? cols[headerMap['caller']] : 'System';
                let statusRaw = headerMap['status'] !== undefined ? cols[headerMap['status']] : 'active';
                let apptDateRaw = headerMap['apptDate'] !== undefined ? cols[headerMap['apptDate']] : (headerMap['bookedDate'] !== undefined ? cols[headerMap['bookedDate']] : '');
                let regionRaw = headerMap['region'] !== undefined ? cols[headerMap['region']] : '-';

                let address = '';
                const mainAddr = headerMap['address'] !== undefined ? cols[headerMap['address']] : '';
                const suburb = headerMap['suburb'] !== undefined ? cols[headerMap['suburb']] : '';
                const postCode = headerMap['postCode'] !== undefined ? cols[headerMap['postCode']] : '';
                if (suburb || postCode) {
                    address = `${mainAddr} ${suburb} ${postCode}`.trim();
                } else {
                    address = mainAddr;
                }
                if (!address || address.trim() === '' || address === '-') address = '-';

                let notes = headerMap['notes'] !== undefined ? cols[headerMap['notes']] : '';
                if (!notes || notes.trim() === '') notes = 'Imported Data Record';

                const { date, time } = parseDateTime(apptDateRaw);
                
                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999 + index, name: callingTeam || 'Imported', username: 'imported', active: true };
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : (normalize(regionRaw).includes('nsw') ? 'NSW' : regionRaw)) as Region;
                
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