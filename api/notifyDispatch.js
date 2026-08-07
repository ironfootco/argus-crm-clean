import twilio from 'twilio';

// Phone directory for team members
const CREW_PHONE_DIRECTORY = {
  'Jason': process.env.JASON_PHONE_NUMBER || '',
  'Edwin': process.env.EDWIN_PHONE_NUMBER || '',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { workerName, jobTitle, jobAddress, scheduledDate, scheduledTime } = req.body || {};

  if (!workerName || workerName === 'Unassigned') {
    return res.status(200).json({ success: true, message: 'Unassigned - no notification sent.' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  // If Twilio env vars are not set yet, fall back gracefully
  if (!accountSid || !authToken || !twilioPhone) {
    console.log(`[DISPATCH NOTICE] ${workerName} assigned to "${jobTitle}". Twilio SMS skipped (env vars missing).`);
    return res.status(200).json({ 
      success: true, 
      mode: 'simulated', 
      message: `Dispatch logged for ${workerName}. Add Twilio env vars to enable automatic SMS text alerts.` 
    });
  }

  try {
    const client = twilio(accountSid, authToken);

    // Determine recipients
    let recipients = [];
    if (workerName === 'Both (Jason & Edwin)') {
      recipients = [CREW_PHONE_DIRECTORY['Jason'], CREW_PHONE_DIRECTORY['Edwin']].filter(Boolean);
    } else if (CREW_PHONE_DIRECTORY[workerName]) {
      recipients = [CREW_PHONE_DIRECTORY[workerName]];
    }

    if (recipients.length === 0) {
      return res.status(200).json({ success: true, message: `No phone number configured for ${workerName}` });
    }

    const messageBody = `🚨 NEW DISPATCH ALERT - IRON FOOT CO.\n\n` +
      `🛠️ Job: ${jobTitle}\n` +
      `📍 Location: ${jobAddress || 'See CRM for address'}\n` +
      `📅 Date: ${scheduledDate || 'Flex'}\n` +
      `⏰ Time: ${scheduledTime || 'Morning'}\n\n` +
      `Open your CRM dashboard to check site notes & start the job.`;

    // Send SMS to assigned recipients
    await Promise.all(
      recipients.map(phone => 
        client.messages.create({
          body: messageBody,
          from: twilioPhone,
          to: phone
        })
      )
    );

    return res.status(200).json({ success: true, message: `Dispatch SMS sent to ${workerName}` });
  } catch (err) {
    console.error('Dispatch notification error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
