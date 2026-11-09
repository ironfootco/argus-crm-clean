import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    // ==========================================
    // JOB 1: The Traffic Cop (Triggered by the <Dial> action in Twilio)
    // ==========================================
    const dialCallStatus = params.get('DialCallStatus');
    
    if (dialCallStatus) {
      let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
      
      if (dialCallStatus === 'completed') {
        // You answered the phone and hung up. End the call.
        twiml += '<Hangup />';
      } else {
        // You missed it or ignored it. Play the voicemail greeting.
        twiml += '<Say voice="Polly.Matthew-Neural">You\'ve reached Iron Foot Company. Jason is on a job site, so please leave a quick message and he\'ll get right back to you.</Say>';
        twiml += '<Record transcribe="true" recordingStatusCallback="https://argus-crm-clean.vercel.app/api/voicemail" />';
      }
      
      twiml += '</Response>';
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // ==========================================
    // JOB 2: The Voicemail Catcher (Triggered by the <Record> callback in Twilio)
    // ==========================================
    const fromNumber = params.get('From');
    const transcription = params.get('TranscriptionText') || 'Audio only (No text detected).';
    const recordingUrl = params.get('RecordingUrl'); 

    if (fromNumber && recordingUrl) {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY
      );

      // Insert the voicemail into the messages table
      await supabase.from('messages').insert([{
        customer_phone: fromNumber,
        direction: 'inbound',
        body: `🎤 Voicemail Transcript:\n"${transcription}"`,
        media_url: `${recordingUrl}.mp3`,
        is_read: false,
        sender_name: 'Customer'
      }]);

      return new Response('<Response></Response>', { 
        headers: { 'Content-Type': 'text/xml' } 
      });
    }

    // Fallback for any other unexpected Twilio pings
    return new Response('<Response></Response>', { 
      headers: { 'Content-Type': 'text/xml' } 
    });
    
  } catch (error) {
    console.error('Voicemail API Error:', error);
    return new Response('Error', { status: 500 });
  }
}
