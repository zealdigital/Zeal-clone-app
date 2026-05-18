import type { REGIONS } from './constants';

export interface NotificationPreferences {
    newBooking: boolean;      // Manager: When vendor adds booking
    statusChange: boolean;    // Vendor: When status changes (e.g. Approved, Seen)
    bookingRequest: boolean;  // Manager: When BDM requests
    requestDecision: boolean; // BDM: When Manager approves/rejects
    smsRequest: boolean;      // Manager: When vendor requests SMS
    smsSent: boolean;         // Vendor: When manager sends SMS
    bdmStatusUpdate: boolean; // Manager: When BDM updates status (Sold/Seen)
    newAssignment: boolean;   // BDM: When Manager assigns a booking
}

export interface Vendor {
  id: number;
  name: string;
  username: string;
  password?: string;
  active?: boolean;
  recoveryEmail?: string; // Kept for types consistency, but UI hidden for Manager editing
  email?: string; // Contact email for notifications
  notificationPreferences?: NotificationPreferences;
  allowedRegions?: Region[]; // New field: Restrict access to specific regions
}

export interface Manager {
  id: number;
  name: string;
  username: string;
  password?: string;
  active?: boolean;
  recoveryEmail?: string;
  email?: string;
  notificationPreferences?: NotificationPreferences;
}

export interface BDM {
  id: number;
  name: string;
  region: Region;
  username: string;
  password?: string;
  active?: boolean;
  recoveryEmail?: string;
  email?: string;
  notificationPreferences?: NotificationPreferences;
}

export type User = (Vendor & { role: 'vendor' }) | (Manager & { role: 'manager' }) | (BDM & { role: 'bdm' });


export type Region = string;

export interface Branding {
    companyName: string;
    logoUrl?: string; // Base64 string for the image
    primaryColor: string; // Hex code (e.g., #4F46E5)
}

export interface Booking {
  id: number;
  createdAt: string; // YYYY-MM-DD format - when the booking was created/imported
  clientName: string;
  businessName: string;
  clientWebsite: string;
  clientPhone: string;
  clientEmail?: string; // New field for email duplicate checking
  address: string;
  callerName: string;
  date: string; // YYYY-MM-DD format (Appointment date)
  time: string; // HH:MM AM/PM format
  vendor: Vendor;
  region: Region;
  notes?: string; // New field for additional notes
  isBlocker?: boolean;
  parentBookingId?: number;
  customReason?: string;
  bdmId?: number;
  status: 'active' | 'rejected' | 'seen' | 'rescheduled' | 'cancelled' | 'dq' | 'sold' | 'rescheduled_bdm' | 'pending_approval';
  rejectionReason?: string;
  rejectedBy?: string; // Manager's name
  bdmNote?: string;
  bdmPrivateNote?: string;
  bdmReminder?: string; // ISO string for datetime-local
  isDuplicate?: boolean;
  duplicateOfBookingId?: number;
  // SMS Request Feature
  smsRequest?: {
    type: 'Address Confirmation' | 'Time Confirmation' | 'General Reminder' | 'Custom';
    message?: string; // Optional custom note from vendor
    status: 'pending' | 'sent';
    requestedAt: string; // ISO Date
    sentAt?: string;
  };
}

export interface LeaveDay {
  id: number;
  date: string; // YYYY-MM-DD format
  region: Region;
  reason: string;
  bdmId: number;
  bdmName: string;
  slots?: string[]; // If undefined or empty, it's for the whole day.
}

export interface PublicHoliday {
  id: number;
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
  name: string;      // Name of the holiday/event
  regions: Region[];
}

export interface AppointmentSlotsConfig {
  base: string[];
  overrides: {
    // dayOfWeek is 0 (Sun) to 6 (Sat)
    dayOfWeek: Partial<Record<number, string[]>>;
    // date is 'YYYY-MM-DD'
    date: Record<string, string[]>;
  }
}

export interface Notification {
  id: number;
  vendorId: number;
  bookingId: number;
  message: string;
  read: boolean;
  timestamp: string; // ISO string
}

export interface ManagerAppointment {
  id: number;
  title: string;
  description: string;
  start: string; // ISO string for start datetime
  end: string;   // ISO string for end datetime
  location?: string;
  reminder?: string; // ISO string for reminder datetime
}

// Define a type for the persisted state
export interface PersistedState {
  allBookings: Booking[];
  publicHolidays: PublicHoliday[];
  appointmentTimes: Record<Region, AppointmentSlotsConfig>;
  leaveDays: LeaveDay[];
  bdms: BDM[];
  vendors: Vendor[];
  managers: Manager[]; 
  notifications: Notification[];
  managerAppointments: ManagerAppointment[];
  branding: Branding;
  regions: Region[];
  regionColors: Record<string, string>;
}
