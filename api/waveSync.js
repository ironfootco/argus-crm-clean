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

  // Strict ISO 3166-2 Province Code Mapping required by Wave GraphQL
  const US_STATE_TO_ISO = {
    'ALABAMA': 'US-AL', 'ALASKA': 'US-AK', 'ARIZONA': 'US-AZ', 'ARKANSAS': 'US-AR', 'CALIFORNIA': 'US-CA',
    'COLORADO': 'US-CO', 'CONNECTICUT': 'US-CT', 'DELAWARE': 'US-DE', 'FLORIDA': 'US-FL', 'GEORGIA': 'US-GA',
    'HAWAII': 'US-HI', 'IDAHO': 'US-ID', 'ILLINOIS': 'US-IL', 'INDIANA': 'US-IN', 'IOWA': 'US-IA',
    'KANSAS': 'US-KS', 'KENTUCKY': 'US-KY', 'LOUISIANA': 'US-LA', 'MAINE': 'US-ME', 'MARYLAND': 'US-MD',
    'MASSACHUSETTS': 'US-MA', 'MICHIGAN': 'US-MI', 'MINNESOTA': 'US-MN', 'MISSISSIPPI': 'US-MS', 'MISSOURI': 'US-MO',
    'MONTANA': 'US-MT', 'NEBRASKA': 'US-NE', 'NEVADA': 'US-NV', 'NEW HAMPSHIRE': 'US-NH', 'NEW JERSEY': 'US-NJ',
    'NEW MEXICO': 'US-NM', 'NEW YORK': 'US-NY', 'NORTH CAROLINA': 'US-NC', 'NORTH DAKOTA': 'US-ND', 'OHIO': 'US-OH',
    'OKLAHOMA': 'US-OK', 'OREGON': 'US-OR', 'PENNSYLVANIA': 'US-PA', 'RHODE ISLAND': 'US-RI', 'SOUTH CAROLINA': 'US-SC',
    'SOUTH DAKOTA': 'US-SD', 'TENNESSEE': 'US-TN', 'TEXAS': 'US-TX', 'UTAH': 'US-UT', 'VERMONT': 'US-VT',
    'VIRGINIA': 'US-VA', 'WASHINGTON': 'US-WA', 'WEST VIRGINIA': 'US-WV', 'WISCONSIN': 'US-WI', 'WYOMING': 'US-WY',
    'AL': 'US-AL', 'AK': 'US-AK', 'AZ': 'US-AZ', 'AR': 'US-AR', 'CA': 'US-CA', 'CO': 'US-CO', 'CT': 'US-CT',
    'DE': 'US-DE', 'FL': 'US-FL', 'GA': 'US-GA', 'HI': 'US-HI', 'ID': 'US-ID', 'IL': 'US-IL', 'IN': 'US-IN',
    'IA': 'US-IA', 'KS': 'US-KS', 'KY': 'US-KY', 'LA': 'US-LA', 'ME': 'US-ME', 'MD': 'US-MD', 'MA': 'US-MA',
    'MI': 'US-MI', 'MN': 'US-MN', 'MS': 'US-MS', 'MO': 'US-MO', 'MT': 'US-MT', 'NE': 'US-NE', 'NV': 'US-NV',
    'NH': 'US-NH', 'NJ': 'US-NJ', 'NM': 'US-NM', 'NY': 'US-NY', 'NC': 'US-NC', 'ND': 'US-ND', 'OH': 'US-OH',
    'OK': 'US-OK', 'OR': 'US-OR', 'PA': 'US-PA', 'RI': 'US-RI', 'SC': 'US-SC', 'SD': 'US-SD', 'TN': 'US-TN',
    'TX': 'US-TX', 'UT': 'US-UT', 'VT': 'US-VT', 'VA': 'US-VA', 'WA': 'US-WA', 'WV': 'US-WV', 'WI': 'US-WI', 'WY': 'US-WY'
  };

  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const clean = addrStr.trim();
    if (!clean || clean.length < 3) return undefined;

    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    let line1 = '';
    let city = '';
    let provinceCode = 'US-MA';
    let postalCode = '';

    if (parts.length >= 3) {
      line1 = parts[0];
      city = parts[1];
      const lastParts = parts.slice(2).join(' ').split(' ').filter(Boolean);
      for (const p of lastParts) {
        const cleanP = p.toUpperCase().replace('US-', '');
        if (/^\d{5}(-\d{4})?$/.test(p)) {
          postalCode = p;
        } else if (US_STATE_TO_ISO[cleanP]) {
          provinceCode = US_STATE_TO_ISO[cleanP];
        }
      }
    } else if (parts.length === 2) {
      line1 = parts[0];
      city = parts[1];
    } else {
      line1 = clean;
    }

    return {
      addressLine1: line1 || clean,
      city: city || undefined,
      provinceCode: provinceCode, // "US-MA"
      postalCode: postalCode || undefined,
      countryCode: "US"
    };
  }

  const cleanEmail = (customerEmail && typeof customerEmail === 'string' && customerEmail.trim()) ? customerEmail.trim() : undefined;
  const cleanPhone = (customerPhone && typeof customerPhone === 'string' && customerPhone.trim()) ? customerPhone.trim() : undefined;
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
                customer { id name email phone address { addressLine1 city postalCode } }
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
              mobile: cleanPhone,
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
                customer { id name email phone address { addressLine1 city postalCode } }
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
              mobile: cleanPhone,
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
