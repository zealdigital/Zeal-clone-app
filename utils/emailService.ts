import type { Booking } from '../types';

/**
 * BACKEND CONFIGURATION
 * Update this URL to match your hosted backend (e.g., https://your-backend-api.com)
 */
const BACKEND_API_URL = "https://zeal-crm-backend.vercel.app"; 

/**
 * Sends a lead booking notification via custom backend
 */
export const sendEmailNotification = async (toEmail: string, subject: string, booking: Partial<Booking>, message: string) => {
    const finalRecipient = toEmail || "pia@zealdigital.com.au";
    
    const timeParts = (booking.time || '').split(' ');
    const timeVal = timeParts[0] || 'N/A';
    const ampmVal = timeParts[1] || '';

    const payload = {
        to_email: finalRecipient,
        subject: subject,
        calling_team: booking.vendor?.name || booking.callerName || 'N/A',
        region: booking.region || 'N/A',
        client_name: booking.clientName || 'N/A',
        business_name: booking.businessName || 'N/A',
        phone: booking.clientPhone || 'N/A',
        website: booking.clientWebsite || 'N/A',
        address: booking.address || 'N/A',
        date: booking.date || 'N/A',
        time: timeVal,
        ampm: ampmVal,
        notes: message || booking.notes || booking.bdmNote || 'No additional notes provided.'
    };

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/send-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Notification sent`);
        } else {
            const errData = await response.json();
            throw new Error(errData.error || 'Server error');
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
    }
};

/**
 * Sends a password reset email via custom backend
 */
export const sendPasswordResetEmail = async (email: string, passwordInfo: string) => {
    const payload = {
        email: email,
        message: passwordInfo
    };

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/send-recovery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Recovery email sent to ${email}`);
        } else {
            const errData = await response.json();
            throw new Error(errData.error || 'Server error');
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
        showToast("Error sending recovery email");
    }
};

const showToast = (msg: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl z-[9999] text-xs animate-bounceIn flex items-center gap-2 border border-white/10';
    toast.innerHTML = `<span>📧</span> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-500');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
};
