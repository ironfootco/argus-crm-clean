export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse payload safely from POST body or GET query parameters
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}))
      : (req.query || {});

    const { action, jobTitle, notes, customerName, customerEmail, customerPhone, customerAddress, quotedPrice } = body;

    const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
    const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

    if (!token) {
      return res.status(200).json({ success: false, error: 'Wave token missing in Vercel Environment Variables.' });
    }

    let businessId = rawBusinessId;
    if (!rawBusinessId.startsWith('Qn')) {
      businessId = Buffer.from(`Business:${rawBusinessId}`).toString('base64');
    }

    const waveApi = async (query, variables, stepName) => {
      const response = await fetch('https://gql.waveapps.com/graphql/public', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Wave GraphQL HTTP ${response.status}: ${text}`);
      }

      const json = await response.json();
      if (json.errors?.length > 0) {
        throw new Error(`Wave API (${stepName}): ${json.errors[0].message}`);
      }
      return json.data;
    };

    // --- CLEAN & PREPARE CUSTOMER DATA ---
    let finalName = customerName || "";
    if (!finalName && jobTitle && jobTitle.includes(' - ')) {
      finalName = jobTitle.split(' - ')[0].trim();
    }
    if (!finalName) finalName = "New Customer";

    // Standardize Phone for Wave: 781-555-7824 (Dashes only, no country codes or parentheses)
    let cleanDigits = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';
    if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) cleanDigits = cleanDigits.slice(1);
    
    let formattedWavePhone = cleanDigits;
    if (cleanDigits.length === 10) {
      formattedWavePhone = `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
    }

    let addressInput = null;
    if (customerAddress && typeof customerAddress === 'string' && customerAddress.trim()) {
      const parts = customerAddress.split(',').map(s => s.trim()).filter(Boolean);
      const zipMatch = customerAddress.match(/\b\d{5}\b/);
      addressInput = { countryCode: "US", provinceCode: "US-MA" };
      if (parts.length > 0) addressInput.addressLine1 = parts[0];
      if (parts.length > 1) addressInput.city = parts[1].replace(/\b\d{5}\b/g, '').trim();
      if (zipMatch) addressInput.postalCode = zipMatch[0];
    }

    const customerInput = {
      businessId,
      name: finalName,
      currency: "USD"
    };
    if (customerEmail && typeof customerEmail === 'string' && customerEmail.trim()) {
      customerInput.email = customerEmail.trim();
    }
    if (formattedWavePhone) {
      customerInput.phone = formattedWavePhone;
    }
    if (addressInput) {
      customerInput.address = addressInput;
    }

    // STEP 1: Create Customer
    const createData = await waveApi(`
      mutation ($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          didSucceed
          inputErrors { message path }
          customer { id }
        }
      }
    `, { input: customerInput }, "Create Customer");

    if (!createData?.customerCreate?.didSucceed) {
      const inputErrs = createData?.customerCreate?.inputErrors;
      const errMsgs = inputErrs && inputErrs.length > 0 
        ? inputErrs.map(e => `${e.path ? e.path.join('.') + ': ' : ''}${e.message}`).join(' | ')
        : 'Wave rejected customer creation';
      throw new Error(`Wave Customer Create Failed: ${errMsgs}`);
    }

    const customerId = createData.customerCreate.customer.id;

    // --- ACTION: CUSTOMER ONLY (From Chat Modal) ---
    if (action === 'create_customer_only') {
      return res.status(200).json({ success: true, waveCustomerId: customerId });
    }

    // --- ACTION: FULL JOB ESTIMATE SYNC ---
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
    if (!productId) return res.status(200).json({ success: false, error: "No Products found in Wave catalog." });

    const finalMemo = `Job: ${jobTitle || 'General Handyman'}\n\nSite / Estimating Notes:\n${notes || 'No notes logged.'}`;

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

    if (!estimateData?.estimateCreate?.didSucceed) {
      const inputErrs = estimateData?.estimateCreate?.inputErrors;
      const errMsgs = inputErrs && inputErrs.length > 0 
        ? inputErrs.map(e => `${e.path ? e.path.join('.') + ': ' : ''}${e.message}`).join(' | ')
        : 'Wave rejected estimate creation';
      throw new Error(`Estimate Create Failed: ${errMsgs}`);
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error("Wave Unified Sync Failed:", err);
    return res.status(200).json({ success: false, error: err.message || "Unknown Wave error" });
  }
}
