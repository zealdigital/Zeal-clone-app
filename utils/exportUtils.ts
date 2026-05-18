import type { Booking } from '../types';

export const exportBookingsToCSV = (bookings: Booking[], filename: string) => {
    if (!bookings || bookings.length === 0) {
        alert('No data to export.');
        return;
    }

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

    const rows = bookings.map(b => {
        const clean = (val: any) => {
            if (val === undefined || val === null) return '';
            return String(val)
                .replace(/,/g, ';')
                .replace(/\n/g, ' ')
                .replace(/\r/g, '')
                .replace(/\t/g, ' ')
                .replace(/"/g, "'");
        };

        const apptDate = formatDateForExcel(b.date);
        
        // FIX: Try to get booked date from multiple sources
        let bookedDateRaw = '';
        
        // Check if booking has a createdAt field
        if ((b as any).createdAt) {
            bookedDateRaw = (b as any).createdAt;
        } 
        // Check if booking has a bookedDate field
        else if ((b as any).bookedDate) {
            bookedDateRaw = (b as any).bookedDate;
        }
        // Fallback: Use ID as timestamp (assuming it's a Unix timestamp)
        else if (b.id && typeof b.id === 'number' && b.id > 1000000000000) {
            // ID looks like a Unix timestamp (milliseconds since 1970)
            const dateFromId = new Date(b.id).toISOString().split('T')[0];
            const year = parseInt(dateFromId.split('-')[0]);
            // Check if year is reasonable (2020-2030)
            if (year >= 2020 && year <= 2030) {
                bookedDateRaw = dateFromId;
            } else {
                bookedDateRaw = new Date().toISOString().split('T')[0];
            }
        }
        else {
            // Last resort: use current date
            console.warn('Cannot determine booked date for booking:', b.id, b.businessName);
            bookedDateRaw = new Date().toISOString().split('T')[0];
        }
        
        const bookedDate = formatDateForExcel(bookedDateRaw);
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
            clean((b as any).bdmNote || b.notes || '')
        ].join(',');
    });

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
