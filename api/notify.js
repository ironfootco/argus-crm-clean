export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, message } = req.body;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  // Supports modern os_v2_app_ keys ('Key') as well as legacy keys ('Basic')
  const authHeader = apiKey?.startsWith('os_v2') ? `Key ${apiKey}` : `Basic ${apiKey}`;

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify({
      app_id: 'e07ab1fb-c308-4bc7-9555-6172a01ac793',
      target_channel: 'push',
      included_segments: ['Subscribed Users'],
      headings: { en: title },
      contents: { en: message }
    })
  };

  try {
    const response = await fetch('https://api.onesignal.com/notifications?c=push', options);
    const data = await response.json();

    if (!response.ok) {
      console.error('OneSignal API Response Error:', data);
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Server Exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
