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
  const rawBusinessId = process.env.WAVE_BUSINESS_ID;

  if (!token || !rawBusinessId) {
    return res.status(400).json({ success: false, error: 'Wave API keys missing in Vercel.' });
  }

  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = btoa(`Business:${rawBusinessId}`);
  }

  // Format addresses into ISO 3166-2 schema for Wave (e.g., US-MA)
  function parseAddress(addrStr) {
    if (!addrStr || !addrStr.trim()) return undefined;
    const clean = addrStr.trim();
    
    const parts = clean.split(',').map(s => s.trim());
    if (parts.length >= 3) {
      const line1 = parts[0];
      const city = parts[1];
      const stateZip = parts[2].split(' ').filter(Boolean);
      
      let prov = stateZip[0] ? stateZip[0].toUpperCase() : '';
      if (prov.length === 2 && !prov.startsWith('US-')) {
        prov = `US-${prov}`;
      }

      const postalCode = stateZip[1] || '';
      return {
        addressLine1: line1,
        city: city,
        provinceCode: prov,
        postalCode: postalCode,
        countryCode: 'US'
      };
    }

    return {
      addressLine1: clean,
      countryCode: 'US'
    };
  }

  try {
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
                  phone
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

    const formattedAddress = parseAddress(customerAddress);

    // Update existing customer via customerPatch or create new customer profile
    if (customerId) {
      const patchCustMutation = {
        query: `
          mutation ($input: CustomerPatchInput!) {
            customerPatch(input: $input) {
              didSucceed
              customer { id }
              inputErrors { message code path }
            }
          }
        `,
        variables: {
          input: {
            id: customerId,
            name: customerName || undefined,
            email: customerEmail || undefined,
            phone: customerPhone || undefined,
            address: formattedAddress
          }
        }
      };

      await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchCustMutation)
      });
    } else {
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
            phone: customerPhone || undefined,
            address: formattedAddress,
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

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
