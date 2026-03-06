const nodemailer = require('nodemailer');

/**
 * Azure Function to process and send volunteer shift reminders.
 * Call this endpoint on a schedule (e.g., hourly via Azure Logic Apps or cron).
 *
 * It queries the Data API for shifts starting in the next 24-26 hours,
 * finds signups that haven't been reminded yet, sends reminder emails,
 * and marks them as reminded.
 */
module.exports = async function (context, req) {
    context.log('Reminder processing triggered');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: corsHeaders, body: '' };
        return;
    }

    const dataApiUrl = process.env.DATA_API_URL || 'http://localhost:5000';

    try {
        // 1. Fetch all upcoming shifts
        const shiftsRes = await fetch(`${dataApiUrl}/data-api/rest/VolunteerShifts`);
        if (!shiftsRes.ok) throw new Error(`Failed to fetch shifts: ${shiftsRes.status}`);
        const shiftsData = await shiftsRes.json();
        const allShifts = shiftsData.value || [];

        // 2. Find shifts starting in 24-26 hours (reminder window)
        const now = new Date();
        const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

        const upcomingShifts = allShifts.filter(shift => {
            const startTime = new Date(shift.StartTime);
            return startTime >= windowStart && startTime <= windowEnd;
        });

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

        // 3. Fetch all signups
        const signupsRes = await fetch(`${dataApiUrl}/data-api/rest/SignUps`);
        if (!signupsRes.ok) throw new Error(`Failed to fetch signups: ${signupsRes.status}`);
        const signupsData = await signupsRes.json();
        const allSignups = signupsData.value || [];

        // 4. Find un-reminded signups for upcoming shifts
        const shiftIds = new Set(upcomingShifts.map(s => s.ShiftID));
        const pendingSignups = allSignups.filter(
            s => shiftIds.has(s.ShiftID) && !s.ReminderSent
        );

        if (pendingSignups.length === 0) {
            context.log('All signups already reminded');
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { success: true, message: 'All signups already reminded', reminders_sent: 0 }
            };
            return;
        }

        // 5. Create SMTP transporter
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

        // 6. Build shift lookup
        const shiftMap = {};
        for (const shift of upcomingShifts) {
            shiftMap[shift.ShiftID] = shift;
        }

        // 7. Send reminders and mark as sent
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
                            <div style="background:#ff9800;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
                                <h1 style="margin:0;font-size:24px">Shift Reminder</h1>
                            </div>
                            <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
                                <p>Hi ${signup.Name},</p>
                                <p>This is a friendly reminder about your volunteer shift tomorrow!</p>
                                <div style="background:#fff3e0;padding:16px;border-left:4px solid #ff9800;margin:16px 0">
                                    <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
                                    <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
                                    <p style="margin:4px 0"><strong>People:</strong> ${signup.NumPeople}</p>
                                </div>
                                <p>Please arrive 15 minutes early.</p>
                                <h3>Location</h3>
                                <p>Empathy Soup Kitchen<br>523 Sinclair Street<br>McKeesport, PA 15132</p>
                                <p>Can't make it? Visit our Volunteer Shifts page to cancel your signup.</p>
                                <p>See you tomorrow!<br>The Empathy Soup Kitchen Team</p>
                            </div>
                        </div>
                    `,
                    text: `Shift Reminder\n\nHi ${signup.Name},\n\nThis is a friendly reminder about your volunteer shift tomorrow!\n\nDate: ${shiftDate}\nTime: ${shiftTime}\nPeople: ${signup.NumPeople}\n\nPlease arrive 15 minutes early.\n\nLocation:\nEmpathy Soup Kitchen\n523 Sinclair Street\nMcKeesport, PA 15132\n\nCan't make it? Visit our Volunteer Shifts page to cancel your signup.\n\nSee you tomorrow!\nThe Empathy Soup Kitchen Team`,
                    headers: { 'X-Email-Type': 'reminder' }
                });

                // Mark as reminded
                const patchRes = await fetch(`${dataApiUrl}/data-api/rest/SignUps/SignUpID/${signup.SignUpID}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ReminderSent: true })
                });

                if (patchRes.ok) {
                    sentCount++;
                    context.log(`Reminder sent to ${signup.Email} for shift ${shift.ShiftID}`);
                } else {
                    context.log.warn(`Reminder sent to ${signup.Email} but failed to mark as sent`);
                    sentCount++;
                }
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
