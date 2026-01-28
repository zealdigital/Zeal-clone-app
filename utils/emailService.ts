
import type { Booking } from '../types';

/**
 * EMAILJS CONFIGURATION
 * SERVICE_ID: service_fm5qakn
 * TEMPLATE_ID: template_erdqf7d
 * PUBLIC_KEY: FPM7pAmCikUAWGkog
 */
const EMAILJS_CONFIG = {
    SERVICE_ID: "service_fm5qakn",
    TEMPLATE_ID: "template_erdqf7d", 
    PUBLIC_KEY: "FPM7pAmCikUAWGkog",    
};

/**
 * Ensures EmailJS is loaded via script tag to avoid "Failed to fetch" dynamic import errors
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
 * Sends a real email notification via EmailJS
 */
export const sendEmailNotification = async (toEmail: string, subject: string, booking: Partial<Booking>, message: string) => {
    // Primary recipient as per request
    const targetEmail = "pia@zealdigital.com.au";

    // Split time for the template's {{time}} and {{ampm}} fields
    const timeParts = (booking.time || '').split(' ');
    const timeVal = timeParts[0] || 'N/A';
    const ampmVal = timeParts[1] || '';

    // Map fields specifically to the EmailJS template placeholders provided
    const templateParams = {
        to_email: targetEmail,
        subject: subject, // Keep subject for reference
        title: subject,   // Added for "Contact Us: {{title}}" in EmailJS Subject field
        message: message, // General context
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
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams
        );
        
        if (response.status === 200) {
            showToast(`Notification sent to Pia`);
        }
    } catch (error: any) {
        console.error("Email delivery failed:", error);
        const errorMsg = error?.text || error?.message || "Connection Error";
        showToast(`Email error: ${errorMsg.substring(0, 35)}`);
    }
};

/**
 * Diagnostic tool to verify connection
 */
export const testEmailService = () => {
    sendEmailNotification(
        "pia@zealdigital.com.au",
        "System Test: Connection Verified",
        { 
            businessName: "Test Corporation", 
            clientName: "Diagnostic Tool", 
            region: "NSW", 
            time: "10:00 AM", 
            date: "2025-01-01",
            clientPhone: "0000000000",
            clientWebsite: "test.com",
            address: "123 Test St",
            notes: "Test diagnostic run."
        },
        "The automated email notification system is linked correctly."
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
