
import React from 'react';
import { CloudArrowUpIcon } from './Icons';
import { testEmailService } from '../utils/emailService';

// Ensure the file has a default export as expected by App.tsx
const ManagerDashboard: React.FC<any> = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-normal mb-6">Diagnostic Tools</h3>
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-gray-600 mb-4">Verify that the automated email notification system is linked correctly to your Gmail account.</p>
        <button 
          onClick={(e) => { e.preventDefault(); testEmailService(); }}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 uppercase tracking-widest text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md"
        >
          {/* Use CloudArrowUpIcon from Icons.tsx */}
          <CloudArrowUpIcon className="w-4 h-4" /> Test Email Connection
        </button>
      </div>
    </div>
  );
};

export default ManagerDashboard;
