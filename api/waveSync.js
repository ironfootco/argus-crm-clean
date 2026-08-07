export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerName, quotedPrice } = req.body || {};

  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID;

  if (!token || !rawBusinessId) {
    return res.status(400).json({ success: false, error: 'Wave API keys missing in Vercel.' });
  }

  // CRITICAL FIX: Wave GraphQL requires Base64 encoded "Business:UUID" strings
  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = Buffer.from(`Business:${rawBusinessId}`).toString('base64');
  }

  try {
    // 1. Query existing customers from Wave
    const customerQuery = {
      query: `
        query($businessId: ID!) {
          business(id: $businessId) {
            id
            customers(page: 1, pageSize: 10) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      variables: { businessId }
    };

    const customerRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(customerQuery)
    });

    const customerData = await customerRes.json();
    
    if (customerData.errors && customerData.errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Wave Query Error: ${customerData.errors[0].message}` 
      });
    }

    let customerId = null;
    const existingCustomers = customerData?.data?.business?.customers?.edges || [];

    if (existingCustomers.length > 0) {
      const match = existingCustomers.find(c => c.node.name.toLowerCase() === (customerName || '').toLowerCase());
      customerId = match ? match.node.id : existingCustomers[0].node.id;
    } else {
      // 2. Create customer with USD currency if account has no customers
      const createCustomerMutation = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              didSucceed
              customer { id }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: {
            businessId,
            name: customerName || "Iron Foot Client",
            currency: "USD"
          }
        }
      };

      const newCustRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(createCustomerMutation)
      });

      const newCustData = await newCustRes.json();
      
      if (newCustData?.data?.customerCreate?.userErrors?.length > 0) {
        const errMsg = newCustData.data.customerCreate.userErrors[0].message;
        return res.status(400).json({ success: false, error: `Customer Create Error: ${errMsg}` });
      }

      customerId = newCustData?.data?.customerCreate?.customer?.id;
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: "Could not resolve a valid Wave Customer ID." });
    }

    // 3. Draft Invoice with Memo and Line Item
    const createInvoiceMutation = {
      query: `
        mutation ($input: InvoiceCreateInput!) {
          invoiceCreate(input: $input) {
            didSucceed
            invoice { id viewUrl }
            userErrors { field message }
          }
        }
      `,
      variables: {
        input: {
          businessId,
          customerId,
          memo: `Job: ${jobTitle || 'General Handyman'}\n\nSite Notes:\n${notes || 'No site notes logged.'}`,
          items: [
            {
              description: jobTitle || 'Handyman Services',
              unitPrice: String(quotedPrice || 0),
              quantity: "1"
            }
          ]
        }
      }
    };

    const invoiceRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(createInvoiceMutation)
    });

    const invoiceData = await invoiceRes.json();

    if (invoiceData.errors && invoiceData.errors.length > 0) {
      return res.status(400).json({ success: false, error: invoiceData.errors[0].message });
    }

    if (invoiceData?.data?.invoiceCreate?.didSucceed === false) {
      const errMsg = invoiceData.data.invoiceCreate.userErrors[0]?.message || 'Invoice Creation Failed';
      return res.status(400).json({ success: false, error: errMsg });
    }

    return res.status(200).json({ success: true, data: invoiceData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
