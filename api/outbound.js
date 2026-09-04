import { createClient } from '@supabase/supabase-js';

// This forces Vercel to bypass the standard Node compiler
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { to, body, customerId } = await req.json();

    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Missing phone number or message body' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', twilioPhone);
    params.append('Body', body);

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!twilioRes.ok) {
      const errData = await twilioRes.text();
      throw new Error(errData);
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    await supabase.from('messages').insert([{
      customer_phone: to,
      customer_id: customerId || null,
      direction: 'outbound',
      body: body,
      is_read: true
    }]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Outbound Edge API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
