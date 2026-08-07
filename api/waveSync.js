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

  // 1. Convert raw UUID to Base64 format required by Wave GraphQL
  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = Buffer.from(`Business:${rawBusinessId}`).toString('base64');
  }

  try {
    // 2. Query existing Customer ID and Product ID
    const initialQuery = {
      query: `
        query($businessId: ID!) {
          business(id: $businessId) {
            id
            customers(page: 1, pageSize: 1) {
              edges {
                node { id }
              }
            }
            products(page: 1, pageSize: 1) {
              edges {
                node { id }
              }
            }
          }
        }
      `,
      variables: { businessId }
    };

    const initialRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initialQuery)
    });

    const initialData = await initialRes.json();

    if (initialData.errors && initialData.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Wave Query Error: ${initialData.errors[0].message}`
      });
    }

    const business = initialData?.data?.business;
    let customerId = business?.customers?.edges?.[0]?.node?.id;
    let productId = business?.products?.edges?.[0]?.node?.id;

    // 3. Fallback: Create Customer if none exists
    if (!customerId) {
      const createCustMutation = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              didSucceed
              customer { id }
              inputErrors { message code path }
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

      const custRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createCustMutation)
      });
      const custData = await custRes.json();

      if (custData.errors && custData.errors.length > 0) {
        return res.status(400).json({ success: false, error: custData.errors[0].message });
      }

      if (custData?.data?.customerCreate?.didSucceed === false) {
        const errMsg = custData.data.customerCreate.inputErrors?.[0]?.message || 'Customer Creation Failed';
        return res.status(400).json({ success: false, error: `Customer Error: ${errMsg}` });
      }

      customerId = custData?.data?.customerCreate?.customer?.id;
    }

    // 4. Fallback: Create Product if none exists
    if (!productId) {
      const createProdMutation = {
        query: `
          mutation ($input: ProductCreateInput!) {
            productCreate(input: $input) {
              didSucceed
              product { id }
              inputErrors { message code path }
            }
          }
        `,
        variables: {
          input: {
            businessId,
            name: "Handyman Services",
            unitPrice: "0.00"
          }
        }
      };

      const prodRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createProdMutation)
      });
      const prodData = await prodRes.json();

      if (prodData.errors && prodData.errors.length > 0) {
        return res.status(400).json({ success: false, error: prodData.errors[0].message });
      }

      if (prodData?.data?.productCreate?.didSucceed === false) {
        const errMsg = prodData.data.productCreate.inputErrors?.[0]?.message || 'Product Creation Failed';
        return res.status(400).json({ success: false, error: `Product Error: ${errMsg}` });
      }

      productId = prodData?.data?.productCreate?.product?.id;
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Failed to resolve Wave Customer or Product ID." });
    }

    // 5. Create Draft Invoice
    const createInvoiceMutation = {
      query: `
        mutation ($input: InvoiceCreateInput!) {
          invoiceCreate(input: $input) {
            didSucceed
            invoice { id viewUrl }
            inputErrors { message code path }
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
              productId,
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
      const errMsg = invoiceData.data.invoiceCreate.inputErrors?.[0]?.message || 'Invoice Creation Failed';
      return res.status(400).json({ success: false, error: errMsg });
    }

    return res.status(200).json({ success: true, data: invoiceData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
