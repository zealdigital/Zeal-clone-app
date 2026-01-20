import React from 'react';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (range: { startDate: string | null; endDate: string | null }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onDateChange }) => {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange({ startDate: e.target.value || null, endDate });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange({ startDate, endDate: e.target.value || null });
  };
  
  const handleClear = () => {
    onDateChange({ startDate: null, endDate: null });
  };

  return (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date Range</label>
        <div className="flex items-center gap-2">
            <input
                type="date"
                value={startDate || ''}
                onChange={handleStartDateChange}
                className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
            <span className="text-gray-500">to</span>
            <input
                type="date"
                value={endDate || ''}
                onChange={handleEndDateChange}
                className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                min={startDate || ''}
            />
            <button 
                onClick={handleClear}
                className="px-3 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
                Clear
            </button>
        </div>
    </div>
  );
};

export default DateRangePicker;
