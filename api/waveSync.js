export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice } = req.body || {};
  
  // 1. Resolve Company Name (Mapped to CSV 'Company Name')
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

  // Fetch Wrapper for explicit error tracing
  const waveApi = async (query, variables, stepName) => {
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
      console.error(`[${stepName} Error]`, JSON.stringify(json.errors, null, 2));
      throw new Error(`Wave API Error (${stepName}): ${json.errors[0].message}`);
    }
    return json.data;
  };

  try {
    // ---------------------------------------------------------
    // STEP 1: Fetch Product ID (Required for Estimate)
    // ---------------------------------------------------------
    const catalogData = await waveApi(`
      query($businessId: ID!) {
        business(id: $businessId) {
          products(page: 1, pageSize: 10) {
            edges { node { id } }
          }
        }
      }
    `, { businessId }, "Fetch Products");
    
    const productId = catalogData?.business?.products?.edges?.[0]?.node?.id;
    if (!productId) return res.status(400).json({ success: false, error: "No Products found in Wave catalog." });

    // ---------------------------------------------------------
    // STEP 2: Strict Customer Create (Per Developer Portal)
    // ---------------------------------------------------------
    let addressInput = null;
    
    // Safely parse the address only if it exists
    if (customerAddress && customerAddress.trim()) {
      const parts = customerAddress.split(',').map(s => s.trim()).filter(Boolean);
      const zipMatch = customerAddress.match(/\b\d{5}\b/);
      
      addressInput = {
        addressLine1: parts[0] || customerAddress.trim(),
        countryCode: "US",     // Strict Enum Mapping
        provinceCode: "US-MA"  // Strict ISO-3166-2 Mapping
      };
      
      if (parts.length > 1) {
        const city = parts[1].replace(/\b\d{5}\b/g, '').trim();
        if (city) addressInput.city = city;
      }
      if (zipMatch) {
        addressInput.postalCode = zipMatch[0];
      }
    }

    const customerInput = {
      businessId,
      name: customerName,
      currency: "USD"
    };
    
    if (customerEmail && customerEmail.trim()) customerInput.email = customerEmail.trim();
    if (customerPhone && customerPhone.trim()) customerInput.phone = customerPhone.trim();
    if (addressInput) customerInput.address = addressInput;

    const createData = await waveApi(`
      mutation ($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          didSucceed
          inputErrors { message path }
          customer { id }
        }
      }
    `, { input: customerInput }, "Create Customer");

    if (!createData.customerCreate.didSucceed) {
      const errs = createData.customerCreate.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Customer Create Failed: ${errs}`);
    }
    
    const customerId = createData.customerCreate.customer.id;

    // ---------------------------------------------------------
    // STEP 3: Create Estimate (With Diagnostic Info)
    // ---------------------------------------------------------
    
    // This will print directly onto the Estimate memo so you can visually verify
    // exactly what Vercel received from your React frontend payload.
    const diagnosticStr = `\n\n--- SYNC DIAGNOSTICS ---\nReceived Email: ${customerEmail || 'NONE'}\nReceived Phone: ${customerPhone || 'NONE'}\nReceived Address: ${customerAddress || 'NONE'}`;
    const finalMemo = `Job: ${jobTitle || 'General Handyman'}\n\nSite / Estimating Notes:\n${notes || 'No notes logged.'}${diagnosticStr}`;

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
        memo: finalMemo,
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
      throw new Error(`Estimate Create Failed: ${errs}`);
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
