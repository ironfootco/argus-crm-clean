export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) return res.status(400).json({ error: 'Wave access token missing.' });
  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query GetEstimates($biz: ID!) {
            business(id: $biz) {
              estimates(page: 1, pageSize: 20) {
                edges {
                  node {
                    id
                    estimateNumber
                    status
                    createdAt
                    title
                    summary
                    customer {
                      id
                      name
                      firstName
                      lastName
                      email
                      phone
                      address {
                        addressLine1
                        addressLine2
                        city
                        province { code }
                        postalCode
                      }
                    }
                    total {
                      raw
                      value
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { biz: businessId }
      })
    });

    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0].message);

    const edges = json?.data?.business?.estimates?.edges || [];
    const estimates = edges.map(e => e.node);

    return res.status(200).json({ success: true, count: estimates.length, estimates });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
