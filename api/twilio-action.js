export default function handler(req, res) {
  // Twilio sends the status of the call when the Dial attempt finishes
  const callStatus = req.body.DialCallStatus || req.query.DialCallStatus;

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  // If you answered and completed the call, just hang up on Twilio's end.
  if (callStatus === 'completed') {
    twiml += '<Hangup />';
  } 
  // If it rang out, you declined it, or your phone was off, trigger the voicemail.
  else {
    twiml += '<Say voice="Polly.Matthew-Neural">You\'ve reached Iron Foot Company. Jason is on a job site, so please leave a quick message and he\'ll get right back to you.</Say>';
    twiml += '<Record transcribe="true" recordingStatusCallback="https://argus-crm-clean.vercel.app/api/voicemail" />';
  }

  twiml += '</Response>';

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
