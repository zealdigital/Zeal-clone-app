import type { Booking } from '../types';

/**
 * Exports booking data to a standard CSV file.
 * Uses specific formatting to ensure Microsoft Excel treats numbers and dates as text.
 */
export const exportBookingsToCSV = (bookings: Booking[], filename: string) => {
    if (!bookings || bookings.length === 0) {
        alert('No data to export.');
        return;
    }

    // 1. Define Headers
    const headers = [
        'Calling team',
        'Website',
        'Email',
        'Booked Date',
        'Appt Date',
        'Status',
        'Caller',
        'Business Name',
        'Client Name',
        'Region',
        'Address',
        'Phone',
        'Notes'
    ];

    // 2. Helper to format dates to DD-MMM-YYYY which Excel likes
    const formatDateForExcel = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00Z');
        if (isNaN(d.getTime())) return dateStr;
        const day = d.getUTCDate().toString().padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getUTCMonth()];
        const year = d.getUTCFullYear();
        return `${day}-${month}-${year}`;
    };

    // 3. Map Data to Rows
    const rows = bookings.map(b => {
        const clean = (val: any) => {
            if (val === undefined || val === null) return '';
            // Remove commas, newlines, and tabs so they don't break the CSV structure
            return String(val)
                .replace(/,/g, ';') // Replace commas with semicolons to stay in one cell
                .replace(/\n/g, ' ') 
                .replace(/\r/g, '')
                .replace(/\t/g, ' ')
                .replace(/"/g, "'"); // Replace double quotes with single
        };

        const apptDate = formatDateForExcel(b.date);
        
        // FIX: Get the actual booked/created date from the booking object
        // Priority order: bookedDate > createdAt > created > timestamp > fallback to current date (with warning)
        let bookedDateRaw = '';
        
        if (b.bookedDate) {
            bookedDateRaw = b.bookedDate;
        } else if (b.createdAt) {
            bookedDateRaw = b.createdAt;
        } else if ((b as any).created) {
            bookedDateRaw = (b as any).created;
        } else if ((b as any).timestamp) {
            bookedDateRaw = (b as any).timestamp;
        } else if (b.id && typeof b.id === 'number') {
            // If id is a timestamp number (like Date.now()), convert it to date string
            const possibleDate = new Date(b.id).toISOString().split('T')[0];
            // Check if it's a reasonable date (not too far in past or future)
            const year = parseInt(possibleDate.split('-')[0]);
            if (year >= 2020 && year <= 2030) {
                bookedDateRaw = possibleDate;
            } else {
                console.warn('No valid booked date found for booking:', b.id, b.businessName);
                bookedDateRaw = new Date().toISOString().split('T')[0];
            }
        } else {
            console.warn('No valid booked date field found for booking:', b.id, b.businessName);
            bookedDateRaw = new Date().toISOString().split('T')[0];
        }
        
        const bookedDate = formatDateForExcel(bookedDateRaw);

        // Secret trick for Excel: wrapping in =" " forces it to be TEXT
        // This prevents 04... becoming 4.5E+08 and dates becoming ####
        const forceText = (val: string) => `="${val}"`;

        return [
            clean(b.vendor?.name || 'System'),
            clean(b.clientWebsite || ''),
            clean(b.clientEmail || ''),
            forceText(bookedDate),           
            forceText(`${apptDate} ${b.time}`), 
            clean(b.status.toUpperCase()),
            clean(b.callerName || ''),
            clean(b.businessName),
            clean(b.clientName),
            clean(b.region),
            clean(b.address || ''),
            forceText(clean(b.clientPhone || '')), 
            clean(b.bdmNote || b.notes || '')
        ].join(','); // Standard CSV comma
    });

    // 4. Construct Final Content with UTF-8 BOM (Essential for Excel to see the encoding)
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
