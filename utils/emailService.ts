
import type { Booking } from '../types';

/**
 * EMAILJS CONFIGURATION
 * Note: Using the specific Template ID provided by the user: template_erdqf7d
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
    const primaryRecipient = "pia@zealdigital.com.au";
    
    const cleanString = (str: string) => str ? String(str).replace(/[^\x20-\x7E]/g, "").trim() : "";

    const templateParams = {
        to_email: toEmail || primaryRecipient,
        from_name: "Zeal Booking Portal",
        to_name: "Admin/Team",
        subject: cleanString(subject),
        message: cleanString(message), 
        business_name: cleanString(booking.businessName || 'N/A'),
        client_name: cleanString(booking.clientName || 'N/A'),
        appointment_date: booking.date || 'N/A',
        appointment_time: booking.time || 'N/A',
        region: booking.region || 'N/A',
        reply_to: primaryRecipient
    };

    try {
        const emailjs = (window as any).emailjs;
        if (!emailjs) throw new Error("EmailJS SDK not loaded");

        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        
        if (response.status === 200) {
            console.log("EmailJS Success:", response.text);
        }
    } catch (error: any) {
        console.error("EMAILJS ERROR:", error);
        const errorMsg = error?.text || error?.message || 'Check connection';
        showToast(`Email Error: ${errorMsg}`);
    }
};

/**
 * Manually trigger a test to verify the EmailJS -> Gmail connection
 */
export const testEmailService = async () => {
    showToast("🔄 Sending connection test...");
    try {
        const emailjs = (window as any).emailjs;
        const result = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            {
                to_email: "pia@zealdigital.com.au",
                from_name: "System Diagnostic",
                subject: "SYSTEM TEST: Connection Verified",
                message: "This is a diagnostic test. If you see this, your EmailJS template is correctly linked.",
            },
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        if (result.status === 200) {
            showToast("✅ SUCCESS: Connection verified. Check your inbox.");
        }
    } catch (error: any) {
        console.error("TEST FAILED:", error);
        showToast(`❌ FAILED: ${error?.text || 'Service link broken'}`);
    }
};

const showToast = (msg: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl z-[9999] text-xs animate-bounceIn flex flex-col gap-1 border border-white/20 max-w-xs';
    toast.innerHTML = `<div class="flex items-center gap-2 text-indigo-400 font-bold"><span>📢</span> NOTIFICATION</div><div class="opacity-90">${msg}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-500');
        setTimeout(() => toast.remove(), 500);
    }, 8000);
};
