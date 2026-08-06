export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, quotedPrice, waveCustomerId, notes } = req.body;
  const token = process.env.WAVE_ACCESS_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'Missing WAVE_ACCESS_TOKEN in Vercel environment' });
  }

  // Wave GraphQL API Endpoint
  const query = `
    mutation ($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        invoice {
          id
        }
      }
    }
  `;

  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            businessId: process.env.WAVE_BUSINESS_ID || "", // Added if needed
            customerId: waveCustomerId || "",
            items: [
              {
                description: jobTitle,
                unitPrice: parseFloat(quotedPrice) || 0,
                quantity: 1
              }
            ],
            memo: notes || "Generated from Argus CRM"
          }
        }
      })
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
