export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  // Auto-extract customer name from job title if missing (e.g. "Jason Foote - Repairs & Fixing" -> "Jason Foote")
  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }

  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID;

  if (!token || !rawBusinessId) {
    return res.status(400).json({ success: false, error: 'Wave API keys missing in Vercel.' });
  }

  // 1. Convert raw UUID to Base64 format
  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = btoa(`Business:${rawBusinessId}`);
  }

  try {
    // 2. Fetch existing customers & products
    const initialQuery = {
      query: `
        query($businessId: ID!) {
          business(id: $businessId) {
            id
            customers(page: 1, pageSize: 250) {
              edges {
                node {
                  id
                  name
                  email
                }
              }
            }
            products(page: 1, pageSize: 10) {
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
    const existingCustomers = business?.customers?.edges?.map(e => e.node) || [];
    let productId = business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

    // 3. Match customer by email first, then by full Customer Name
    if (customerEmail) {
      const matchByEmail = existingCustomers.find(
        c => c.email && c.email.toLowerCase().trim() === customerEmail.toLowerCase().trim()
      );
      if (matchByEmail) customerId = matchByEmail.id;
    }

    if (!customerId && customerName) {
      const matchByName = existingCustomers.find(
        c => c.name && c.name.toLowerCase().trim() === customerName.toLowerCase().trim()
      );
      if (matchByName) customerId = matchByName.id;
    }

    // 4. Create new customer in Wave if no match exists
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
            email: customerEmail || undefined,
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

    // 5. Fallback: Create Product if none exists
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

    // 6. Create DRAFT ESTIMATE with sticky notes in the memo field
    const createEstimateMutation = {
      query: `
        mutation ($input: EstimateCreateInput!) {
          estimateCreate(input: $input) {
            didSucceed
            estimate { id viewUrl }
            inputErrors { message code path }
          }
        }
      `,
      variables: {
        input: {
          businessId,
          customerId,
          memo: `Job: ${jobTitle || 'General Handyman'}\n\nSite / Estimating Notes:\n${notes || 'No site notes logged.'}`,
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

    const estimateRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createEstimateMutation)
    });

    const estimateData = await estimateRes.json();

    if (estimateData.errors && estimateData.errors.length > 0) {
      return res.status(400).json({ success: false, error: estimateData.errors[0].message });
    }

    if (estimateData?.data?.estimateCreate?.didSucceed === false) {
      const errMsg = estimateData.data.estimateCreate.inputErrors?.[0]?.message || 'Estimate Creation Failed';
      return res.status(400).json({ success: false, error: errMsg });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
