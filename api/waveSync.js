export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }

  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) {
    return res.status(400).json({ success: false, error: 'Wave API key missing in Vercel.' });
  }

  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = btoa(`Business:${rawBusinessId}`);
  }

  // Parse address input explicitly forcing countryCode to "United States"
  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const clean = addrStr.trim();
    if (!clean || clean.length < 3) return undefined;

    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    
    if (parts.length >= 3) {
      const line1 = parts[0];
      const city = parts[1];
      const lastParts = parts.slice(2).join(' ').split(' ').filter(Boolean);
      let provinceCode = '';
      let postalCode = '';
      
      for (const p of lastParts) {
        if (/^\d{5}(-\d{4})?$/.test(p)) {
          postalCode = p;
        } else if (/^[a-zA-Z]{2}$/.test(p) && !provinceCode) {
          provinceCode = p.toUpperCase();
        }
      }

      return {
        addressLine1: line1,
        city: city,
        provinceCode: provinceCode || undefined,
        postalCode: postalCode || undefined,
        countryCode: "United States"
      };
    }

    return {
      addressLine1: clean,
      countryCode: "United States"
    };
  }

  try {
    // 1. Query Catalog
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
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(initialQuery)
    });

    const initialData = await initialRes.json();
    if (initialData.errors && initialData.errors.length > 0) {
      return res.status(400).json({ success: false, error: `Wave Query Error: ${initialData.errors[0].message}` });
    }

    const business = initialData?.data?.business;
    const existingCustomers = business?.customers?.edges?.map(e => e.node) || [];
    let productId = business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

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

    const addressInput = parseAddress(customerAddress);
    const cleanPhone = customerPhone ? customerPhone.trim() : undefined;

    // 2. Patch existing or Create new Customer Profile
    if (customerId) {
      const patchCustMutation = {
        query: `
          mutation ($input: CustomerPatchInput!) {
            customerPatch(input: $input) {
              didSucceed
              customer { id name email phone address { addressLine1 city } }
              inputErrors { message code path }
            }
          }
        `,
        variables: {
          input: {
            id: customerId,
            name: customerName || undefined,
            email: customerEmail || undefined,
            phone: cleanPhone,
            mobile: cleanPhone,
            address: addressInput
          }
        }
      };

      const patchRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchCustMutation)
      });
      const patchData = await patchRes.json();

      if (patchData?.data?.customerPatch?.didSucceed === false) {
        const errs = patchData.data.customerPatch.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Patch Error: ${errs}` });
      }
    } else {
      const createCustMutation = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              didSucceed
              customer { id name email phone address { addressLine1 city } }
              inputErrors { message code path }
            }
          }
        `,
        variables: {
          input: {
            businessId,
            name: customerName || "Iron Foot Client",
            email: customerEmail || undefined,
            phone: cleanPhone,
            mobile: cleanPhone,
            address: addressInput,
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

      if (custData?.data?.customerCreate?.didSucceed === false) {
        const errs = custData.data.customerCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Create Error: ${errs}` });
      }

      customerId = custData?.data?.customerCreate?.customer?.id;
    }

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
        variables: { input: { businessId, name: "Handyman Services", unitPrice: "0.00" } }
      };

      const prodRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createProdMutation)
      });
      const prodData = await prodRes.json();

      if (prodData?.data?.productCreate?.didSucceed) {
        productId = prodData.data.productCreate.product.id;
      }
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Failed to resolve Wave Customer or Product ID." });
    }

    // 3. Draft Estimate
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
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createEstimateMutation)
    });

    const estimateData = await estimateRes.json();
    if (estimateData.errors && estimateData.errors.length > 0) {
      return res.status(400).json({ success: false, error: estimateData.errors[0].message });
    }

    if (estimateData?.data?.estimateCreate?.didSucceed === false) {
      const errs = estimateData.data.estimateCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: `Estimate Creation Error: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
