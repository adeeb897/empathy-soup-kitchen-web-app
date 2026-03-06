const nodemailer = require('nodemailer');
const { getPool, sql } = require('../shared/db');

/**
 * Azure Function to process and send volunteer shift reminders.
 * Called hourly via GitHub Actions cron workflow.
 *
 * Finds shifts starting in the next 24-26 hours, sends reminder emails
 * to signups that haven't been reminded yet, and marks them as reminded.
 */
module.exports = async function (context, req) {
    context.log('Reminder processing triggered');

    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: corsHeaders, body: '' };
        return;
    }

    try {
        const pool = await getPool();

        // 1. Find shifts starting in 24-26 hours (reminder window)
        const now = new Date();
        const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

        const shiftsResult = await pool.request()
            .input('windowStart', sql.DateTime2, windowStart)
            .input('windowEnd', sql.DateTime2, windowEnd)
            .query('SELECT * FROM dbo.VolunteerShifts WHERE StartTime >= @windowStart AND StartTime <= @windowEnd');

        const upcomingShifts = shiftsResult.recordset;

        if (upcomingShifts.length === 0) {
            context.log('No shifts in the reminder window');
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { success: true, message: 'No shifts in reminder window', reminders_sent: 0 }
            };
            return;
        }

        context.log(`Found ${upcomingShifts.length} shift(s) in reminder window`);

        // 2. Find un-reminded signups for those shifts
        const shiftIds = upcomingShifts.map(s => s.ShiftID);
        const signupsResult = await pool.request()
            .query(`SELECT * FROM dbo.SignUps WHERE ShiftID IN (${shiftIds.join(',')}) AND (ReminderSent = 0 OR ReminderSent IS NULL)`);

        const pendingSignups = signupsResult.recordset;

        if (pendingSignups.length === 0) {
            context.log('All signups already reminded');
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { success: true, message: 'All signups already reminded', reminders_sent: 0 }
            };
            return;
        }

        // 3. Create SMTP transporter
        const requiredEnvVars = ['EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT', 'EMAIL_SMTP_USERNAME', 'EMAIL_SMTP_PASSWORD', 'EMAIL_SENDER_EMAIL', 'EMAIL_SENDER_NAME'];
        const missingVars = requiredEnvVars.filter(v => !process.env[v]);
        if (missingVars.length > 0) {
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: { success: false, error: `Missing env vars: ${missingVars.join(', ')}` }
            };
            return;
        }

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SMTP_HOST,
            port: parseInt(process.env.EMAIL_SMTP_PORT),
            secure: process.env.EMAIL_SMTP_SECURE === 'true',
            auth: { user: process.env.EMAIL_SMTP_USERNAME, pass: process.env.EMAIL_SMTP_PASSWORD }
        });

        await transporter.verify();

        // 4. Build shift lookup
        const shiftMap = {};
        for (const shift of upcomingShifts) {
            shiftMap[shift.ShiftID] = shift;
        }

        // 5. Send reminders and mark as sent
        let sentCount = 0;
        const errors = [];

        for (const signup of pendingSignups) {
            const shift = shiftMap[signup.ShiftID];
            if (!shift) continue;

            const startTime = new Date(shift.StartTime);
            const endTime = new Date(shift.EndTime);
            const shiftDate = startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const shiftTime = `${fmtTime(startTime)} - ${fmtTime(endTime)}`;

            try {
                await transporter.sendMail({
                    from: `${process.env.EMAIL_SENDER_NAME} <${process.env.EMAIL_SENDER_EMAIL}>`,
                    to: signup.Email,
                    subject: `Reminder: Volunteer shift tomorrow - ${shiftDate}`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                            <div style="background:#C45D3E;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
                                <h1 style="margin:0;font-size:24px">Shift Reminder</h1>
                            </div>
                            <div style="background:#FAF7F2;padding:24px;border-radius:0 0 8px 8px">
                                <p>Hi ${signup.Name},</p>
                                <p>This is a friendly reminder about your volunteer shift tomorrow!</p>
                                <div style="background:#F0EBE1;padding:16px;border-left:4px solid #C45D3E;margin:16px 0">
                                    <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
                                    <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
                                    <p style="margin:4px 0"><strong>Group size:</strong> ${signup.NumPeople}</p>
                                </div>
                                <p>Please arrive 10 minutes early. Wear comfortable clothes and closed-toe shoes.</p>
                                <h3>Location</h3>
                                <p>Empathy Soup Kitchen<br>523 Sinclair Street<br>McKeesport, PA 15132</p>
                                <p>Can't make it? Visit our <a href="https://empathysoupkitchen.org/volunteer">Volunteer page</a> to cancel your signup.</p>
                                <p>See you tomorrow!<br>The Empathy Soup Kitchen Team</p>
                            </div>
                        </div>
                    `,
                    text: `Shift Reminder\n\nHi ${signup.Name},\n\nThis is a friendly reminder about your volunteer shift tomorrow!\n\nDate: ${shiftDate}\nTime: ${shiftTime}\nGroup size: ${signup.NumPeople}\n\nPlease arrive 10 minutes early. Wear comfortable clothes and closed-toe shoes.\n\nLocation:\nEmpathy Soup Kitchen\n523 Sinclair Street\nMcKeesport, PA 15132\n\nCan't make it? Visit https://empathysoupkitchen.org/volunteer to cancel your signup.\n\nSee you tomorrow!\nThe Empathy Soup Kitchen Team`,
                    headers: { 'X-Email-Type': 'reminder' }
                });

                // Mark as reminded directly in DB
                await pool.request()
                    .input('SignUpID', sql.Int, signup.SignUpID)
                    .query('UPDATE dbo.SignUps SET ReminderSent = 1 WHERE SignUpID = @SignUpID');

                sentCount++;
                context.log(`Reminder sent to ${signup.Email} for shift ${shift.ShiftID}`);
            } catch (err) {
                context.log.error(`Failed to send reminder to ${signup.Email}:`, err.message);
                errors.push({ email: signup.Email, error: err.message });
            }
        }

        context.res = {
            status: 200,
            headers: corsHeaders,
            body: {
                success: true,
                reminders_sent: sentCount,
                errors: errors.length > 0 ? errors : undefined,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        context.log.error('Reminder processing failed:', error);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: { success: false, error: error.message, timestamp: new Date().toISOString() }
        };
    }
};
