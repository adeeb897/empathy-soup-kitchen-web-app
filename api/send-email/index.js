const nodemailer = require('nodemailer');

/**
 * Azure Function for sending emails via SMTP
 * Handles volunteer shift notifications, confirmations, and reminders
 */
module.exports = async function (context, req) {
    context.log('Email send function triggered');

    // CORS headers for Angular app
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: ''
        };
        return;
    }

    try {
        // Validate request
        if (!req.body || !req.body.to || !req.body.subject || !req.body.html) {
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Missing required fields: to, subject, html'
                }
            };
            return;
        }

        const { to, subject, html, text, type } = req.body;

        // Validate environment variables
        const requiredEnvVars = [
            'EMAIL_SMTP_HOST',
            'EMAIL_SMTP_PORT',
            'EMAIL_SMTP_USERNAME',
            'EMAIL_SMTP_PASSWORD',
            'EMAIL_SENDER_EMAIL',
            'EMAIL_SENDER_NAME'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            context.log.error('Missing environment variables:', missingVars);
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Server configuration error'
                }
            };
            return;
        }

        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SMTP_HOST,
            port: parseInt(process.env.EMAIL_SMTP_PORT),
            secure: process.env.EMAIL_SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_SMTP_USERNAME,
                pass: process.env.EMAIL_SMTP_PASSWORD
            }
        });

        // Verify SMTP connection
        try {
            await transporter.verify();
            context.log('SMTP connection verified');
        } catch (verifyError) {
            context.log.error('SMTP verification failed:', verifyError);
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Email service configuration error'
                }
            };
            return;
        }

        // Prepare email options
        const mailOptions = {
            from: `${process.env.EMAIL_SENDER_NAME} <${process.env.EMAIL_SENDER_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        };

        // Add email type to headers for tracking
        if (type) {
            mailOptions.headers = {
                'X-Email-Type': type
            };
        }

        // Send email
        context.log(`Sending email to ${to}, subject: ${subject}`);
        const info = await transporter.sendMail(mailOptions);

        context.log(`Email sent successfully. Message ID: ${info.messageId}`);

        // Return success response
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: {
                success: true,
                messageId: info.messageId,
                timestamp: new Date().toISOString(),
                type: type || 'unknown'
            }
        };

    } catch (error) {
        context.log.error('Email sending failed:', error);
        
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                success: false,
                error: 'Failed to send email',
                timestamp: new Date().toISOString()
            }
        };
    }
};