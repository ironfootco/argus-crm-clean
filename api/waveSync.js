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

  // Parse address into Wave's AddressInput schema (guaranteeing invalid name fallbacks are ignored)
  function parseAddress(addrStr) {
    if (!addrStr || !addrStr.trim() || addrStr.trim().toLowerCase() === customerName.trim().toLowerCase()) {
      return undefined;
    }
    const clean = addrStr.trim();
    const parts = clean.split(',').map(s => s.trim());

    if (parts.length >= 3) {
      const line1 = parts[0];
      const city = parts[1];
      const stateZip = parts[2].split(' ').filter(Boolean);
      let prov = stateZip[0] ? stateZip[0].toUpperCase().replace('US-', '') : '';
      const postalCode = stateZip[1] || '';
      return {
        addressLine1: line1,
        city: city,
        provinceCode: prov || undefined,
        postalCode: postalCode || undefined,
        countryCode: 'US'
      };
    }

    return {
      addressLine1: clean,
      countryCode: 'US'
    };
  }

  try {
    // 1. Fetch existing customers & products
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
                  mobile
                  address {
                    addressLine1
                    city
                    postalCode
                  }
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

    // 2. Patch existing customer or create new customer strictly using Customer Name
    if (customerId) {
      const patchCustMutation = {
        query: `
          mutation ($input: CustomerPatchInput!) {
            customerPatch(input: $input) {
              didSucceed
              customer {
                id
                name
                email
                phone
              }
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

      if (patchData.errors && patchData.errors.length > 0) {
        return res.status(400).json({ success: false, error: patchData.errors[0].message });
      }

      if (patchData?.data?.customerPatch?.didSucceed === false) {
        const errs = patchData.data.customerPatch.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Update Failed: ${errs}` });
      }
    } else {
      const createCustMutation = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              didSucceed
              customer {
                id
                name
                email
                phone
              }
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

      if (custData.errors && custData.errors.length > 0) {
        return res.status(400).json({ success: false, error: custData.errors[0].message });
      }

      if (custData?.data?.customerCreate?.didSucceed === false) {
        const errs = custData.data.customerCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Creation Failed: ${errs}` });
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

    // 3. Create Draft Estimate
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
      return res.status(400).json({ success: false, error: `Estimate Creation Failed: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error('Wave GraphQL Exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
