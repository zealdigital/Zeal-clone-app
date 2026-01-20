
import type { Booking } from '../types';

/**
 * EMAILJS SETUP GUIDE:
 * 1. SERVICE_ID: service_xyfrsfy
 * 2. TEMPLATE_ID: template_notification
 * 3. PUBLIC_KEY: FPM7pAmCikUAWGkog
 */
const EMAILJS_CONFIG = {
    SERVICE_ID: "service_xyfrsfy",
    TEMPLATE_ID: "template_notification", 
    PUBLIC_KEY: "FPM7pAmCikUAWGkog",    
};

/**
 * Sends a real email notification via EmailJS
 */
export const sendEmailNotification = async (toEmail: string, subject: string, booking: Partial<Booking>, message: string) => {
    // Primary recipient as per request, but we also pass the 'toEmail' to the template
    const primaryRecipient = "pia@zealdigital.com.au";

    const templateParams = {
        to_email: toEmail || primaryRecipient,
        cc_email: primaryRecipient,
        subject: subject,
        message: message,
        business_name: booking.businessName || 'N/A',
        client_name: booking.clientName || 'N/A',
        date: booking.date || 'N/A',
        time: booking.time || 'N/A',
        region: booking.region || 'N/A',
        link: window.location.origin 
    };

    try {
        // Access emailjs from the window object (loaded in index.html)
        const emailjs = (window as any).emailjs;
        
        if (!emailjs) {
            console.error("EmailJS SDK not loaded yet.");
            return;
        }

        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        
        if (response.status === 200) {
            console.log("Email sent successfully");
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
        showToast(`Email Error: ${error?.text || 'Network error'}`);
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
