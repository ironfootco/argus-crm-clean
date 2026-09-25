// api/call.js
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
    const { customerNumber, workerNumber } = await req.json();

    if (!customerNumber || !workerNumber) {
      return new Response(JSON.stringify({ error: 'Missing phone numbers' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    // Twilio Voice Calls API Endpoint
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    
    // Twimlets is a free Twilio tool that generates quick Voice XML. 
    // This tells Twilio: "When Jason answers his cell, instantly dial the customer."
    const forwardUrl = `http://twimlets.com/forward?PhoneNumber=${encodeURIComponent(customerNumber)}`;

    const params = new URLSearchParams();
    params.append('Url', forwardUrl);
    params.append('To', workerNumber); // Twilio calls you first
    params.append('From', twilioPhone); // Shows up on your caller ID

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

    const data = await twilioRes.json();

    return new Response(JSON.stringify({ success: true, callSid: data.sid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Call Edge API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
