const nodemailer = require("nodemailer");

const sendEmail = async (options) => {


    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // Use TLS upgrade on port 587 instead of strict port 465
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });


    const info = await transporter.sendMail({
        from: `"Smart Hostel" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.html
    });


    return info;
};

module.exports = sendEmail;
