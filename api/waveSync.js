export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, quotedPrice, notes, customerName, customerEmail } = req.body || {};

  const token = process.env.WAVE_ACCESS_TOKEN;
  const businessId = process.env.WAVE_BUSINESS_ID;

  if (!token || !businessId) {
    console.log('[WAVE SYNC] Missing Wave credentials in Vercel. Draft creation skipped.');
    return res.status(200).json({ 
      success: true, 
      mode: 'simulated', 
      message: 'Wave API keys not configured in Vercel environment.' 
    });
  }

  const graphqlQuery = {
    query: `
      mutation ($input: InvoiceCreateInput!) {
        invoiceCreate(input: $input) {
          didSucceed
          invoice {
            id
            pdfUrl
            viewUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      input: {
        businessId: businessId,
        memo: notes || `Job: ${jobTitle}`,
        items: [
          {
            description: jobTitle || 'Handyman Service',
            unitPrice: String(quotedPrice || 0),
            quantity: "1"
          }
        ]
      }
    }
  };

  try {
    const waveRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    });

    const data = await waveRes.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Wave GraphQL Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
