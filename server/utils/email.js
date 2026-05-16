const nodemailer = require("nodemailer");

const sendEmail = async (options) => {


    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
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
