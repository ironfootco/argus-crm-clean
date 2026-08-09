export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) {
    return res.status(400).json({ success: false, error: 'Wave access token is missing in Vercel environment variables.' });
  }

  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // Clean contact info
  const cleanEmail = customerEmail ? String(customerEmail).trim() : undefined;
  const cleanPhone = customerPhone ? String(customerPhone).trim() : undefined;

  // Strict parser mapped directly to the Wave Billing UI
  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const clean = addrStr.trim();
    if (!clean) return undefined;

    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    
    let line1 = parts[0];
    let city = parts.length > 1 ? parts[1] : undefined;
    let postalCode = undefined;

    // Safely extract a 5-digit zip code anywhere in the address string
    const zipMatch = clean.match(/\b\d{5}\b/);
    if (zipMatch) {
      postalCode = zipMatch[0];
    }

    return {
      addressLine1: line1,
      city: city || undefined,
      provinceCode: "US-MA", // Locked to Massachusetts
      countryCode: "US",     // Locked to United States
      postalCode: postalCode || undefined
    };
  }

  const addressInput = parseAddress(customerAddress);

  try {
    // 1. Fetch Business Catalog
    const catalogRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query($businessId: ID!) {
            business(id: $businessId) {
              customers(page: 1, pageSize: 250) {
                edges { node { id name email } }
              }
              products(page: 1, pageSize: 10) {
                edges { node { id name } }
              }
            }
          }
        `,
        variables: { businessId }
      })
    });

    const catalogData = await catalogRes.json();
    if (catalogData.errors?.length) {
      return res.status(400).json({ success: false, error: `Wave Catalog Query Error: ${catalogData.errors[0].message}` });
    }

    const existingCustomers = catalogData?.data?.business?.customers?.edges?.map(e => e.node) || [];
    let productId = catalogData?.data?.business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

    // Find existing customer
    if (cleanEmail) {
      const match = existingCustomers.find(c => c.email && c.email.toLowerCase().trim() === cleanEmail.toLowerCase());
      if (match) customerId = match.id;
    }

    if (!customerId && customerName) {
      const match = existingCustomers.find(c => c.name && c.name.toLowerCase().trim() === customerName.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    // 2. Customer Update or Creation
    if (customerId) {
      const patchRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ($input: CustomerPatchInput!) {
              customerPatch(input: $input) {
                didSucceed
                customer { id name email phone address { addressLine1 city provinceCode countryCode postalCode } }
                inputErrors { message path }
              }
            }
          `,
          variables: {
            input: {
              id: customerId,
              name: customerName || undefined,
              email: cleanEmail,
              phone: cleanPhone,
              address: addressInput
            }
          }
        })
      });

      const patchData = await patchRes.json();
      if (patchData.errors?.length) {
        return res.status(400).json({ success: false, error: `Customer Patch Syntax Error: ${patchData.errors[0].message}` });
      }
      if (patchData?.data?.customerPatch?.didSucceed === false) {
        const errs = patchData.data.customerPatch.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Wave Rejected Customer Patch: ${errs}` });
      }
    } else {
      const createRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ($input: CustomerCreateInput!) {
              customerCreate(input: $input) {
                didSucceed
                customer { id name email phone address { addressLine1 city provinceCode countryCode postalCode } }
                inputErrors { message path }
              }
            }
          `,
          variables: {
            input: {
              businessId,
              name: customerName || "Iron Foot Client",
              email: cleanEmail,
              phone: cleanPhone,
              address: addressInput,
              currency: "USD"
            }
          }
        })
      });

      const createData = await createRes.json();

      if (createData.errors?.length) {
        return res.status(400).json({ success: false, error: `Customer Create Syntax Error: ${createData.errors[0].message}` });
      }
      if (createData?.data?.customerCreate?.didSucceed === false) {
        const errs = createData.data.customerCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Wave Rejected Customer Creation: ${errs}` });
      }

      customerId = createData?.data?.customerCreate?.customer?.id;
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Could not resolve Customer ID or Product ID in Wave." });
    }

    // 3. Draft Estimate Creation
    const estimateRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ($input: EstimateCreateInput!) {
            estimateCreate(input: $input) {
              didSucceed
              estimate { id viewUrl }
              inputErrors { message path }
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
      })
    });

    const estimateData = await estimateRes.json();

    if (estimateData.errors?.length) {
      return res.status(400).json({ success: false, error: `Estimate Syntax Error: ${estimateData.errors[0].message}` });
    }

    if (estimateData?.data?.estimateCreate?.didSucceed === false) {
      const errs = estimateData.data.estimateCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: `Estimate Creation Error: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    return res.status(500).json({ success: false, error: `Server Exception: ${err.message}` });
  }
}
