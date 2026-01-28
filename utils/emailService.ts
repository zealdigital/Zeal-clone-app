
import type { Booking } from '../types';

/**
 * EMAILJS CONFIGURATION
 */
const EMAILJS_CONFIG = {
    SERVICE_ID: "service_fm5qakn",
    BOOKING_TEMPLATE_ID: "template_erdqf7d", 
    PASSWORD_RESET_TEMPLATE_ID: "template_o5u0zln", 
    PUBLIC_KEY: "FPM7pAmCikUAWGkog",    
};

/**
 * Ensures EmailJS is loaded via script tag
 */
const loadEmailJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
        if ((window as any).emailjs) {
            resolve((window as any).emailjs);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        script.onload = () => {
            const emailjs = (window as any).emailjs;
            emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
            resolve(emailjs);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

/**
 * Sends a lead booking notification
 * @param toEmail The recipient (defaults to Pia if not specified or for manual entries)
 */
export const sendEmailNotification = async (toEmail: string, subject: string, booking: Partial<Booking>, message: string) => {
    // If toEmail is empty or generic, route to the primary admin
    const finalRecipient = toEmail || "pia@zealdigital.com.au";
    
    const timeParts = (booking.time || '').split(' ');
    const timeVal = timeParts[0] || 'N/A';
    const ampmVal = timeParts[1] || '';

    const templateParams = {
        to_email: finalRecipient,
        subject: subject,
        title: subject,
        message: message,
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
        notes: booking.notes || booking.bdmNote || 'No additional notes provided.',
        link: window.location.origin 
    };

    try {
        const emailjs = await loadEmailJS();
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.BOOKING_TEMPLATE_ID,
            templateParams
        );
        if (response.status === 200) {
            showToast(`Notification sent`);
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
    }
};

/**
 * Sends a password reset email using the simplified template structure
 */
export const sendPasswordResetEmail = async (email: string, passwordInfo: string) => {
    const templateParams = {
        email: email, // Matches {{email}} in template
        link: window.location.origin, // Matches {{link}} in template
        message: passwordInfo // Matches {{message}} in template
    };

    try {
        const emailjs = await loadEmailJS();
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.PASSWORD_RESET_TEMPLATE_ID,
            templateParams
        );
        if (response.status === 200) {
            showToast(`Recovery email sent to ${email}`);
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
