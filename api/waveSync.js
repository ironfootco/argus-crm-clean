export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  let customerName = req.body?.customerName || "";

  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }
  if (!customerName) {
    customerName = "New Customer";
  }

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) {
    return res.status(400).json({ success: false, error: 'Wave access token is missing.' });
  }

  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // 1. Force strict string conversion. If it's empty, it becomes strictly undefined 
  // so it isn't included in the GraphQL payload at all.
  const cleanEmail = customerEmail ? String(customerEmail).trim() : undefined;
  const cleanPhone = customerPhone ? String(customerPhone).trim() : undefined;

  // 2. Build the strict AddressInput matching Wave's Billing block perfectly.
  let addressInput = undefined;
  if (customerAddress && typeof customerAddress === 'string' && customerAddress.trim().length > 0) {
    const cleanStr = customerAddress.trim();
    const parts = cleanStr.split(',').map(s => s.trim()).filter(Boolean);
    const zipMatch = cleanStr.match(/\b\d{5}\b/);
    
    addressInput = {
      provinceCode: "US-MA", // Strictly locked to Massachusetts
      countryCode: "US"      // Strictly locked to United States
    };
    
    if (parts.length > 0) {
      addressInput.addressLine1 = parts[0];
    }
    if (parts.length > 1) {
      // Get city and strip out any accidentally included zip code
      const cityVal = parts[1].replace(/\b\d{5}\b/g, '').trim();
      if (cityVal) addressInput.city = cityVal;
    }
    if (zipMatch) {
      addressInput.postalCode = zipMatch[0];
    }
  }

  // 3. Wrapper for cleaner, sequential API calls with strict error trapping
  const waveQuery = async (query, variables, stepName) => {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
    
    const json = await response.json();
    
    // If Wave triggers a schema or validation error, catch it explicitly
    if (json.errors && json.errors.length > 0) {
      const errorMsg = json.errors[0].message;
      console.error(`[Wave Error - ${stepName}]`, JSON.stringify(json.errors, null, 2));
      throw new Error(`Wave API Error (${stepName}): ${errorMsg}`);
    }
    return json.data;
  };

  try {
    // ---------------------------------------------------------
    // 1. SEARCH CATALOG
    // ---------------------------------------------------------
    const catalogData = await waveQuery(`
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
    `, { businessId }, "Search Catalog");

    const existingCustomers = catalogData?.business?.customers?.edges?.map(e => e.node) || [];
    let productId = catalogData?.business?.products?.edges?.[0]?.node?.id;
    let customerId = null;

    if (cleanEmail) {
      const match = existingCustomers.find(c => c.email && c.email.toLowerCase().trim() === cleanEmail.toLowerCase());
      if (match) customerId = match.id;
    }
    if (!customerId && customerName) {
      const match = existingCustomers.find(c => c.name && c.name.toLowerCase().trim() === customerName.toLowerCase().trim());
      if (match) customerId = match.id;
    }

    // ---------------------------------------------------------
    // 2. CREATE OR PATCH CUSTOMER
    // ---------------------------------------------------------
    if (customerId) {
      // PATCH EXISTING CUSTOMER
      const patchInput = {
        id: customerId,
        name: customerName,
      };
      
      // Native Field Mappings
      if (cleanEmail) patchInput.email = cleanEmail;
      if (cleanPhone) patchInput.phone = cleanPhone;
      if (addressInput) patchInput.address = addressInput;

      // Notice we ONLY ask for 'id' back to bypass any output schema mismatches
      const patchData = await waveQuery(`
        mutation ($input: CustomerPatchInput!) {
          customerPatch(input: $input) {
            didSucceed
            inputErrors { code message path }
            customer { id }
          }
        }
      `, { input: patchInput }, "Patch Customer");

      if (patchData.customerPatch.didSucceed === false) {
        const errs = patchData.customerPatch.inputErrors?.map(e => `${e.path?.join('.') || 'Error'}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Patch Rejected: ${errs}` });
      }
    } else {
      // CREATE NEW CUSTOMER
      const createInput = {
        businessId: businessId,
        name: customerName,
        currency: "USD"
      };
      
      // Native Field Mappings
      if (cleanEmail) createInput.email = cleanEmail;
      if (cleanPhone) createInput.phone = cleanPhone;
      if (addressInput) createInput.address = addressInput;

      // Notice we ONLY ask for 'id' back to bypass any output schema mismatches
      const createData = await waveQuery(`
        mutation ($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            didSucceed
            inputErrors { code message path }
            customer { id }
          }
        }
      `, { input: createInput }, "Create Customer");

      if (createData.customerCreate.didSucceed === false) {
        const errs = createData.customerCreate.inputErrors?.map(e => `${e.path?.join('.') || 'Error'}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Create Rejected: ${errs}` });
      }
      customerId = createData.customerCreate.customer.id;
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Could not resolve Customer ID or Product ID." });
    }

    // ---------------------------------------------------------
    // 3. CREATE ESTIMATE
    // ---------------------------------------------------------
    const estimateData = await waveQuery(`
      mutation ($input: EstimateCreateInput!) {
        estimateCreate(input: $input) {
          didSucceed
          inputErrors { code message path }
          estimate { id viewUrl }
        }
      }
    `, {
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
    }, "Create Estimate");

    if (estimateData.estimateCreate.didSucceed === false) {
      const errs = estimateData.estimateCreate.inputErrors?.map(e => `${e.path?.join('.') || 'Error'}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: `Estimate Creation Rejected: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    // If it fails now, Vercel will explicitly throw which step broke 
    console.error("Wave Sync Exception:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
