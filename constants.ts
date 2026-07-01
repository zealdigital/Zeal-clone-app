
import type { Region, Vendor, Manager, PublicHoliday, AppointmentSlotsConfig, BDM, Branding, NotificationPreferences } from './types';

// Default Calling Team account for Dharmesh
export const VENDORS: Vendor[] = [
    // { 
    //     id: 201, 
    //     name: 'Dharmesh', 
    //     username: 'dharmesh', 
    //     password: 'dharm007', 
    //     active: true,
    //     allowedRegions: ['NSW', 'VIC'],
    //     email: 'pia@zealdigital.com.au'
    // }
];

export const MANAGERS: Manager[] = [
    { id: 101, name: 'Admin Manager', username: 'manager', password: 'adminpassword', active: true }
];

// Default BDM account for Harry
export const BDMS: BDM[] = [
    // { 
    //     id: 301, 
    //     name: 'Harry', 
    //     username: 'harry', 
    //     password: 'harrypassword2025', 
    //     region: 'NSW', 
    //     active: true,
    //     email: 'pia@zealdigital.com.au'
    // }
];

export const DEFAULT_BRANDING: Branding = {
    companyName: "Zeal Digital's Caller Booking Portal",
    primaryColor: '#050505', // Updated to Rich Black as requested
};

export const APPOINTMENT_TIMES: Record<Region, AppointmentSlotsConfig> = {
    NSW: {
        base: ['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'],
        overrides: {
            dayOfWeek: {},
            date: {}
        }
    },
    VIC: {
        base: ['09:00 AM', '11:00 PM', '01:00 PM', '03:00 PM'],
        overrides: {
            dayOfWeek: {},
            date: {}
        }
    },
};


export const REGIONS = ['NSW', 'VIC'];

// Default Color Map
export const DEFAULT_REGION_COLORS: Record<string, string> = {
    NSW: '#CFE59C', // Green
    VIC: '#DBEAFE', // Blue-100 equivalent
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    newBooking: true,
    statusChange: true,
    bookingRequest: true,
    requestDecision: true,
    smsRequest: true,
    smsSent: true,
    bdmStatusUpdate: true,
    newAssignment: true
};

// Add public holidays in YYYY-MM-DD format with ranges
export const PUBLIC_HOLIDAYS: PublicHoliday[] = [
  { id: 1, startDate: '2024-12-25', endDate: '2024-12-25', name: 'Christmas Day', regions: ['NSW', 'VIC'] },
  { id: 2, startDate: '2025-01-01', endDate: '2025-01-01', name: "New Year's Day", regions: ['NSW', 'VIC'] },
  { id: 3, startDate: '2025-01-20', endDate: '2025-01-20', name: "Martin Luther King, Jr. Day", regions: ['NSW', 'VIC'] },
  { id: 4, startDate: '2025-05-26', endDate: '2025-05-26', name: "Memorial Day", regions: ['NSW', 'VIC'] },
  { id: 5, startDate: '2025-07-04', endDate: '2025-07-04', name: "Independence Day", regions: ['NSW', 'VIC'] },
  { id: 6, startDate: '2025-09-01', endDate: '2025-09-01', name: "Labor Day", regions: ['NSW', 'VIC'] },
  { id: 7, startDate: '2025-11-27', endDate: '2025-11-27', name: "Thanksgiving Day", regions: ['NSW', 'VIC'] },
];

// Pre-defined time slots for datalist suggestions (15 min intervals, 07:00 AM to 07:00 PM)
export const TIME_SLOT_SUGGESTIONS = [
    "07:00 AM", "07:15 AM", "07:30 AM", "07:45 AM",
    "08:00 AM", "08:15 AM", "08:30 AM", "08:45 AM",
    "09:00 AM", "09:15 AM", "09:30 AM", "09:45 AM",
    "10:00 AM", "10:15 AM", "10:30 AM", "10:45 AM",
    "11:00 AM", "11:15 AM", "11:30 AM", "11:45 AM",
    "12:00 PM", "12:15 PM", "12:30 PM", "12:45 PM",
    "01:00 PM", "01:15 PM", "01:30 PM", "01:45 PM",
    "02:00 PM", "02:15 PM", "02:30 PM", "02:45 PM",
    "03:00 PM", "03:15 PM", "03:30 PM", "03:45 PM",
    "04:00 PM", "04:15 PM", "04:30 PM", "04:45 PM",
    "05:00 PM", "05:15 PM", "05:30 PM", "05:45 PM",
    "06:00 PM", "06:15 PM", "06:30 PM", "06:45 PM",
    "07:00 PM"
];
