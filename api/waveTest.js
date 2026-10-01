export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobTitle, notes, customerEmail, customerPhone, customerAddress, quotedPrice, customerName: rawCustomerName } = req.body || {};

  let customerName = rawCustomerName || "";
  if (!customerName && jobTitle && jobTitle.includes(' - ')) {
    customerName = jobTitle.split(' - ')[0].trim();
  }
  if (!customerName) customerName = "New Customer";

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";
  
  if (!token) return res.status(400).json({ error: 'Wave token missing.' });
  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // Format Phone for Wave as XXX-XXX-XXXX
  let cleanDigits = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';
  if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) cleanDigits = cleanDigits.slice(1);
  let formattedWavePhone = cleanDigits.length === 10 ? `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}` : cleanDigits;

  // Strict Address Parsing
  let addressInput = null;
  if (customerAddress && typeof customerAddress === 'string' && customerAddress.trim()) {
    const cleanAddr = customerAddress.trim();
    const parts = cleanAddr.split(',').map(s => s.trim()).filter(Boolean);
    const zipMatch = cleanAddr.match(/\b\d{5}\b/);
    
    addressInput = { countryCode: "US", provinceCode: "US-MA" };
    if (parts.length > 0) addressInput.addressLine1 = parts[0];
    if (parts.length > 1) addressInput.city = parts[1].replace(/\b\d{5}\b/g, '').trim(); 
    if (zipMatch) addressInput.postalCode = zipMatch[0];
  }

  const waveApi = async (query, variables) => {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  };

  try {
    // 1. Get Product ID
    const catalog = await waveApi(`
      query($biz: ID!) { 
        business(id: $biz) { 
          products(page: 1, pageSize: 1) { edges { node { id } } } 
        } 
      }
    `, { biz: businessId });
    
    const productId = catalog?.business?.products?.edges?.[0]?.node?.id;
    if (!productId) throw new Error("No product found in Wave.");

    // 2. SMART CUSTOMER LOOKUP (Prevent Duplicates)
    let customerId = null;

    try {
      const existingCustData = await waveApi(`
        query ($biz: ID!) {
          business(id: $biz) {
            customers(page: 1, pageSize: 100) {
              edges {
                node {
                  id
                  name
                  email
                  phone
                }
              }
            }
          }
        }
      `, { biz: businessId });

      const custList = existingCustData?.business?.customers?.edges?.map(e => e.node) || [];

      // Match by Email, Phone, or Name
      const match = custList.find(c => {
        const emailMatch = customerEmail && c.email && c.email.trim().toLowerCase() === customerEmail.trim().toLowerCase();
        
        const cPhoneDigits = c.phone ? String(c.phone).replace(/\D/g, '') : '';
        const phoneMatch = cleanDigits && cPhoneDigits && (cPhoneDigits.endsWith(cleanDigits) || cleanDigits.endsWith(cPhoneDigits));
        
        const nameMatch = customerName && c.name && c.name.trim().toLowerCase() === customerName.trim().toLowerCase();

        return emailMatch || phoneMatch || nameMatch;
      });

      if (match) {
        customerId = match.id;
      }
    } catch (searchErr) {
      console.warn("Wave customer search warning:", searchErr.message);
    }

    // 3. Create Customer ONLY if no match found
    if (!customerId) {
      const customerInput = {
        businessId,
        name: customerName,
        currency: "USD"
      };
      
      if (customerEmail && customerEmail.trim()) customerInput.email = customerEmail.trim();
      if (formattedWavePhone) customerInput.phone = formattedWavePhone;
      if (addressInput) customerInput.address = addressInput;

      const createRes = await waveApi(`
        mutation CreateCustomer($input: CustomerCreateInput!) {
          customerCreate(input: $input) {
            didSucceed
            customer { id }
            inputErrors { message path }
          }
        }
      `, { input: customerInput });

      if (!createRes.customerCreate.didSucceed) {
        throw new Error("Wave rejected Customer: " + JSON.stringify(createRes.customerCreate.inputErrors));
      }
      customerId = createRes.customerCreate.customer.id;
    }

    // 4. Create Estimate
    const estRes = await waveApi(`
      mutation CreateEstimate($input: EstimateCreateInput!) {
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
        memo: `Job: ${jobTitle}\n\nInternal Notes:\n${notes || ''}`,
        items: [{ 
          productId, 
          description: jobTitle, 
          unitPrice: String(quotedPrice || 0), 
          quantity: "1" 
        }]
      }
    });

    if (!estRes.estimateCreate.didSucceed) {
      throw new Error("Wave rejected Estimate: " + JSON.stringify(estRes.estimateCreate.inputErrors));
    }

    return res.status(200).json({ success: true, data: estRes });

  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
