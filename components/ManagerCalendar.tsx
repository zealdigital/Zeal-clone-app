
import React, { useState, useMemo, useEffect } from 'react';
import type { ManagerAppointment, Booking } from '../types';
import { PlusIcon, BellIcon, TrashIcon, PencilSquareIcon, UserGroupIcon } from './Icons';
import ManagerAppointmentModal from './ManagerAppointmentModal';
import { normalizeWebsite, getFullUrl } from '../utils/urlUtils';

interface ManagerCalendarProps {
  appointments: ManagerAppointment[];
  setAppointments: React.Dispatch<React.SetStateAction<ManagerAppointment[]>>;
  bookings: Booking[];
}

type CalendarItem = 
  | { type: 'appointment'; data: ManagerAppointment; sortTime: number }
  | { type: 'booking'; data: Booking; sortTime: number };

const ManagerCalendar: React.FC<ManagerCalendarProps> = ({ appointments, setAppointments, bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<ManagerAppointment | null>(null);
  
  // State for Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointment: ManagerAppointment } | null>(null);

  // Close context menu on global click
  const closeContextMenu = () => setContextMenu(null);

  // Helper to get YYYY-MM-DD string from a Date object without timezone shifts
  const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse time string "10:00 AM" to minutes from midnight
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

    // 1. Process Personal Appointments (Using safe local date parsing)
    appointments.forEach(app => {
      const appDate = new Date(app.start);
      const dateKey = getDateKey(appDate);
      if (!map.has(dateKey)) map.set(dateKey, []);
      
      const minutes = appDate.getHours() * 60 + appDate.getMinutes();
      map.get(dateKey)!.push({ type: 'appointment', data: app, sortTime: minutes });
    });

    // 2. Process Client Bookings (Record already stores YYYY-MM-DD string)
    bookings.forEach(b => {
        const dateKey = b.date; 
        if (!map.has(dateKey)) map.set(dateKey, []);
        
        const minutes = parseTimeStringToMinutes(b.time);
        map.get(dateKey)!.push({ type: 'booking', data: b, sortTime: minutes });
    });

    // 3. Sort each day by time
    map.forEach(list => {
        list.sort((a, b) => a.sortTime - b.sortTime);
    });

    return map;
  }, [appointments, bookings]);

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    }
  };
  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
       setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    }
  };
  const handleToday = () => setCurrentDate(new Date());

  const openAddModal = (day: Date) => {
    setSelectedDay(day);
    setSelectedAppointment(null);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const openEditModal = (appointment: ManagerAppointment) => {
    setSelectedAppointment(appointment);
    setSelectedDay(null);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const handleSaveAppointment = (appointmentData: Omit<ManagerAppointment, 'id'>) => {
    if (selectedAppointment) {
      setAppointments(prev => prev.map(app => app.id === selectedAppointment.id ? { ...app, ...appointmentData } : app));
    } else {
      const newAppointment: ManagerAppointment = { id: Date.now(), ...appointmentData };
      setAppointments(prev => [...prev, newAppointment]);
    }
    setIsModalOpen(false);
  };
  
  const handleDeleteAppointment = (id: number) => {
      setAppointments(prev => prev.filter(app => app.id !== id));
      setIsModalOpen(false);
      closeContextMenu();
  };

  // Right Click Handler
  const handleContextMenu = (e: React.MouseEvent, appointment: ManagerAppointment) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          appointment
      });
  };

  const renderMonthView = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    return (
      <div className="grid grid-cols-7 gap-px border-l border-t border-gray-200 bg-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600 bg-gray-50">{day}</div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => <div key={`empty-start-${i}`} className="bg-gray-50 min-h-28"></div>)}
        {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
          const dayNum = dayIndex + 1;
          const fullDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
          const dateKey = getDateKey(fullDate);
          const dayItems = mixedItemsByDate.get(dateKey) || [];
          const isToday = getDateKey(new Date()) === dateKey;

          return (
            <div key={dayNum} className="bg-white p-1.5 min-h-28 relative group">
              <time dateTime={dateKey} className={`text-xs font-bold ${isToday ? 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'}`}>{dayNum}</time>
              <button onClick={() => openAddModal(fullDate)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-full p-1 hover:bg-indigo-600 z-10">
                <PlusIcon className="w-4 h-4" />
              </button>
              <div className="mt-1 space-y-1 overflow-y-auto max-h-24 relative">
                {dayItems.map((item, idx) => {
                  if (item.type === 'appointment') {
                      const app = item.data;
                      return (
                        <div 
                            key={`app-${app.id}`} 
                            onClick={() => openEditModal(app)} 
                            onContextMenu={(e) => handleContextMenu(e, app)}
                            className="w-full text-left text-xs p-1 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200 cursor-pointer group relative select-none border border-indigo-200"
                        >
                            <div className="flex items-start justify-between gap-1 pr-5">
                            <p className="font-semibold break-words truncate">
                                {new Date(app.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} {app.title}
                            </p>
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                                {app.location && <span role="img" aria-label="location" title={app.location}>📍</span>}
                                {app.reminder && <span title="Reminder set"><BellIcon className="w-3 h-3 text-amber-600" /></span>}
                            </div>
                        </div>
                      );
                  } else {
                      const booking = item.data;
                      const isVic = booking.region === 'VIC';
                      const isNsw = booking.region === 'NSW';
                      const styleClass = isNsw 
                        ? 'bg-green-50 text-green-900 border-green-200' 
                        : isVic 
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : 'bg-purple-50 text-purple-900 border-purple-200';

                      return (
                          <div 
                            key={`bk-${booking.id}`}
                            className={`w-full text-left text-xs p-1 rounded border ${styleClass} select-none shadow-sm`}
                            title={`${booking.clientName} (${booking.businessName}) - ${booking.region} [${booking.status}]`}
                          >
                              <div className="flex items-center gap-1 overflow-hidden">
                                  <UserGroupIcon className="w-3 h-3 opacity-50 flex-shrink-0" />
                                  <span className="font-mono font-bold text-[10px] flex-shrink-0">{booking.time.split(' ')[0]}</span>
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
                  }
                })}
              </div>
            </div>
          );
        })}
        {Array.from({ length: (7 - (startDay + daysInMonth) % 7) % 7 }).map((_, i) => <div key={`empty-end-${i}`} className="bg-gray-50 min-h-28"></div>)}
      </div>
    );
  };
  
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        return day;
    });

    return (
       <div className="border-t border-gray-200">
            {weekDays.map(day => {
                const dateKey = getDateKey(day);
                const dayItems = mixedItemsByDate.get(dateKey) || [];
                const today = new Date();
                const isToday = dateKey === getDateKey(today);

                return (
                    <div key={dateKey} className="flex flex-col md:grid md:grid-cols-12 border-b border-gray-200">
                        <div className={`md:col-span-2 p-3 border-b md:border-b-0 md:border-r border-gray-200 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                           <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                               <p className={`text-sm font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                               <p className={`text-2xl font-bold ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>{day.getDate()}</p>
                           </div>
                        </div>
                        <div className="md:col-span-10 p-3 space-y-2 relative group min-h-[80px]">
                            {dayItems.length > 0 ? dayItems.map((item, idx) => {
                                if (item.type === 'appointment') {
                                    const app = item.data;
                                    return (
                                        <div 
                                            key={`app-${app.id}`} 
                                            onClick={() => openEditModal(app)}
                                            onContextMenu={(e) => handleContextMenu(e, app)}
                                            className="w-full text-left p-2 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors cursor-pointer relative group/item select-none border border-indigo-200"
                                        >
                                            <div className="flex items-center justify-between">
                                            <p className="font-semibold text-indigo-900">{app.title}</p>
                                            <div className="flex items-center gap-2">
                                                {app.reminder && <span title={`Reminder set for ${new Date(app.reminder).toLocaleString()}`}><BellIcon className="w-4 h-4 text-amber-600 flex-shrink-0" /></span>}
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if(window.confirm('Delete this appointment?')) handleDeleteAppointment(app.id); 
                                                    }}
                                                    className="opacity-0 group-hover/item:opacity-100 p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-opacity bg-white/50"
                                                    title="Delete Appointment"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            </div>
                                            <p className="text-xs text-indigo-800">{new Date(app.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            {app.location && <p className="text-xs text-gray-600 mt-1 truncate flex items-center gap-1.5"><span role="img" aria-label="location">📍</span> {app.location}</p>}
                                            {app.description && <p className="text-xs text-gray-600 mt-1 truncate">{app.description}</p>}
                                        </div>
                                    );
                                } else {
                                    const booking = item.data;
                                    const isVic = booking.region === 'VIC';
                                    const isNsw = booking.region === 'NSW';
                                    const styleClass = isNsw 
                                        ? 'bg-green-50 text-green-900 border-green-200' 
                                        : isVic 
                                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                                            : 'bg-purple-50 text-purple-900 border-purple-200';
                                    
                                    return (
                                        <div 
                                            key={`bk-${booking.id}`}
                                            className={`w-full text-left p-2 rounded-lg border ${styleClass} select-none shadow-sm`}
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
                                                <div className="text-xs flex items-center gap-1 opacity-60" title="Client Booking">
                                                    <UserGroupIcon className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            }) : (
                                <p className="text-sm text-gray-400 h-full flex items-center justify-center pt-2">No schedule.</p>
                            )}
                            <button onClick={() => openAddModal(day)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-full p-1.5 hover:bg-indigo-600">
                                <PlusIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )
            })}
       </div>
    );
  };
  
  const getHeaderDateString = () => {
    if (viewMode === 'month') {
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    }
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endOfWeek.getFullYear()}`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">My Calendar</h2>
          <p className="text-sm text-gray-500">Overview of your personal tasks and all client bookings.</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-shrink-0 border border-gray-200 rounded-lg p-1 flex">
                <button onClick={() => setViewMode('month')} className={`w-full sm:w-auto px-3 py-1 text-sm font-semibold rounded-md ${viewMode === 'month' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>Month</button>
                <button onClick={() => setViewMode('week')} className={`w-full sm:w-auto px-3 py-1 text-sm font-semibold rounded-md ${viewMode === 'week' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>Week</button>
            </div>
            <div className="flex items-center gap-2 justify-center">
                <button onClick={handlePrev} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50">&lt;</button>
                <button onClick={handleToday} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hidden sm:block">Today</button>
                <span className="text-md font-semibold text-gray-700 w-48 text-center">{getHeaderDateString()}</span>
                <button onClick={handleNext} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50">&gt;</button>
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

      {/* Custom Context Menu */}
      {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContextMenu}></div>
            <div 
                className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1 w-48 animate-fadeIn"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <button 
                    onClick={() => {
                        openEditModal(contextMenu.appointment);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                    <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                    Edit
                </button>
                <button 
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this appointment?')) {
                            handleDeleteAppointment(contextMenu.appointment.id);
                        } else {
                            closeContextMenu();
                        }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                    <TrashIcon className="w-4 h-4 text-red-500" />
                    Delete
                </button>
            </div>
          </>
      )}
    </div>
  );
};

export default ManagerCalendar;
