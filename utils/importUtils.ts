import type { Booking, Vendor, Region, BDM } from '../types';

// Helper to normalize strings for comparison and header matching
const normalize = (str: string) => str ? str.trim().toLowerCase() : '';

const normalizeWebsite = (url: string): string => {
    if (!url) return '';
    let cleaned = url.toLowerCase().trim().replace(/[\r\n]+/g, '').replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/^[a-z]+:\/\//i, "");
    cleaned = cleaned.replace(/^www\./i, "");
    cleaned = cleaned.split(/[/?#:]/)[0];
    return cleaned;
};

const extractBusinessFromUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
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
 * Safely parses a date string to ISO format
 * Handles DD/MM/YYYY, MM/DD/YYYY, and standard ISO formats
 */
const safeParseToISO = (dateStr: string | undefined | null): string => {
    const fallback = new Date().toISOString();
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
        return fallback;
    }
    
    try {
        const trimmed = dateStr.trim();
        let parsedDate: Date | null = null;
        
        // Try DD/MM/YYYY or DD/MM/YY format
        const ddmmyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (ddmmyyMatch) {
            const day = parseInt(ddmmyyMatch[1], 10);
            const month = parseInt(ddmmyyMatch[2], 10) - 1;
            let year = parseInt(ddmmyyMatch[3], 10);
            if (year < 100) year += 2000;
            parsedDate = new Date(year, month, day);
        } else {
            // Try standard Date parsing
            parsedDate = new Date(trimmed);
        }
        
        if (parsedDate && !isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
        }
    } catch (e) {
        console.warn(`Date parsing failed for: ${dateStr}`, e);
    }
    
    return fallback;
};

/**
 * Robust date and time parser for CSV imports.
 * Returns null for date if invalid/missing to allow skipping rows.
 */
const parseDateTime = (dateTimeStr: string): { date: string | null, time: string } => {
    const now = new Date();
    if (!dateTimeStr || dateTimeStr.trim() === '') return { date: null, time: '10:00 AM' };

    try {
        const input = dateTimeStr.trim().replace(/[\r\n]+/g, ' ');
        if (!input) return { date: null, time: '10:00 AM' };

        // Handle Excel serial dates
        if (/^\d{5}(\.\d+)?$/.test(input)) {
            const excelDate = parseFloat(input);
            const jsDate = new Date((excelDate - 25569) * 86400 * 1000);

            const yyyy = jsDate.getFullYear();
            const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
            const dd = String(jsDate.getDate()).padStart(2, '0');

            return {
                date: `${yyyy}-${mm}-${dd}`,
                time: '10:00 AM'
            };
        }

        // Normalize separators to /
        const normalizedInput = input.replace(/[.-]/g, '/');
        const parts = normalizedInput.split(/\s+/);
        
        let datePart = parts[0];
        let timePart = parts.slice(1).join(' ').trim();

        // Handle case where date is in a different position or input is just time
        if (datePart.includes(':') && !datePart.includes('/') && !datePart.includes('-') && !datePart.includes('.')) {
            timePart = datePart + (timePart ? ' ' + timePart : '');
            datePart = '';
        }

        let finalDate: string | null = null;
        if (datePart) {
            // Remove any non-date characters
            const cleanedDate = datePart.replace(/[^\d/.:-]/g, '').replace(/^[/. -]+|[/. -]+$/g, '').trim();
            
            // Normalize separators to /
            const normalizedDate = cleanedDate.replace(/[.-]/g, '/');
            const slashParts = normalizedDate.split('/');
            
            if (slashParts.length === 3) {
                let d = slashParts[0].padStart(2, '0');
                let m = slashParts[1].padStart(2, '0');
                let y = slashParts[2];
                
                // Handle YYYY/MM/DD
                if (d.length === 4) {
                    finalDate = `${d}-${m.padStart(2, '0')}-${slashParts[2].padStart(2, '0')}`;
                } else {
                    // Determine if it's DD/MM/YYYY or MM/DD/YYYY
                    const day = parseInt(d, 10);
                    const month = parseInt(m, 10);
                    
                    // If day > 12, it must be DD/MM/YYYY
                    if (day > 12) {
                        // DD/MM/YYYY
                        if (y.length === 2) y = `20${y}`;
                        finalDate = `${y}-${m}-${d}`;
                    } 
                    // If month > 12, it must be MM/DD/YYYY
                    else if (month > 12) {
                        // MM/DD/YYYY
                        if (y.length === 2) y = `20${y}`;
                        finalDate = `${y}-${d}-${m}`;
                    } 
                    // If both are <= 12, default to DD/MM/YYYY (Australian format)
                    else {
                        if (y.length === 2) y = `20${y}`;
                        finalDate = `${y}-${m}-${d}`;
                    }
                }
            } else if (slashParts.length === 2) {
                // MM/DD or DD/MM - assume current year
                let d = slashParts[0].padStart(2, '0');
                let m = slashParts[1].padStart(2, '0');
                const y = now.getFullYear();
                // Assume DD/MM
                finalDate = `${y}-${m}-${d}`;
            } else if (slashParts.length === 1) {
                // Just a day - use current month/year
                const d = slashParts[0].padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();
                finalDate = `${y}-${m}-${d}`;
            }
        }

        let finalTime = '10:00 AM';
        if (timePart) {
            let t = timePart.toUpperCase();
            if (!t.includes('AM') && !t.includes('PM')) {
                const timeParts = t.split(':');
                if (timeParts.length >= 2) {
                    let h = parseInt(timeParts[0], 10);
                    let m = timeParts[1].substring(0, 2);
                    const suffix = h >= 12 ? 'PM' : 'AM';
                    h = h % 12;
                    if (h === 0) h = 12;
                    finalTime = `${String(h).padStart(2, '0')}:${m} ${suffix}`;
                } else if (timeParts.length === 1) {
                    let h = parseInt(timeParts[0], 10);
                    if (!isNaN(h)) {
                        const suffix = h >= 12 ? 'PM' : 'AM';
                        h = h % 12;
                        if (h === 0) h = 12;
                        finalTime = `${String(h).padStart(2, '0')}:00 ${suffix}`;
                    }
                }
            } else {
                // Time already has AM/PM, ensure it's properly formatted
                const timeMatch = t.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/);
                if (timeMatch) {
                    let h = parseInt(timeMatch[1], 10);
                    const m = timeMatch[2] || '00';
                    const modifier = timeMatch[3];
                    if (modifier === 'PM' && h < 12) h += 12;
                    if (modifier === 'AM' && h === 12) h = 0;
                    finalTime = `${String(h).padStart(2, '0')}:${m} ${modifier}`;
                }
            }
        }

        // Validate the date is reasonable (between 2000 and 2100)
        if (finalDate) {
            const year = parseInt(finalDate.split('-')[0], 10);
            if (year < 2000 || year > 2100) {
                console.warn(`Invalid year in date: ${finalDate}`);
                return { date: null, time: finalTime };
            }
        }

        return { date: finalDate, time: finalTime };
    } catch (e) {
        console.error('Error parsing date/time:', dateTimeStr, e);
        return { date: null, time: '10:00 AM' };
    }
};

export const generateImportTemplate = () => {
    const headers = [
        'Calling Team', 'Website', 'Booked Date', 'Appt Date', 'Status', 'Caller', 'Notes',
        'Lead : First Name', 'Lead : Emails', 'Lead : Phone Number', 'Lead : Mobile', 'Lead : Last Name',
        'Lead : Address', 'Lead : Suburb', 'Lead : State', 'Lead : Post Code', 'Company : Website',
        'Business Name', 'Client Name', 'Region', 'Address', 'Phone', 'Email'
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
        if (lower === 'business name') map['business'] = i;
        else if (lower === 'company : website') map['companyWebsite'] = i;
        else if (lower === 'website') map['website'] = i;
        
        // Client
        if (lower === 'client name') map['client'] = i;
        else if (lower === 'lead : first name') map['firstName'] = i;
        else if (lower === 'lead : last name') map['lastName'] = i;
        
        // Phone
        if (lower === 'phone') map['phone'] = i;
        else if (lower === 'lead : mobile') map['mobile'] = i;
        else if (lower === 'lead : phone number') map['phoneNumber'] = i;
        
        // Email
        if (lower === 'email' || lower === 'lead : emails') map['email'] = i;
        
        // Team/Caller
        if (lower === 'calling team' || lower === 'calling teamc') map['team'] = i;
        else if (lower === 'caller') map['caller'] = i;
        
        // Status
        if (lower === 'status') map['status'] = i;
        
        // Dates
        if (lower === 'appt date') map['apptDate'] = i;
        else if (lower === 'booked date') map['bookedDate'] = i;
        
        // Notes
        if (lower === 'notes') map['notes'] = i;
        
        // BDM mapping
        if (lower === 'bdm' || lower.includes('salesperson') || lower.includes('sales person')) map['bdm'] = i;
        
        // Region/Address
        if (lower === 'region') map['region'] = i;
        else if (lower === 'lead : state') map['leadState'] = i;
        
        if (lower === 'address') map['address'] = i;
        else if (lower === 'lead : address') map['leadAddress'] = i;
        
        if (lower === 'lead : suburb') map['suburb'] = i;
        if (lower === 'lead : post code') map['postCode'] = i;
    });
    return map;
};

export const processImportFile = async (
    file: File, 
    existingBookings: Booking[], 
    vendors: Vendor[],
    bdms: BDM[],
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

            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const existingMap = new Map<string, number>();
            existingBookings.forEach(b => {
                if (b.isBlocker || b.status === 'rejected') return;
                const bDate = new Date(b.date);
                if (bDate < oneYearAgo) return;
                const webKey = normalizeWebsite(b.clientWebsite);
                if (webKey) existingMap.set(webKey, b.id);
            });

            const baseId = Date.now();

            dataLines.forEach((line, index) => {
                const cols = parseCSVLine(line);
                if (cols.every(c => !c.trim())) return; // Skip completely empty rows

                // Ghost lead prevention: Ensure we have at least SOME client info or business info
                // We'll calculate these first
                
                // clientName => Client Name || Lead : First Name + Lead : Last Name || "-"
                let clientName = '-';
                if (headerMap['client'] !== undefined && cols[headerMap['client']]) {
                    clientName = (cols[headerMap['client']] || '').trim();
                } else if (headerMap['firstName'] !== undefined || headerMap['lastName'] !== undefined) {
                    const first = (headerMap['firstName'] !== undefined ? (cols[headerMap['firstName']] || '') : '').trim();
                    const last = (headerMap['lastName'] !== undefined ? (cols[headerMap['lastName']] || '') : '').trim();
                    clientName = `${first} ${last}`.trim() || '-';
                }

                // businessName => Business Name || Company : Website (extracted) || Website (extracted) || '-'
                let businessName = '-';
                if (headerMap['business'] !== undefined && cols[headerMap['business']]) {
                    businessName = (cols[headerMap['business']] || '').trim();
                } else if (headerMap['companyWebsite'] !== undefined && cols[headerMap['companyWebsite']]) {
                    businessName = extractBusinessFromUrl((cols[headerMap['companyWebsite']] || '').trim()) || '-';
                } else if (headerMap['website'] !== undefined && cols[headerMap['website']]) {
                    businessName = extractBusinessFromUrl((cols[headerMap['website']] || '').trim()) || '-';
                }

                // Skip if both are missing or just placeholders
                if ((clientName === '-' || !clientName) && (businessName === '-' || !businessName)) {
                    skipped++;
                    return;
                }

                // apptDate => Appt Date || "-"
                let apptDateRaw = '-';
                if (headerMap['apptDate'] !== undefined && cols[headerMap['apptDate']]) {
                    apptDateRaw = (cols[headerMap['apptDate']] || '').trim();
                }

                // bookedDate => Booked Date || "-"
                let bookedDateRaw = '-';
                if (headerMap['bookedDate'] !== undefined && cols[headerMap['bookedDate']]) {
                    bookedDateRaw = (cols[headerMap['bookedDate']] || '').trim();
                }

                // region => Region || Lead : State || "-"
                let regionRaw = '-';
                if (headerMap['region'] !== undefined && cols[headerMap['region']]) {
                    regionRaw = (cols[headerMap['region']] || '').trim();
                } else if (headerMap['leadState'] !== undefined && cols[headerMap['leadState']]) {
                    regionRaw = (cols[headerMap['leadState']] || '').trim();
                }

                // address => Address || Lead : Address + Lead : Suburb + Lead : Post Code || "-"
                let address = '-';
                if (headerMap['address'] !== undefined && cols[headerMap['address']]) {
                    address = (cols[headerMap['address']] || '').trim();
                } else if (headerMap['leadAddress'] !== undefined || headerMap['suburb'] !== undefined || headerMap['postCode'] !== undefined) {
                    const addr = (headerMap['leadAddress'] !== undefined ? (cols[headerMap['leadAddress']] || '') : '').trim();
                    const sub = (headerMap['suburb'] !== undefined ? (cols[headerMap['suburb']] || '') : '').trim();
                    const pc = (headerMap['postCode'] !== undefined ? (cols[headerMap['postCode']] || '') : '').trim();
                    address = `${addr} ${sub} ${pc}`.trim() || '-';
                }

                // clientPhone => Phone || Lead : Mobile || Lead : Phone Number || "-"
                let phone = '-';
                if (headerMap['phone'] !== undefined && cols[headerMap['phone']]) {
                    phone = (cols[headerMap['phone']] || '').trim();
                } else if (headerMap['mobile'] !== undefined && cols[headerMap['mobile']]) {
                    phone = (cols[headerMap['mobile']] || '').trim();
                } else if (headerMap['phoneNumber'] !== undefined && cols[headerMap['phoneNumber']]) {
                    phone = (cols[headerMap['phoneNumber']] || '').trim();
                }

                // clientEmail => Email || Lead : Emails || "-"
                let email = '-';
                if (headerMap['email'] !== undefined && cols[headerMap['email']]) {
                    email = (cols[headerMap['email']] || '').trim();
                }

                // clientWebsite => Website || "-"
                let website = '-';
                if (headerMap['website'] !== undefined && cols[headerMap['website']]) {
                    website = (cols[headerMap['website']] || '').trim();
                }

                // vendor => Calling Team || "-"
                let callingTeam = '-';
                if (headerMap['team'] !== undefined && cols[headerMap['team']]) {
                    callingTeam = (cols[headerMap['team']] || '').trim();
                }

                // callerName => Caller || "-"
                let callerName = '-';
                if (headerMap['caller'] !== undefined && cols[headerMap['caller']]) {
                    callerName = (cols[headerMap['caller']] || '').trim();
                }

                // notes => Notes || notes || "-"
                let notes = '-';
                if (headerMap['notes'] !== undefined && cols[headerMap['notes']]) {
                    notes = (cols[headerMap['notes']] || '').trim();
                }

                // bdm => BDM column in CSV
                let bdmNameRaw = '';
                if (headerMap['bdm'] !== undefined && cols[headerMap['bdm']]) {
                    bdmNameRaw = (cols[headerMap['bdm']] || '').trim();
                }

                // status => Status || "seen" (default)
                let statusRaw = 'seen';
                if (headerMap['status'] !== undefined && cols[headerMap['status']]) {
                    statusRaw = (cols[headerMap['status']] || '').trim();
                }

                // Parse appointment date from available data
                let dateToParse = '';
                if (apptDateRaw !== '-') {
                    dateToParse = apptDateRaw;
                } else if (bookedDateRaw !== '-') {
                    dateToParse = bookedDateRaw;
                }
                const { date, time } = parseDateTime(dateToParse);
                
                // Final ghost check: 
                // 1. If no valid date was found, skip it
                // 2. If both client name and business name are missing/placeholders, skip it
                if (!date || (clientName === '-' && businessName === '-')) {
                    skipped++;
                    return;
                }

                let matchedVendor = vendors.find(v => normalize(v.name) === normalize(callingTeam));
                if (!matchedVendor) {
                    matchedVendor = { id: 999999 + index, name: callingTeam === '-' ? 'Imported' : callingTeam, username: 'imported', active: true };
                }

                // Map BDM if provided
                let bdmId: number | undefined = undefined;
                if (bdmNameRaw) {
                    const matchedBdm = bdms.find(b => 
                        normalize(b.username) === normalize(bdmNameRaw) || 
                        normalize(b.name) === normalize(bdmNameRaw)
                    );
                    if (matchedBdm) {
                        bdmId = matchedBdm.id;
                    }
                }

                // Fallback to "kevin" as requested if no match was found yet
                if (!bdmId) {
                    const kevin = bdms.find(b => b.username.toLowerCase() === 'kevin');
                    if (kevin) {
                        bdmId = kevin.id;
                    }
                }

                const region = (normalize(regionRaw).includes('vic') ? 'VIC' : (normalize(regionRaw).includes('nsw') ? 'NSW' : regionRaw)) as Region;
                
                // Map status keywords to valid app statuses
                let status: Booking['status'] = 'seen';
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

                const webKey = normalizeWebsite(website !== '-' ? website : '');
                const duplicateId = webKey ? existingMap.get(webKey) : undefined;

                if (duplicateId) duplicates++;

                // Safely parse bookedAt date using the helper function
                const bookedAtISO = safeParseToISO(bookedDateRaw);

                newBookings.push({
                    id: baseId + index,
                    clientName,
                    businessName,
                    date, // Use the parsed valid date
                    time,
                    region,
                    address,
                    clientPhone: phone || '-',
                    clientEmail: email || '-',
                    clientWebsite: website || '-',
                    vendor: matchedVendor,
                    bdmId,
                    callerName: callerName,
                    notes: notes || '-',
                    status,
                    bookedAt: bookedAtISO,
                    isDuplicate: !!duplicateId,
                    duplicateOfBookingId: duplicateId,
                });
                imported++;
                
                // Cache for subsequent row duplicate checks within the same file
                if (webKey) existingMap.set(webKey, baseId + index);
            });

            resolve({ newBookings, stats: { imported, duplicates, skipped } });
        };
        reader.readAsText(file);
    });
};
