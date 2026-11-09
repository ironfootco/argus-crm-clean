export default function handler(req, res) {
  // Ensure we safely handle the request body regardless of how Twilio sends it
  let callStatus = '';
  
  if (req.body && req.body.DialCallStatus) {
    callStatus = req.body.DialCallStatus;
  } else if (req.query && req.query.DialCallStatus) {
    callStatus = req.query.DialCallStatus;
  }

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (callStatus === 'completed') {
    twiml += '<Hangup />';
  } else {
    twiml += '<Say voice="Polly.Matthew-Neural">You\'ve reached Iron Foot Company. Jason is on a job site, so please leave a quick message and he\'ll get right back to you.</Say>';
    twiml += '<Record transcribe="true" recordingStatusCallback="https://argus-crm-clean.vercel.app/api/voicemail" />';
  }

  twiml += '</Response>';

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
