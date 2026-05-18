const nodemailer = require("nodemailer");
const dns = require("dns");

// Force Node.js DNS resolver to prioritize IPv4 resolutions globally across all network modules
if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
}

const sendEmail = async (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        const err = new Error("EMAIL_USER or EMAIL_PASS environment variables are not configured in the host environment!");
        console.error("[MAILER] SMTP Configuration Error:", err.message);
        throw err;
    }

    let smtpHost = "smtp.gmail.com";
    try {
        // Perform an explicit IPv4-only A-record DNS query to bypass AAAA (IPv6) completely
        const ips = await dns.promises.resolve4("smtp.gmail.com");
        if (ips && ips.length > 0) {
            smtpHost = ips[0];
            console.log(`[MAILER] DNS resolved A-Record of smtp.gmail.com to IPv4: ${smtpHost}`);
        }
    } catch (dnsError) {
        console.warn("[MAILER] IPv4 DNS A-Record query failed, falling back to hostname:", dnsError.message);
    }

    console.log(`[MAILER] Initializing secure SMTP transport: ${smtpHost} (SNI: smtp.gmail.com) | Protocol: STARTTLS (587)`);

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false, // Use STARTTLS upgrade
        family: 4, // Restrict connection socket to IPv4
        auth: {
            user: process.env.EMAIL_USER.trim(),
            pass: process.env.EMAIL_PASS.trim()
        },
        tls: {
            rejectUnauthorized: false,
            servername: "smtp.gmail.com" // Crucial: forces SSL Server Name Indication matching for smtp.gmail.com when connecting via direct IP
        },
        connectionTimeout: 15000, // 15 seconds connection timeout
        greetingTimeout: 15000,   // 15 seconds greeting timeout
        socketTimeout: 20000       // 20 seconds socket inactivity timeout
    });

    try {
        console.log(`[MAILER] Attempting dispatch via IPv4 transport to: ${options.email} | Subject: "${options.subject}"`);
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
