export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  
  // 1. Company Name is First and Last combined
  let customerName = req.body?.customerName || "";
  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }
  if (!customerName) {
    customerName = "New Customer";
  }

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";
  
  if (!token) return res.status(400).json({ success: false, error: 'Wave access token missing.' });
  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // Helper for executing sequential Wave API queries with explicit error tracing
  const waveApi = async (query, variables, step) => {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
    
    const json = await response.json();
    
    if (json.errors?.length > 0) {
      console.error(`[Wave API Error - ${step}]`, JSON.stringify(json.errors, null, 2));
      throw new Error(`Wave API Error (${step}): ${json.errors[0].message}`);
    }
    return json.data;
  };

  try {
    // ---------------------------------------------------------
    // STEP 1: Search for Existing Customer & Get Product ID
    // ---------------------------------------------------------
    const catalogData = await waveApi(`
      query($businessId: ID!) {
        business(id: $businessId) {
          customers(page: 1, pageSize: 250) {
            edges { node { id name email } }
          }
          products(page: 1, pageSize: 10) {
            edges { node { id } }
          }
        }
      }
    `, { businessId }, "Search Catalog");

    const existingCustomers = catalogData.business.customers.edges?.map(e => e.node) || [];
    const productId = catalogData.business.products.edges?.[0]?.node?.id;
    
    if (!productId) return res.status(400).json({ success: false, error: "No Products found in Wave catalog." });

    let customerId = null;
    const cleanEmail = customerEmail?.trim();
    
    if (cleanEmail) {
      customerId = existingCustomers.find(c => c.email?.toLowerCase() === cleanEmail.toLowerCase())?.id;
    }
    if (!customerId) {
      customerId = existingCustomers.find(c => c.name?.toLowerCase() === customerName.toLowerCase())?.id;
    }

    // ---------------------------------------------------------
    // STEP 2: Build Strict Wave API Payload (Mapping perfectly to CSV)
    // ---------------------------------------------------------
    const customerPayload = {
      name: customerName, // Translates to 'Company Name' in Wave
      currency: "USD"     // Strict Enum mapping for 'usd'
    };

    if (cleanEmail) customerPayload.email = cleanEmail;
    if (customerPhone?.trim()) customerPayload.phone = customerPhone.trim();

    if (customerAddress?.trim()) {
      const parts = customerAddress.split(',').map(s => s.trim()).filter(Boolean);
      const zipMatch = customerAddress.match(/\b\d{5}\b/);
      
      // Mapped strictly to Address 1, City, Postal Code, Country, Province
      customerPayload.address = {
        addressLine1: parts[0] || customerAddress.trim(),
        countryCode: "US",     // Country MUST be "US" Enum for API
        provinceCode: "US-MA"  // State MUST be ISO code for API
      };
      
      if (parts.length > 1) {
        const city = parts[1].replace(/\b\d{5}\b/g, '').trim();
        if (city) customerPayload.address.city = city;
      }
      if (zipMatch) {
        customerPayload.address.postalCode = zipMatch[0];
      }
    }

    // ---------------------------------------------------------
    // STEP 3: Create or Patch Customer
    // ---------------------------------------------------------
    if (customerId) {
      // Patch Existing - Ensures any new address data provided on the frontend is actively saved
      const patchData = await waveApi(`
        mutation ($input: CustomerPatchInput!) {
          customerPatch(input: $input) {
            didSucceed
            inputErrors { message path }
          }
        }
      `, { input: { id: customerId, ...customerPayload } }, "Patch Customer");
      
      if (!patchData.customerPatch.didSucceed) {
        const errs = patchData.customerPatch.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Patch Failed: ${errs}` });
      }
    } else {
      // Create New
      const createData = await waveApi(`
        mutation ($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            didSucceed
            inputErrors { message path }
            customer { id }
          }
        }
      `, { input: { businessId, ...customerPayload } }, "Create Customer");
      
      if (!createData.customerCreate.didSucceed) {
        const errs = createData.customerCreate.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Create Failed: ${errs}` });
      }
      customerId = createData.customerCreate.customer.id;
    }

    // ---------------------------------------------------------
    // STEP 4: Create Estimate
    // ---------------------------------------------------------
    const estimateData = await waveApi(`
      mutation ($input: EstimateCreateInput!) {
        estimateCreate(input: $input) {
          didSucceed
          inputErrors { message path }
          estimate { id viewUrl }
        }
      }
    `, {
      input: {
        businessId,
        customerId,
        memo: `Job: ${jobTitle || 'General Handyman'}\n\nSite / Estimating Notes:\n${notes || 'No notes logged.'}`,
        items: [{
          productId,
          description: jobTitle || 'Handyman Services',
          unitPrice: String(quotedPrice || 0),
          quantity: "1"
        }]
      }
    }, "Create Estimate");

    if (!estimateData.estimateCreate.didSucceed) {
      const errs = estimateData.estimateCreate.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: `Estimate Create Failed: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    // If it fails now, Vercel will explicitly throw which step broke 
    return res.status(500).json({ success: false, error: err.message });
  }
}
