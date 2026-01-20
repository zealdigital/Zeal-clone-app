
import React from 'react';
import type { NotificationPreferences } from '../types';

interface NotificationSettingsProps {
    preferences: NotificationPreferences;
    onChange: (newPrefs: NotificationPreferences) => void;
    role: 'manager' | 'vendor' | 'bdm';
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ preferences, onChange, role }) => {
    const handleToggle = (key: keyof NotificationPreferences) => {
        onChange({ ...preferences, [key]: !preferences[key] });
    };

    const Toggle = ({ label, propKey }: { label: string, propKey: keyof NotificationPreferences }) => (
        <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-700">{label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={preferences[propKey]} onChange={() => handleToggle(propKey)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    );

    return (
        <div className="space-y-1">
            {role === 'manager' && (
                <>
                    <Toggle label="New Booking Alerts" propKey="newBooking" />
                    <Toggle label="BDM Booking Requests" propKey="bookingRequest" />
                    <Toggle label="SMS Requests from Calling Teams" propKey="smsRequest" />
                    <Toggle label="BDM Status Updates (Sold/Seen)" propKey="bdmStatusUpdate" />
                </>
            )}
            {role === 'vendor' && (
                <>
                    <Toggle label="Booking Confirmations" propKey="newBooking" />
                    <Toggle label="Status Updates (Seen/Sold/etc)" propKey="statusChange" />
                    <Toggle label="SMS Sent Confirmation" propKey="smsSent" />
                </>
            )}
            {role === 'bdm' && (
                <>
                    <Toggle label="New Assignment Alerts" propKey="newAssignment" />
                    <Toggle label="Request Decision (Approve/Reject)" propKey="requestDecision" />
                </>
            )}
            {/* Common or cross-role notifications can go here if needed */}
        </div>
    );
};

export default NotificationSettings;
