import React, { useState, useMemo } from 'react';
import type { Booking, User, ManagerAppointment, Region, PublicHoliday, LeaveDay, AppointmentSlotsConfig } from '../types';
import { PlusIcon, UserGroupIcon, BellIcon, TrashIcon, ClockIcon } from './Icons';
import ManagerAppointmentModal from './ManagerAppointmentModal';
import { formatDateForStorage } from '../utils/dateUtils';
import { getAppointmentSlotsForDay } from '../utils/slotUtils';
import { normalizeWebsite, getFullUrl } from '../utils/urlUtils';

interface UnifiedCalendarProps {
  bookings: Booking[];
  currentUser: User;
  onUpdateStatus?: (booking: Booking) => void;
  appointments?: ManagerAppointment[];
  setAppointments?: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
  // Availability Props
  allBookingsForAvailability?: Booking[];
  salespeopleCount?: Record<Region, number>;
  publicHolidays?: PublicHoliday[];
  appointmentTimes?: Record<Region, AppointmentSlotsConfig>;
  leaveDays?: LeaveDay[];
  region?: Region;
}

type CalendarItem = 
  | { type: 'appointment'; data: ManagerAppointment; sortTime: number }
  | { type: 'booking'; data: Booking; sortTime: number };

// Helper to check if a date is a weekend (Saturday or Sunday)
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

const UnifiedCalendar: React.FC<UnifiedCalendarProps> = ({ 
  bookings, 
  currentUser, 
  appointments = [], 
  setAppointments,
  allBookingsForAvailability = [],
  salespeopleCount = {},
  publicHolidays = [],
  appointmentTimes = {},
  leaveDays = [],
  region
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<ManagerAppointment | null>(null);

  // Helper to get YYYY-MM-DD string from a Date object without timezone shifts
  const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseTimeStringToMinutes = (timeStr: string) => {
    try {
      const [t, mod] = timeStr.split(' ');
      let [h, m] = t.split(':').map(Number);
      if (mod === 'PM' && h !== 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    } catch (e) {
      return 0;
    }
  };

  const mixedItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    // 1. Process Client Bookings (Using exact date string from record)
    bookings.forEach(b => {
      const dateKey = b.date; // Record already stores YYYY-MM-DD
      if (!map.has(dateKey)) map.set(dateKey, []);
      const minutes = parseTimeStringToMinutes(b.time);
      map.get(dateKey)!.push({ type: 'booking', data: b, sortTime: minutes });
    });

    // 2. Process Personal Reminders/Appointments
    appointments.forEach(app => {
      const appDate = new Date(app.start);
      const dateKey = getDateKey(appDate);
      if (!map.has(dateKey)) map.set(dateKey, []);
      const minutes = appDate.getHours() * 60 + appDate.getMinutes();
      map.get(dateKey)!.push({ type: 'appointment', data: app, sortTime: minutes });
    });

    map.forEach(list => list.sort((a, b) => a.sortTime - b.sortTime));
    return map;
  }, [bookings, appointments]);

  // Global availability logic
  const getDayAvailability = (date: Date) => {
    if (!region || !appointmentTimes[region]) return null;
    const normalizedRegion = region.trim().toUpperCase();
    const bdmCount = salespeopleCount[normalizedRegion] || 0;
    
    const dateStr = formatDateForStorage(date);
    const slots = getAppointmentSlotsForDay(date, region, appointmentTimes);
    const occupiedStatuses = ['active', 'seen', 'rescheduled_bdm', 'pending_approval', 'sold'];
    const dayBookings = allBookingsForAvailability.filter(b => 
        b.date === dateStr && 
        b.region.trim().toUpperCase() === normalizedRegion && 
        occupiedStatuses.includes(b.status)
    );
    
    let totalCapacity = 0;
    let totalBooked = 0;

    const dayLeaves = leaveDays.filter(l => l.date === dateStr && l.region === region);

    const slotBreakdown: { time: string; capacity: number; booked: number; free: number }[] = [];

    slots.forEach(slot => {
        const allDayLeaves = dayLeaves.filter(l => !l.slots || l.slots.length === 0).length;
        const slotLeaves = dayLeaves.filter(l => l.slots?.includes(slot)).length;
        const capacityForSlot = Math.max(0, bdmCount - (allDayLeaves + slotLeaves));
        
        const bookedInSlot = dayBookings.filter(b => b.time === slot).length;
        
        totalCapacity += capacityForSlot;
        totalBooked += bookedInSlot;
        slotBreakdown.push({ time: slot, capacity: capacityForSlot, booked: bookedInSlot, free: Math.max(0, capacityForSlot - bookedInSlot) });
    });

    return { totalCapacity, totalBooked, free: Math.max(0, totalCapacity - totalBooked), slotBreakdown };
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setDate(newDate.getDate() - 5); // Changed from 7 to 5 days for week view (weekdays only)
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setDate(newDate.getDate() + 5); // Changed from 7 to 5 days for week view (weekdays only)
    setCurrentDate(newDate);
  };

  const handleToday = () => setCurrentDate(new Date());

  const openAddModal = (day: Date) => {
    if (!setAppointments) return;
    setSelectedDay(day);
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (appointment: ManagerAppointment) => {
    if (!setAppointments) return;
    setSelectedAppointment(appointment);
    setSelectedDay(null);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (appointmentData: Omit<ManagerAppointment, 'id'>) => {
    if (!setAppointments) return;
    if (selectedAppointment) {
      setAppointments(prev => prev.map(app => app.id === selectedAppointment.id ? { ...app, ...appointmentData } : app));
    } else {
      const newAppointment: ManagerAppointment = { id: Date.now(), ...appointmentData };
      setAppointments(prev => [...prev, newAppointment]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteAppointment = (id: number) => {
    if (!setAppointments) return;
    setAppointments(prev => prev.filter(app => app.id !== id));
    setIsModalOpen(false);
  };

  const getHeaderDateString = () => {
    if (viewMode === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // Weekdays only view
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Start from Monday
    // Adjust to skip weekends
    if (isWeekend(startOfWeek)) {
      startOfWeek.setDate(startOfWeek.getDate() + (startOfWeek.getDay() === 6 ? 2 : 1));
    }
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // 5 weekdays (Mon-Fri)
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endOfWeek.getFullYear()}`;
  };

      const renderMonthView = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    // Helper to check if a date is a weekend
    const isWeekendDate = (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6;
    };

    // Create array of all days in month (including padding for start and end)
    const daysArray: (Date | null)[] = [];
    
    // Add padding days for start of month (Sunday to Saturday)
    for (let i = 0; i < startDay; i++) {
      daysArray.push(null);
    }
    
    // Add actual days of month
    for (let i = 1; i <= daysInMonth; i++) {
      daysArray.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }
    
    // Add padding days for end of month to complete grid
    const remainingCells = (7 - (daysArray.length % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
      daysArray.push(null);
    }

    return (
      <div className="grid grid-cols-7 gap-px border-l border-t border-gray-200 bg-gray-200">
        {/* Day headers: Sun, Mon, Tue, Wed, Thu, Fri, Sat */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600 bg-gray-50">{day}</div>
        ))}
        
        {/* Calendar cells */}
        {daysArray.map((fullDate, idx) => {
          if (!fullDate) {
            return <div key={`empty-${idx}`} className="bg-gray-50 min-h-28"></div>;
          }
          
          const dateStr = getDateKey(fullDate);
          const dayItems = mixedItemsByDate.get(dateStr) || [];
          const isToday = getDateKey(new Date()) === dateStr;
          const dayNum = fullDate.getDate();
          const isWeekendDay = isWeekendDate(fullDate);
          const availability = isWeekendDay ? null : getDayAvailability(fullDate);

          return (
            <div key={dateStr} className={`bg-white p-1.5 min-h-32 relative group ${isWeekendDay ? 'bg-gray-50' : ''}`}>
              <div className="flex justify-between items-start">
                  <span className={`text-xs font-bold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : isWeekendDay ? 'text-gray-400' : 'text-gray-700'}`}>{dayNum}</span>
                  {!isWeekendDay && availability && (
                      <div className="relative group/avail flex flex-col items-end">
                          <div className={`text-[9px] font-black uppercase px-1 rounded cursor-help ${availability.free > 0 ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
                              {availability.free} Free
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 justify-end max-w-[75px]">
                              {availability.slotBreakdown.filter(s => s.free > 0).map(slot => (
                                  <span key={slot.time} className="text-[9px] font-bold text-green-800 bg-green-100 px-1 rounded leading-none py-1 flex items-center gap-1 border border-green-200 shadow-sm">
                                      {slot.time.replace(':00', '').replace(' ', '')}
                                      <span className="bg-green-700 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px]">{slot.free}</span>
                                  </span>
                              ))}
                          </div>
                          <div className="absolute top-full right-0 mt-1 w-24 bg-white border border-gray-200 rounded shadow-lg z-50 p-2 opacity-0 group-hover/avail:opacity-100 pointer-events-none transition-opacity">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1 border-b pb-1">Slot Availability</p>
                              {availability.slotBreakdown.map(slot => (
                                  <div key={slot.time} className="flex justify-between items-center text-[8px] py-0.5">
                                      <span className="text-gray-500">{slot.time}</span>
                                      <span className={`font-bold ${slot.free > 0 ? 'text-green-600' : 'text-red-400'}`}>{slot.free}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                  {isWeekendDay && (
                    <div className="text-[9px] font-black uppercase px-1 rounded text-gray-300 bg-gray-100">
                      Weekend
                    </div>
                  )}
              </div>
              {setAppointments && !isWeekendDay && (
                <button onClick={() => openAddModal(fullDate)} className="absolute top-6 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-full p-1 hover:bg-indigo-600 z-10">
                  <PlusIcon className="w-4 h-4" />
                </button>
              )}
              {/* SHOW ALL SLOTS - removed the .slice(0,3) limit */}
              <div className="mt-1 space-y-1 overflow-y-auto max-h-28">
                {!isWeekendDay && dayItems.length > 0 ? (
                  dayItems.map((item, idx) => {
                    if (item.type === 'booking') {
                      const booking = item.data;
                      const styleClass = booking.region === 'NSW' ? 'bg-green-50 text-green-900 border-green-200' : booking.region === 'VIC' ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-purple-50 text-purple-900 border-purple-200';
                      return (
                        <div 
                          key={`bk-${booking.id}-${idx}`} 
                          className={`w-full text-left text-[10px] p-1 rounded border ${styleClass} select-none shadow-sm`}
                          title={`${booking.clientName} (${booking.businessName}) - ${booking.region} [${booking.status.toUpperCase()}]`}
                        >
                          <div className="flex items-center gap-1 overflow-hidden">
                            <UserGroupIcon className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
                            <span className="font-mono font-bold flex-shrink-0">{booking.time.split(' ')[0]}</span>
                            <a 
                              href={getFullUrl(booking.clientWebsite)} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="truncate font-medium flex-grow hover:underline text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {normalizeWebsite(booking.clientWebsite) || booking.clientName}
                            </a>
                            <span className="text-[8px] uppercase font-bold opacity-60 flex-shrink-0">{booking.status === 'rescheduled_bdm' ? 'RESCHED' : booking.status}</span>
                          </div>
                        </div>
                      );
                    } else {
                      const app = item.data;
                      return (
                        <div key={`app-${app.id}`} onClick={() => openEditModal(app)} className="w-full text-left text-[10px] p-1 bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200 cursor-pointer truncate select-none shadow-sm">
                          {new Date(app.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} {app.title}
                        </div>
                      );
                    }
                  })
                ) : !isWeekendDay ? (
                  <div className="text-[10px] text-center text-gray-400 py-2">No appointments</div>
                ) : (
                  <div className="flex items-center justify-center h-20 text-[10px] text-gray-300 italic">
                    No appointments
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    // Start from Monday instead of Sunday
    const currentDay = startOfWeek.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(currentDate.getDate() - daysToMonday);
    
    // Generate only weekdays (Monday to Friday)
    const weekDays: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }

    return (
       <div className="border-t border-gray-200">
            {weekDays.map(day => {
                const dateKey = getDateKey(day);
                const dayItems = mixedItemsByDate.get(dateKey) || [];
                const isToday = dateKey === getDateKey(new Date());
                const availability = getDayAvailability(day);

                return (
                    <div key={dateKey} className="flex flex-col md:grid md:grid-cols-12 border-b border-gray-200">
                        <div className={`md:col-span-2 p-3 border-b md:border-b-0 md:border-r border-gray-200 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                           <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                               <p className={`text-sm font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                               <p className={`text-2xl font-bold ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>{day.getDate()}</p>
                           </div>
                           {availability && (
                               <>
                                   <div className="mt-2 flex items-center gap-1">
                                       <div className={`w-1.5 h-1.5 rounded-full ${availability.free > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                       <span className="text-[10px] font-black text-gray-500 uppercase">{availability.free} Slots Free</span>
                                   </div>
                                   <div className="mt-3 grid grid-cols-2 md:grid-cols-1 gap-1 border-t border-gray-200 pt-2">
                                       {availability.slotBreakdown.map(slot => (
                                           <div key={slot.time} className={`flex justify-between items-center text-xs px-2 py-1.5 rounded transition-all ${slot.free > 0 ? 'bg-green-50/50 border border-green-200 shadow-sm' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                                               <span className="text-gray-700 font-bold">{slot.time}</span>
                                               <span className={`font-black px-2 py-0.5 rounded-full text-[10px] ${slot.free > 0 ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}>{slot.free}</span>
                                           </div>
                                       ))}
                                   </div>
                               </>
                           )}
                        </div>
                        <div className="md:col-span-10 p-3 space-y-2 relative group min-h-[80px]">
                            {dayItems.length > 0 ? dayItems.map((item, idx) => {
                                if (item.type === 'booking') {
                                    const booking = item.data;
                                    const isNsw = booking.region === 'NSW';
                                    const isVic = booking.region === 'VIC';
                                    const styleClass = isNsw ? 'bg-green-50 text-green-900 border-green-200' : isVic ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-purple-50 text-purple-900 border-purple-200';
                                    return (
                                        <div 
                                            key={`bk-${booking.id}-${idx}`} 
                                            className={`w-full text-left p-2 rounded-lg border ${styleClass} select-none shadow-sm`}
                                            title={`${booking.clientName} (${booking.businessName}) - ${booking.region} [${booking.status.toUpperCase()}]`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="font-bold text-sm">{booking.time}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isNsw ? 'bg-green-200 text-green-800' : isVic ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'}`}>{booking.region}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-white/50 border border-black/10 text-black/70">
                                                            {booking.status === 'rescheduled_bdm' ? 'RESCHED (BDM)' : booking.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <a 
                                                        href={getFullUrl(booking.clientWebsite)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="font-semibold text-sm hover:underline text-blue-600 block"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {normalizeWebsite(booking.clientWebsite) || booking.clientName}
                                                    </a>
                                                    <p className="text-xs opacity-75">{booking.businessName}</p>
                                                </div>
                                                <div className="text-xs flex items-center gap-1 opacity-60"><UserGroupIcon className="w-4 h-4" /></div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const app = item.data;
                                    return (
                                        <div key={`app-${app.id}`} onClick={() => openEditModal(app)} className="w-full text-left p-2 bg-indigo-100 rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors cursor-pointer relative group/item select-none shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-indigo-900">{app.title}</p>
                                                <div className="flex items-center gap-2">
                                                    {app.reminder && <BellIcon className="w-4 h-4 text-amber-600" />}
                                                    <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this?')) handleDeleteAppointment(app.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-600 bg-white/50 rounded hover:bg-white"><TrashIcon className="w-3 h-3"/></button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-indigo-800">{new Date(app.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    );
                                }
                            }) : (
                                <p className="text-sm text-gray-400 h-full flex items-center justify-center pt-2">No schedule.</p>
                            )}
                            {setAppointments && (
                              <button onClick={() => openAddModal(day)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-full p-1.5 hover:bg-indigo-600 shadow-md">
                                  <PlusIcon className="w-5 h-5" />
                              </button>
                            )}
                        </div>
                    </div>
                )
            })}
       </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-100 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-black text-gray-900 tracking-tight">My Calendar</h2>
             {region && (
                 <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">{region}</span>
             )}
          </div>
          <p className="text-sm font-medium text-gray-500">Scheduled appointments and availability for your region (Mon-Fri only).</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-shrink-0 bg-gray-100 rounded-xl p-1.5 flex gap-1 border border-gray-200">
                <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'month' ? 'bg-white text-black shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>MONTH</button>
                <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white text-black shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>WEEK</button>
            </div>
            <div className="flex items-center gap-2 justify-center">
                <button onClick={handlePrev} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shadow-sm transition-all font-bold">&larr;</button>
                <button onClick={handleToday} className="px-4 py-2 text-xs font-black text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shadow-sm uppercase tracking-widest">Today</button>
                <span className="text-sm font-black text-gray-800 min-w-[140px] text-center uppercase tracking-wider">{getHeaderDateString()}</span>
                <button onClick={handleNext} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shadow-sm transition-all font-bold">&rarr;</button>
            </div>
        </div>
      </div>
      
      <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto">
        <div className="min-w-[700px] md:min-w-0">
          {viewMode === 'month' ? renderMonthView() : renderWeekView()}
        </div>
      </div>

      {isModalOpen && (
        <ManagerAppointmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          appointment={selectedAppointment}
          day={selectedDay}
        />
      )}
    </div>
  );
};

export default UnifiedCalendar;
