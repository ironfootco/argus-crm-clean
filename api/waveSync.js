export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  
  // 1. Resolve Company Name
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

  // 2. Aggressively scrub empty strings to prevent Wave API silent drops
  const cleanEmail = customerEmail?.trim() || undefined;
  const cleanPhone = customerPhone?.trim() || undefined;

  let addressInput = undefined;
  if (customerAddress?.trim()) {
    const parts = customerAddress.split(',').map(s => s.trim()).filter(Boolean);
    const zipMatch = customerAddress.match(/\b\d{5}\b/);
    
    addressInput = {
      countryCode: "US",    
      provinceCode: "US-MA" 
    };
    
    if (parts[0]) addressInput.addressLine1 = parts[0];
    
    if (parts.length > 1) {
      const city = parts[1].replace(/\b\d{5}\b/g, '').trim();
      if (city) addressInput.city = city;
    }
    
    if (zipMatch) {
      addressInput.postalCode = zipMatch[0];
    }
  }

  const waveApi = async (query, variables) => {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
    const json = await response.json();
    if (json.errors?.length > 0) throw new Error(json.errors[0].message);
    return json.data;
  };

  try {
    // --- STEP 1: Search Catalog ---
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
    `, { businessId });

    const existingCustomers = catalogData.business.customers.edges?.map(e => e.node) || [];
    const productId = catalogData.business.products.edges?.[0]?.node?.id;
    
    if (!productId) return res.status(400).json({ success: false, error: "No Products found in Wave catalog." });

    let customerId = null;
    if (cleanEmail) {
      customerId = existingCustomers.find(c => c.email?.toLowerCase() === cleanEmail.toLowerCase())?.id;
    }
    if (!customerId) {
      customerId = existingCustomers.find(c => c.name?.toLowerCase() === customerName.toLowerCase())?.id;
    }

    // --- STEP 2: Build Strict Customer Payload ---
    const customerPayload = {
      name: customerName,
      currency: "USD" 
    };
    if (cleanEmail) customerPayload.email = cleanEmail;
    if (cleanPhone) customerPayload.phone = cleanPhone;
    if (addressInput) customerPayload.address = addressInput;

    // --- STEP 3: Create or Patch Customer ---
    if (customerId) {
      const patchData = await waveApi(`
        mutation ($input: CustomerPatchInput!) {
          customerPatch(input: $input) {
            didSucceed
            inputErrors { message path }
          }
        }
      `, { input: { id: customerId, ...customerPayload } });
      
      if (!patchData.customerPatch.didSucceed) {
        return res.status(400).json({ success: false, error: "Customer Patch Failed" });
      }
    } else {
      const createData = await waveApi(`
        mutation ($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            didSucceed
            customer { id }
            inputErrors { message path }
          }
        }
      `, { input: { businessId, ...customerPayload } });
      
      if (!createData.customerCreate.didSucceed) {
        return res.status(400).json({ success: false, error: "Customer Create Failed" });
      }
      customerId = createData.customerCreate.customer.id;
    }

    // --- STEP 4: Create Estimate ---
    const estimateData = await waveApi(`
      mutation ($input: EstimateCreateInput!) {
        estimateCreate(input: $input) {
          didSucceed
          estimate { id viewUrl }
          inputErrors { message path }
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
    });

    if (!estimateData.estimateCreate.didSucceed) {
      return res.status(400).json({ success: false, error: "Estimate Create Failed" });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
