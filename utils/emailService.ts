
import type { Booking } from '../types';

/**
 * EMAILJS SETUP GUIDE:
 * 1. SERVICE_ID: Updated to service_fm5qakn
 * 2. TEMPLATE_ID: Updated to template_erdqf7d
 * 3. PUBLIC_KEY: FPM7pAmCikUAWGkog
 */
const EMAILJS_CONFIG = {
    SERVICE_ID: "service_fm5qakn",
    TEMPLATE_ID: "template_erdqf7d", 
    PUBLIC_KEY: "FPM7pAmCikUAWGkog",    
};

/**
 * Sends a real email notification via EmailJS
 */
export const sendEmailNotification = async (toEmail: string, subject: string, booking: Partial<Booking>, message: string) => {
    // Primary recipient
    const targetEmail = "pia@zealdigital.com.au";

    const templateParams = {
        to_email: targetEmail,
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
        const emailjs = await import('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/index.esm.js' as any);
        
        // Safety check for initialization
        if (EMAILJS_CONFIG.PUBLIC_KEY === "user_your_public_key") {
            console.warn("MISSING PUBLIC KEY: Please get it from EmailJS Account > API Keys.");
            showToast(`Setup: Add your Public Key to the code.`);
            return;
        }

        const response = await emailjs.default.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        
        if (response.status === 200) {
            showToast(`Notification sent to Pia`);
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
        const errorMsg = error?.text || error?.message || "Check your API keys.";
        showToast(`Email error: ${errorMsg.substring(0, 30)}...`);
    }
};

/**
 * Diagnostic tool to verify connection
 */
export const testEmailService = () => {
    sendEmailNotification(
        "pia@zealdigital.com.au",
        "System Test: Connection Verified",
        { businessName: "Test Corporation", clientName: "Diagnostic Tool" },
        "The automated email notification system is linked correctly to your Gmail account."
    );
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
