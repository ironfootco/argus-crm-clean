import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, body, customerId } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: 'Missing phone number or message body' });
    }

    // Pull Twilio credentials from Vercel
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    // 1. Tell Twilio to send the text
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: to,
      From: twilioPhone,
      Body: body
    });

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      throw new Error(twilioData.message || 'Twilio failed to send the message.');
    }

    // 2. Save the outbound text to Supabase so it shows up in your chat history
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('messages').insert([{
      customer_phone: to,
      customer_id: customerId || null,
      direction: 'outbound',
      body: body,
      is_read: true // It's our own message, so it's already "read"
    }]);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("🔥 SendText API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
