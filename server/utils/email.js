const sendEmail = async (options) => {
    if (!process.env.BREVO_API_KEY) {
        const err = new Error("BREVO_API_KEY environment variable is not configured in the host environment!");
        console.error("[MAILER] [BREVO] Configuration Error:", err.message);
        throw err;
    }

    console.log(`[MAILER] [BREVO] Initializing secure HTTPS transactional dispatch`);

    // Verified Gmail sender identity registered on Brevo account
    const senderEmail = "myhostelflow@gmail.com";

    try {
        console.log(`[MAILER] [BREVO] Attempting API dispatch | Recipient: ${options.email} | Subject: "${options.subject}"`);
        
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": process.env.BREVO_API_KEY.trim()
            },
            body: JSON.stringify({
                sender: {
                    name: "Smart Hostel",
                    email: senderEmail
                },
                to: [
                    {
                        email: options.email
                    }
                ],
                subject: options.subject,
                htmlContent: options.html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || JSON.stringify(data));
        }

        console.log(`[MAILER] [BREVO] Dispatch succeeded to ${options.email} | Message ID: ${data.messageId}`);
        return data;
    } catch (error) {
        console.error(`[MAILER] [BREVO] API delivery failed to ${options.email} | Error:`, error.message || error);
        throw error;
    }
};

module.exports = sendEmail;
