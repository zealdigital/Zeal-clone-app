
import React from 'react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const AMPM = ['AM', 'PM'];

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className = '' }) => {
  // Default values
  let hour = '10';
  let minute = '00';
  let period = 'AM';

  // Parse existing value if available
  if (value) {
    const match = value.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
    if (match) {
      hour = match[1];
      minute = match[2];
      period = match[3];
    }
  }

  const handleChange = (type: 'hour' | 'minute' | 'period', newVal: string) => {
    let h = hour;
    let m = minute;
    let p = period;

    if (type === 'hour') h = newVal;
    if (type === 'minute') m = newVal;
    if (type === 'period') p = newVal;

    onChange(`${h}:${m} ${p}`);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="relative">
          <select
            value={hour}
            onChange={(e) => handleChange('hour', e.target.value)}
            className="appearance-none block w-full bg-white border border-gray-300 hover:border-gray-400 px-3 py-2 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors cursor-pointer"
          >
            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
      </div>
      <span className="text-gray-600 font-bold px-1">:</span>
      <div className="relative">
          <select
            value={minute}
            onChange={(e) => handleChange('minute', e.target.value)}
            className="appearance-none block w-full bg-white border border-gray-300 hover:border-gray-400 px-3 py-2 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors cursor-pointer"
          >
            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
      </div>
      <div className="relative ml-2">
          <select
            value={period}
            onChange={(e) => handleChange('period', e.target.value)}
            className="appearance-none block w-full bg-white border border-gray-300 hover:border-gray-400 px-3 py-2 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors cursor-pointer"
          >
            {AMPM.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
      </div>
    </div>
  );
};

export default TimePicker;
