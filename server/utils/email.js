const { Resend } = require("resend");

const sendEmail = async (options) => {
    if (!process.env.RESEND_API_KEY) {
        const err = new Error("RESEND_API_KEY environment variable is not configured in the host environment!");
        console.error("[MAILER] [RESEND] Configuration Error:", err.message);
        throw err;
    }

    const resend = new Resend(process.env.RESEND_API_KEY.trim());

    // Use customized verified sender email if specified, otherwise fall back to Resend's default sandbox onboarding address
    const fromEmail = process.env.RESEND_FROM_EMAIL 
        ? process.env.RESEND_FROM_EMAIL.trim() 
        : "onboarding@resend.dev";

    console.log(`[MAILER] [RESEND] Initializing Resend API client`);

    try {
        console.log(`[MAILER] [RESEND] Attempting HTTPS API dispatch | Recipient: ${options.email} | Subject: "${options.subject}"`);
        const response = await resend.emails.send({
            from: `"Smart Hostel" <${fromEmail}>`,
            to: options.email,
            subject: options.subject,
            html: options.html
        });

        if (response.error) {
            throw new Error(response.error.message || JSON.stringify(response.error));
        }

        console.log(`[MAILER] [RESEND] Dispatch succeeded to ${options.email} | Delivery ID: ${response.data?.id}`);
        return response.data;
    } catch (error) {
        console.error(`[MAILER] [RESEND] API delivery failed to ${options.email} | Error:`, error.message || error);
        throw error;
    }
};

module.exports = sendEmail;
