export default async function handler(req, res) {
  // 1. Force Vercel to log the incoming request
  console.log("🔔 NOTIFY API TRIGGERED! Payload:", req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, message } = req.body;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.error("❌ CRITICAL: API Key is missing in Vercel Env Variables!");
    return res.status(500).json({ error: 'Missing API Key' });
  }

  // Handle both modern and legacy API Key formats
  const authHeader = apiKey.startsWith('os_v2') ? `Key ${apiKey}` : `Basic ${apiKey}`;

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify({
      app_id: 'e07ab1fb-c308-4bc7-9555-6172a01ac793',
      // 2. Blast all default segment names to guarantee it finds your phone
      included_segments: ['Subscribed Users', 'Active Users', 'Total Subscriptions', 'All'],
      headings: { en: title },
      contents: { en: message }
    })
  };

  try {
    console.log("🚀 Sending payload to OneSignal...");
    const response = await fetch('https://onesignal.com/api/v1/notifications', options);
    const data = await response.json();

    // 3. Force Vercel to log the exact response from OneSignal, even if it succeeds
    console.log(`📡 OneSignal Status: ${response.status}`);
    console.log(`📦 OneSignal Data:`, data);

    return res.status(200).json(data);
  } catch (error) {
    console.error('🔥 Server Exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
