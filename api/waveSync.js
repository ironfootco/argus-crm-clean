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
    return res.status(400).json({ success: false, error: 'Wave access token missing.' });
  }

  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // 1. Clean Inputs - Ensure they are explicitly strings or completely undefined
  const cleanEmail = customerEmail ? String(customerEmail).trim() : undefined;
  const cleanPhone = customerPhone ? String(customerPhone).trim() : undefined;

  // 2. Strict Address Builder - Maps exactly to Wave's Billing UI
  let addressObj = undefined;
  if (customerAddress && typeof customerAddress === 'string' && customerAddress.trim().length > 0) {
    const cleanStr = customerAddress.trim();
    const parts = cleanStr.split(',').map(s => s.trim()).filter(Boolean);
    const zipMatch = cleanStr.match(/\b\d{5}\b/);
    
    addressObj = {
      provinceCode: "US-MA",
      countryCode: "US"
    };
    
    // Only inject keys if they exist so JSON.stringify doesn't corrupt the payload
    if (parts.length > 0) addressObj.addressLine1 = parts[0];
    if (parts.length > 1) addressObj.city = parts[1];
    if (zipMatch) addressObj.postalCode = zipMatch[0];
  }

  // Helper Wrapper for cleaner, sequential API calls
  const waveQuery = async (query, variables) => {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
    
    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  try {
    // --- CALL 1: SEARCH CUSTOMER CATALOG ---
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
    `, { businessId });

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

    // --- CALL 2: CREATE OR PATCH CUSTOMER ---
    if (customerId) {
      // Build patch object strictly
      const patchInput = { id: customerId };
      if (cleanEmail) patchInput.email = cleanEmail;
      if (cleanPhone) patchInput.phone = cleanPhone;
      if (addressObj) patchInput.address = addressObj;

      const patchData = await waveQuery(`
        mutation ($input: CustomerPatchInput!) {
          customerPatch(input: $input) {
            didSucceed
            inputErrors { message path }
          }
        }
      `, { input: patchInput });

      if (patchData.customerPatch.didSucceed === false) {
        const errs = patchData.customerPatch.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Patch Rejected: ${errs}` });
      }
    } else {
      // Build create object strictly
      const createInput = {
        businessId: businessId,
        name: customerName || "Iron Foot Client",
        currency: "USD"
      };
      if (cleanEmail) createInput.email = cleanEmail;
      if (cleanPhone) createInput.phone = cleanPhone;
      if (addressObj) createInput.address = addressObj;

      const createData = await waveQuery(`
        mutation ($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            didSucceed
            customer { id }
            inputErrors { message path }
          }
        }
      `, { input: createInput });

      if (createData.customerCreate.didSucceed === false) {
        const errs = createData.customerCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ success: false, error: `Customer Create Rejected: ${errs}` });
      }
      customerId = createData.customerCreate.customer.id;
    }

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: "Could not resolve Customer ID or Product ID." });
    }

    // --- CALL 3: DRAFT ESTIMATE CREATION ---
    // Inject contact info into the memo so it actively prints on the PDF
    const contactLines = [];
    if (cleanPhone) contactLines.push(`Phone: ${cleanPhone}`);
    if (cleanEmail) contactLines.push(`Email: ${cleanEmail}`);
    const contactStr = contactLines.length ? `\n\nClient Contact:\n${contactLines.join('\n')}` : '';

    const finalMemo = `Job: ${jobTitle || 'General Handyman'}\n\nSite / Estimating Notes:\n${notes || 'No site notes logged.'}${contactStr}`;

    const estimateData = await waveQuery(`
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
        memo: finalMemo,
        items: [
          {
            productId,
            description: jobTitle || 'Handyman Services',
            unitPrice: String(quotedPrice || 0),
            quantity: "1"
          }
        ]
      }
    });

    if (estimateData.estimateCreate.didSucceed === false) {
      const errs = estimateData.estimateCreate.inputErrors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ success: false, error: `Estimate Creation Rejected: ${errs}` });
    }

    return res.status(200).json({ success: true, data: estimateData });

  } catch (err) {
    return res.status(500).json({ success: false, error: `Wave API Exception: ${err.message}` });
  }
}
