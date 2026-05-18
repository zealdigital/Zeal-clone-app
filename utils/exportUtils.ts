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
        
        // Use the createdAt field that was added to the Booking type
        // Fallback to current date if createdAt is missing (for existing bookings)
        const bookedDateRaw = b.createdAt || new Date().toISOString().split('T')[0];
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
