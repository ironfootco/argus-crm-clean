import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // Twilio sends data as URL-encoded forms, not JSON
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const fromPhone = params.get('From');
    const messageBody = params.get('Body');

    if (fromPhone && messageBody) {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY
      );

      // Log the incoming message to your database
      await supabase.from('messages').insert([{
        customer_phone: fromPhone,
        direction: 'inbound',
        body: messageBody,
        is_read: false
      }]);
    }

    // Twilio requires an empty TwiML response to know the webhook succeeded
    const twimlResponse = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    
    return new Response(twimlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error("Inbound Webhook Error:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
