
import React, { useState, useEffect } from 'react';
import type { ManagerAppointment } from '../types';
import { XMarkIcon, TrashIcon } from './Icons';

interface ManagerAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Omit<ManagerAppointment, 'id'>) => void;
  onDelete: (id: number) => void;
  appointment: ManagerAppointment | null;
  day: Date | null;
}

const ManagerAppointmentModal: React.FC<ManagerAppointmentModalProps> = ({
  isOpen, onClose, onSave, onDelete, appointment, day
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: '',
    location: '',
    reminder: '',
  });

  const titleSuggestions = [
    "Review meeting",
    "Team Sync",
    "Strategy Session",
    "Client Call",
    "Interview",
    "Performance Review",
    "Training"
  ];

  const locationSuggestions = [
    "Boardroom",
    "Zoom",
    "Office",
    "Teams",
    "Meeting Room 1",
    "Meeting Room 2"
  ];

  // Helper to format Date to YYYY-MM-DDTHH:mm (Local Time)
  const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isOpen) {
      if (appointment) {
        // Editing: Convert stored UTC ISO string back to Local ISO string for the input
        const startDate = new Date(appointment.start);
        const reminderDate = appointment.reminder ? new Date(appointment.reminder) : null;
        
        setFormData({
          title: appointment.title,
          description: appointment.description,
          start: toLocalISOString(startDate),
          location: appointment.location || '',
          reminder: reminderDate ? toLocalISOString(reminderDate) : '',
        });
      } else if (day) {
        // Adding: Use the passed day, set to 09:00 AM local time
        const defaultStartTime = new Date(day);
        defaultStartTime.setHours(9, 0, 0, 0);
        
        setFormData({
          title: '',
          description: '',
          start: toLocalISOString(defaultStartTime),
          location: '',
          reminder: '',
        });
      }
    }
  }, [appointment, day, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.start) {
      alert('Please fill in a title and start time.');
      return;
    }

    // Auto-calculate End Time (Start Time + 1 Hour)
    const startDate = new Date(formData.start);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour

    onSave({
      title: formData.title,
      description: formData.description,
      location: formData.location || undefined,
      start: startDate.toISOString(), // Store as UTC
      end: endDate.toISOString(),     // Store as UTC
      reminder: formData.reminder ? new Date(formData.reminder).toISOString() : undefined,
    });
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    // CRITICAL: Prevent form submission
    e.preventDefault();
    e.stopPropagation();
    
    if (appointment && appointment.id) {
        if (window.confirm('Are you sure you want to delete this appointment?')) {
            onDelete(appointment.id);
        }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">{appointment ? 'Edit Appointment' : 'Add Appointment'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <datalist id="titleSuggestions">
              {titleSuggestions.map(opt => <option key={opt} value={opt} />)}
            </datalist>
            <datalist id="locationSuggestions">
              {locationSuggestions.map(opt => <option key={opt} value={opt} />)}
            </datalist>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
              <input 
                type="text" 
                name="title" 
                id="title" 
                value={formData.title} 
                onChange={handleChange} 
                list="titleSuggestions"
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                placeholder="e.g., Review meeting" 
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location (Optional)</label>
              <input 
                type="text" 
                name="location" 
                id="location" 
                value={formData.location} 
                onChange={handleChange} 
                list="locationSuggestions"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                placeholder="e.g., Boardroom" 
              />
            </div>

            <div>
              <label htmlFor="start" className="block text-sm font-medium text-gray-700">Start Time</label>
              <input 
                type="datetime-local" 
                name="start" 
                id="start" 
                value={formData.start} 
                onChange={handleChange} 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
              />
              <p className="mt-1 text-xs text-gray-500">Duration defaults to 1 hour.</p>
            </div>
            
             <div>
              <label htmlFor="reminder" className="block text-sm font-medium text-gray-700">Set Reminder (Optional)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="datetime-local"
                  name="reminder"
                  id="reminder"
                  value={formData.reminder}
                  onChange={handleChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button type="button" onClick={() => setFormData(f => ({...f, reminder: ''}))} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
              <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
             {appointment ? (
                <button 
                    type="button" 
                    onClick={handleDelete} 
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    <TrashIcon className="w-4 h-4" /> Delete
                </button>
             ) : (
                 <div /> // Spacer
             )}
             <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">Save Appointment</button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagerAppointmentModal;
