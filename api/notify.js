export default async function handler(req, res) {
  console.log("🔔 NOTIFY API TRIGGERED! Payload:", req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // We now expect a 'target' property (e.g., 'Jason', 'Edwin', or 'All')
  const { title, message, target = 'All' } = req.body;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.error("❌ CRITICAL: API Key is missing in Vercel Env Variables!");
    return res.status(500).json({ error: 'Missing API Key' });
  }

  const authHeader = apiKey.startsWith('os_v2') ? `Key ${apiKey}` : `Basic ${apiKey}`;

  // 🔀 THE SMART ROUTING LOGIC
  const payload = {
    app_id: 'e07ab1fb-c308-4bc7-9555-6172a01ac793',
    headings: { en: title },
    contents: { en: message }
  };

  if (target === 'All' || target === 'Both') {
    // 📢 BROADCAST: Send to everyone (Website Leads)
    payload.included_segments = ['Subscribed Users', 'Active Users', 'Total Subscriptions', 'All'];
  } else if (target === 'Edwin') {
    // 👷 TARGET EDWIN + ADMIN OVERSIGHT
    payload.filters = [
      { field: "tag", key: "worker_name", relation: "=", value: "Edwin" },
      { operator: "OR" },
      { field: "tag", key: "worker_name", relation: "=", value: "Jason" } // Jason gets everything
    ];
  } else if (target === 'Jason') {
    // 👑 TARGET JASON ONLY
    payload.filters = [
      { field: "tag", key: "worker_name", relation: "=", value: "Jason" }
    ];
  }

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  };

  try {
    console.log(`🚀 Routing payload to: ${target}`);
    const response = await fetch('https://onesignal.com/api/v1/notifications', options);
    const data = await response.json();

    console.log(`📡 OneSignal Status: ${response.status}`);
    console.log(`📦 OneSignal Data:`, data);

    return res.status(200).json(data);
  } catch (error) {
    console.error('🔥 Server Exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
