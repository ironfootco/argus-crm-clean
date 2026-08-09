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
    return res.status(400).json({ success: false, error: 'WAVE_ACCESS_TOKEN environment variable is missing.' });
  }

  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  const US_STATE_CODES = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
    'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
    'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
    'AL': 'AL', 'AK': 'AK', 'AZ': 'AZ', 'AR': 'AR', 'CA': 'CA', 'CO': 'CO', 'CT': 'CT',
    'DE': 'DE', 'FL': 'FL', 'GA': 'GA', 'HI': 'HI', 'ID': 'ID', 'IL': 'IL', 'IN': 'IN',
    'IA': 'IA', 'KS': 'KS', 'KY': 'KY', 'LA': 'LA', 'ME': 'ME', 'MD': 'MD', 'MA': 'MA',
    'MI': 'MI', 'MN': 'MN', 'MS': 'MS', 'MO': 'MO', 'MT': 'MT', 'NE': 'NE', 'NV': 'NV',
    'NH': 'NH', 'NJ': 'NJ', 'NM': 'NM', 'NY': 'NY', 'NC': 'NC', 'ND': 'ND', 'OH': 'OH',
    'OK': 'OK', 'OR': 'OR', 'PA': 'PA', 'RI': 'RI', 'SC': 'SC', 'SD': 'SD', 'TN': 'TN',
    'TX': 'TX', 'UT': 'UT', 'VT': 'VT', 'VA': 'VA', 'WA': 'WA', 'WV': 'WV', 'WI': 'WI', 'WY': 'WY'
  };

  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const clean = addrStr.trim();
    if (!clean || clean.length < 3) return undefined;

    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    let line1 = '';
    let city = '';
    let provinceCode = 'MA';
    let postalCode = '';

    if (parts.length >= 3) {
      line1 = parts[0];
      city = parts[1];
      const lastParts = parts.slice(2).join(' ').split(' ').filter(Boolean);
      for (const p of lastParts) {
        const cleanP = p.toUpperCase().replace('US-', '');
        if (/^\d{5}(-\d{4})?$/.test(p)) {
          postalCode = p;
        } else if (US_STATE_CODES[cleanP]) {
          provinceCode = US_STATE_CODES[cleanP];
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
      provinceCode,
      postalCode: postalCode || undefined,
      countryCode: "US"
    };
  }

  const addressInput = parseAddress(customerAddress);
  const cleanPhone = customerPhone ? customerPhone.trim() : undefined;

  try {
    // 1. Query catalog for existing customer & product
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

    if (customerEmail) {
      const match = existingCustomers.find(c => c.email && c.email.toLowerCase().trim() === customerEmail.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    if (!customerId && customerName) {
      const match = existingCustomers.find(c => c.name && c.name.toLowerCase().trim() === customerName.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    // 2. Patch Existing Customer OR Create New Customer (omitting firstName/lastName to prevent duplicate names)
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
              email: customerEmail || undefined,
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
              email: customerEmail || undefined,
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

    // 3. Create Draft Estimate
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
