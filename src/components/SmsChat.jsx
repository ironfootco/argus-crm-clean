import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  try {
    // Added mediaUrl to the payload
    const { to, body, customerId, senderName, mediaUrl } = await req.json();

    if (!to || (!body && !mediaUrl)) {
      return new Response(JSON.stringify({ error: 'Missing phone or message content' }), { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', twilioPhone);
    if (body) params.append('Body', body);
    if (mediaUrl) params.append('MediaUrl', mediaUrl); // Tells Twilio to attach the photo

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!twilioRes.ok) throw new Error(await twilioRes.text());

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

    await supabase.from('messages').insert([{
      customer_phone: to,
      customer_id: customerId || null,
      direction: 'outbound',
      body: body || '',
      is_read: true,
      sender_name: senderName || 'Jason',
      media_url: mediaUrl || null // Logs the photo to your database
    }]);

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error("Outbound Edge API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
