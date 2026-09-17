const { sendMail, missingEmailConfig } = require('../shared/email');

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token'
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
        const missingVars = missingEmailConfig();
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

        context.log(`Sending email to ${to}, subject: ${subject}`);
        const info = await sendMail({ to, subject, html, text, type });

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