export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }

  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  let businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  const STATE_NAMES = {
    'MA': 'Massachusetts', 'RI': 'Rhode Island', 'NJ': 'New Jersey', 'NY': 'New York',
    'CT': 'Connecticut', 'NH': 'New Hampshire', 'VT': 'Vermont', 'ME': 'Maine', 'FL': 'Florida'
  };

  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const parts = addrStr.split(',').map(s => s.trim()).filter(Boolean);
    
    if (parts.length >= 3) {
      const line1 = parts[0];
      const city = parts[1];
      const lastParts = parts.slice(2).join(' ').split(' ').filter(Boolean);
      let provinceName = '';
      let postalCode = '';
      
      for (const p of lastParts) {
        const cleanP = p.toUpperCase().replace('US-', '');
        if (/^\d{5}(-\d{4})?$/.test(p)) {
          postalCode = p;
        } else if (STATE_NAMES[cleanP]) {
          provinceName = STATE_NAMES[cleanP];
        } else if (p.length > 2) {
          provinceName = p;
        }
      }

      return {
        addressLine1: line1,
        city: city,
        provinceCode: provinceName || "Massachusetts",
        postalCode: postalCode || undefined,
        countryCode: "US"
      };
    }

    return { addressLine1: addrStr.trim(), countryCode: "US" };
  }

  try {
    // 1. Query Wave catalog for existing customer ID
    const catalogQuery = {
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
    };

    const catRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(catalogQuery)
    });

    const catData = await catRes.json();
    const existingCustomers = catData?.data?.business?.customers?.edges?.map(e => e.node) || [];
    let productId = catData?.data?.business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

    if (customerEmail) {
      const match = existingCustomers.find(c => c.email && c.email.toLowerCase() === customerEmail.toLowerCase());
      if (match) customerId = match.id;
    }

    if (!customerId && customerName) {
      const match = existingCustomers.find(c => c.name && c.name.toLowerCase() === customerName.toLowerCase());
      if (match) customerId = match.id;
    }

    const addressInput = parseAddress(customerAddress);
    const cleanPhone = customerPhone ? customerPhone.trim() : undefined;

    // 2. Patch Customer profile in Wave with complete address
    if (customerId) {
      const patchMutation = {
        query: `
          mutation ($input: CustomerPatchInput!) {
            customerPatch(input: $input) {
              didSucceed
              customer { id name address { addressLine1 city } }
              inputErrors { message path }
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

      await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchMutation)
      });
    }

    // 3. Create Draft Estimate
    const estimateMutation = {
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
          items: [{ productId, description: jobTitle || 'Handyman Services', unitPrice: String(quotedPrice || 0), quantity: "1" }]
        }
      }
    };

    const estRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(estimateMutation)
    });

    const estData = await estRes.json();
    return res.status(200).json({ success: true, data: estData });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
