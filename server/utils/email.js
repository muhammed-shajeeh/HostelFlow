const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        const err = new Error("EMAIL_USER or EMAIL_PASS environment variables are not configured in the host environment!");
        console.error("[MAILER] SMTP Configuration Error:", err.message);
        throw err;
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // Use TLS upgrade on port 587 instead of strict port 465
        auth: {
            user: process.env.EMAIL_USER.trim(),
            pass: process.env.EMAIL_PASS.trim()
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log(`[MAILER] Attempting dispatch to: ${options.email} | Subject: "${options.subject}"`);
        const info = await transporter.sendMail({
            from: `"Smart Hostel" <${process.env.EMAIL_USER.trim()}>`,
            to: options.email,
            subject: options.subject,
            html: options.html
        });
        console.log(`[MAILER] Dispatch succeeded to ${options.email} | Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[MAILER] Transport delivery failed to ${options.email} | Error:`, error.message || error);
        throw error;
    }
};

module.exports = sendEmail;
