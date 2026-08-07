export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: 'Missing "to" phone number or "body" message.' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio environment variables not configured on Vercel.' });
  }

  // Format phone number to E.164 (+1XXXXXXXXXX)
  const cleanTo = to.replace(/\D/g, '');
  const formattedTo = cleanTo.length === 10 ? `+1${cleanTo}` : `+${cleanTo}`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', formattedTo);
  params.append('From', fromNumber);
  params.append('Body', body);

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, sid: data.sid });
    } else {
      return res.status(400).json({ success: false, error: data.message || 'Twilio send failed.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
