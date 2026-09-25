export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, address } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";
  
  if (!token) return res.status(400).json({ error: 'Wave token missing' });

  let businessId = rawBusinessId;
  if (!rawBusinessId.startsWith('Qn')) {
    businessId = Buffer.from(`Business:${rawBusinessId}`).toString('base64');
  }

  let cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
  if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) cleanPhone = cleanPhone.slice(1);

  const customerInput = {
    businessId,
    name: name,
    currency: "USD"
  };
  
  if (email && typeof email === 'string' && email.trim()) customerInput.email = email.trim();
  if (cleanPhone) customerInput.phone = cleanPhone;

  if (address && typeof address === 'string' && address.trim()) {
    const parts = address.split(',').map(s => s.trim()).filter(Boolean);
    const zipMatch = address.match(/\b\d{5}\b/);
    customerInput.address = { countryCode: "US", provinceCode: "US-MA" };
    if (parts.length > 0) customerInput.address.addressLine1 = parts[0];
    if (parts.length > 1) customerInput.address.city = parts[1].replace(/\b\d{5}\b/g, '').trim();
    if (zipMatch) customerInput.address.postalCode = zipMatch[0];
  }

  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `mutation ($input: CustomerCreateInput!) { customerCreate(input: $input) { didSucceed customer { id } inputErrors { message path } } }`,
        variables: { input: customerInput }
      })
    });
    
    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0].message);
    if (!json.data?.customerCreate?.didSucceed) {
      const errs = json.data?.customerCreate?.inputErrors?.map(e => `${e.path?.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Wave Customer Create Failed: ${errs}`);
    }
    
    return res.status(200).json({ success: true, waveId: json.data.customerCreate.customer.id });
  } catch (err) {
    console.error("Wave Customer Create API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
