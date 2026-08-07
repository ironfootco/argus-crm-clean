export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerName } = req.body || {};

  const token = process.env.WAVE_ACCESS_TOKEN;
  const businessId = process.env.WAVE_BUSINESS_ID;

  if (!token || !businessId) {
    return res.status(400).json({ success: false, error: 'Wave API keys missing in Vercel.' });
  }

  try {
    // 1. Fetch the first available customer in your Wave account
    const customerQuery = {
      query: `
        query($businessId: ID!) {
          business(id: $businessId) {
            customers(page: 1, pageSize: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      variables: { businessId }
    };

    let customerRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(customerQuery)
    });
    
    let customerData = await customerRes.json();
    let customerId = null;

    if (customerData?.data?.business?.customers?.edges?.length > 0) {
      customerId = customerData.data.business.customers.edges[0].node.id;
    } else {
      // 2. Fallback: Create a placeholder customer if your Wave account is empty
      const createCustomerQuery = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              customer { id }
            }
          }
        `,
        variables: { input: { businessId, name: customerName || "Iron Foot Client" } }
      };
      let newCustRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createCustomerQuery)
      });
      let newCustData = await newCustRes.json();
      
      if (newCustData?.data?.customerCreate?.customer?.id) {
        customerId = newCustData.data.customerCreate.customer.id;
      } else {
        return res.status(400).json({ success: false, error: "Failed to fetch or create Wave Customer." });
      }
    }

    // 3. Create the Invoice Draft
    const invoiceQuery = {
      query: `
        mutation ($input: InvoiceCreateInput!) {
          invoiceCreate(input: $input) {
            didSucceed
            invoice { id }
            userErrors { message }
          }
        }
      `,
      variables: {
        input: {
          businessId: businessId,
          customerId: customerId,
          memo: `Job: ${jobTitle || 'Service'}\n\nSite Notes:\n${notes || 'No notes provided.'}`,
        }
      }
    };

    const waveRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceQuery)
    });

    const data = await waveRes.json();

    // Catch any specific Wave API errors (like missing fields)
    if (data?.data?.invoiceCreate?.didSucceed === false) {
       const waveError = data.data.invoiceCreate.userErrors[0]?.message || 'Unknown Wave Error';
       return res.status(400).json({ success: false, error: waveError });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Wave Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
