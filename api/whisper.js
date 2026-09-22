export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 2. This block runs after you press a button (or if the timer runs out)
  if (req.method === 'POST') {
    const formData = await req.text();
    const params = new URLSearchParams(formData);
    const digits = params.get('Digits');

    // If you pressed 1, bridge the call silently
    if (digits === '1') {
      return new Response('<Response></Response>', { 
        headers: { 'Content-Type': 'text/xml' } 
      });
    }
    
    // If it was a voicemail machine (no digits), hang up the cell phone leg
    return new Response('<Response><Hangup/></Response>', { 
      headers: { 'Content-Type': 'text/xml' } 
    });
  }

  // 1. This is the initial prompt ONLY you hear when you answer the phone
  const twiml = `
    <Response>
      <Gather numDigits="1" method="POST" timeout="4">
        <Say>Argus call. Press 1 to accept.</Say>
      </Gather>
      <Hangup/>
    </Response>
  `;

  return new Response(twiml, { 
    headers: { 'Content-Type': 'text/xml' } 
  });
}
