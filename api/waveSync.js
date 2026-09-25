export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { action, jobTitle, notes, customerName, customerEmail, customerPhone, customerAddress, quotedPrice } = body;

    const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
    const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

    if (!token) return res.status(400).json({ success: false, error: 'Wave token missing.' });

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
      const json = await response.json();
      if (json.errors?.length > 0) {
        throw new Error(`Wave API Error (${stepName}): ${json.errors[0].message}`);
      }
      return json.data;
    };

    // --- CLEAN & PREPARE CUSTOMER DATA ---
    let finalName = customerName || "";
    if (!finalName && jobTitle && jobTitle.includes(' - ')) {
      finalName = jobTitle.split(' - ')[0].trim();
    }
    if (!finalName) finalName = "New Customer";

    let cleanPhone = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) cleanPhone = cleanPhone.slice(1);

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
    if (customerEmail && customerEmail.trim()) customerInput.email = customerEmail.trim();
    if (cleanPhone) customerInput.phone = cleanPhone;
    if (addressInput) customerInput.address = addressInput;

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

    if (!createData.customerCreate.didSucceed) {
      const errs = createData.customerCreate.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Customer Create Failed: ${errs}`);
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
    if (!productId) return res.status(400).json({ success: false, error: "No Products found in Wave catalog." });

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

    if (!estimateData.estimateCreate.didSucceed) {
      const errs = estimateData.estimateCreate.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Estimate Create Failed: ${errs}`);
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    console.error("Wave Unified Sync Failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
