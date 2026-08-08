export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }

  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) return res.status(400).json({ success: false, error: 'Wave access token missing.' });

  let businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

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
    'VIRGINIA': 'US-VA', 'WASHINGTON': 'US-WA', 'WEST VIRGINIA': 'US-WV', 'WISCONSIN': 'US-WI', 'WYOMING': 'US-WY'
  };

  function parseAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return undefined;
    const parts = addrStr.split(',').map(s => s.trim()).filter(Boolean);
    
    if (parts.length >= 3) {
      const line1 = parts[0];
      const city = parts[1];
      const lastParts = parts.slice(2).join(' ').split(' ').filter(Boolean);
      let provinceCode = 'US-MA';
      let postalCode = '';
      
      for (const p of lastParts) {
        const pUpper = p.toUpperCase().replace('US-', '');
        if (/^\d{5}(-\d{4})?$/.test(p)) {
          postalCode = p;
        } else if (pUpper.length === 2 && US_STATE_TO_ISO[pUpper]) {
          provinceCode = `US-${pUpper}`;
        } else if (US_STATE_TO_ISO[pUpper]) {
          provinceCode = US_STATE_TO_ISO[pUpper];
        }
      }

      return {
        addressLine1: line1,
        city: city,
        provinceCode: provinceCode,
        postalCode: postalCode || undefined,
        countryCode: "US"
      };
    }

    return { addressLine1: addrStr.trim(), countryCode: "US" };
  }

  try {
    // 1. Query existing customers & products
    const initialQuery = {
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

    const initialRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(initialQuery)
    });

    const initialData = await initialRes.json();
    const existingCustomers = initialData?.data?.business?.customers?.edges?.map(e => e.node) || [];
    let productId = initialData?.data?.business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

    if (customerEmail) {
      const match = existingCustomers.find(c => c.email && c.email.toLowerCase().trim() === customerEmail.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    if (!customerId && customerName) {
      const match = existingCustomers.find(c => c.name && c.name.toLowerCase().trim() === customerName.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    const addressInput = parseAddress(customerAddress);
    const cleanPhone = customerPhone ? customerPhone.trim() : undefined;

    // 2. Patch existing customer or create new
    if (customerId) {
      const patchCustMutation = {
        query: `
          mutation ($input: CustomerPatchInput!) {
            customerPatch(input: $input) {
              didSucceed
              customer { id name email phone address { addressLine1 city } }
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
        body: JSON.stringify(patchCustMutation)
      });
    } else {
      const createCustMutation = {
        query: `
          mutation ($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              didSucceed
              customer { id name email phone address { addressLine1 city } }
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
      };

      const custRes = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createCustMutation)
      });
      const custData = await custRes.json();
      customerId = custData?.data?.customerCreate?.customer?.id;
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Missing Customer or Product ID in Wave." });
    }

    // 3. Create Draft Estimate
    const createEstimateMutation = {
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
    };

    const estimateRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createEstimateMutation)
    });

    const estimateData = await estimateRes.json();
    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
