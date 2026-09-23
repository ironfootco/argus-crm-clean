import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.text();
    const params = new URLSearchParams(formData);
    
    const fromNumber = params.get('From');
    // Twilio sends the transcript here
    const transcription = params.get('TranscriptionText') || 'Audio only (No text detected).';
    // Twilio sends the raw recording URL
    const recordingUrl = params.get('RecordingUrl'); 

    if (!fromNumber || !recordingUrl) {
      return new Response('Missing data', { status: 400 });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // Insert the voicemail into the messages table
    await supabase.from('messages').insert([{
      customer_phone: fromNumber,
      direction: 'inbound',
      body: `🎤 Voicemail Transcript:\n"${transcription}"`,
      // Appending .mp3 forces Twilio to serve the playable audio file
      media_url: `${recordingUrl}.mp3`,
      is_read: false,
      sender_name: 'Customer'
    }]);

    return new Response('<Response></Response>', { 
      headers: { 'Content-Type': 'text/xml' } 
    });
    
  } catch (error) {
    console.error('Voicemail API Error:', error);
    return new Response('Error', { status: 500 });
  }
}
