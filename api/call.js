// api/call.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { customerNumber, workerNumber } = await req.json();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    // 1. Generate the TwiML directly (replacing Twimlets).
    // The timeout="60" ensures the line stays open long enough for the customer's voicemail to pick up.
    const twiml = `<Response><Dial timeout="60" callerId="${twilioPhone}">${customerNumber}</Dial></Response>`;

    const params = new URLSearchParams();
    params.append('Twiml', twiml); // Pass the raw instructions
    params.append('To', workerNumber); // Rings your cell first
    params.append('From', twilioPhone); // Business Caller ID
    params.append('Timeout', '60'); // Gives YOU 60 seconds to answer your cell

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!twilioRes.ok) throw new Error(await twilioRes.text());
    const data = await twilioRes.json();

    return new Response(JSON.stringify({ success: true, callSid: data.sid }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
