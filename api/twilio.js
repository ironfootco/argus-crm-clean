import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Twilio requires us to return an XML response (TwiML) to acknowledge receipt.
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }

  try {
    // 1. Initialize Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Parse the incoming text from Twilio
    const { From, Body, MediaUrl0 } = req.body;

    if (!From) {
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send('<Response></Response>');
    }

    // 3. Format Twilio's phone number (+17815551234) to match Argus ((781) 555-1234)
    let formattedPhone = From;
    if (From.startsWith('+1') && From.length === 12) {
      formattedPhone = `(${From.slice(2, 5)}) ${From.slice(5, 8)}-${From.slice(8)}`;
    }

    // 4. Look up if this phone number matches an existing customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('phone', formattedPhone)
      .maybeSingle();

    // 5. Save the text to your new messages table
    await supabase.from('messages').insert([{
      customer_phone: formattedPhone,
      customer_id: customer ? customer.id : null,
      direction: 'inbound',
      body: Body || '',
      media_url: MediaUrl0 || null,
      is_read: false
    }]);

    // 6. 🔔 Send a Push Notification to your phone
    const senderName = customer ? `${customer.first_name} ${customer.last_name}` : formattedPhone;
    const oneSignalKey = process.env.ONESIGNAL_REST_API_KEY;
    
    if (oneSignalKey) {
      const authHeader = oneSignalKey.startsWith('os_v2') ? `Key ${oneSignalKey}` : `Basic ${oneSignalKey}`;
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          app_id: 'e07ab1fb-c308-4bc7-9555-6172a01ac793',
          headings: { en: `💬 Text from ${senderName}` },
          contents: { en: Body || 'Sent an image/attachment.' },
          included_segments: ['All'] // Broadcast to the team
        })
      });
    }

    // 7. Acknowledge receipt to Twilio so they don't resend it
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');

  } catch (error) {
    console.error("🔥 Twilio Webhook Error:", error);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>'); // Always return 200 so Twilio doesn't crash
  }
}
