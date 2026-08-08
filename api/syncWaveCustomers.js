import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const token = process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!token) {
    return res.status(400).json({ success: false, error: "Wave access token missing." });
  }

  let businessId = rawBusinessId;
  if (!businessId.startsWith('Qn')) {
    businessId = btoa(`Business:${rawBusinessId}`);
  }

  const query = {
    query: `
      query($businessId: ID!) {
        business(id: $businessId) {
          customers(page: 1, pageSize: 250) {
            edges {
              node {
                id
                name
                firstName
                lastName
                email
                phone
                mobile
                address {
                  addressLine1
                  addressLine2
                  city
                  province { code name }
                  country { code name }
                  postalCode
                }
              }
            }
          }
        }
      }
    `,
    variables: { businessId }
  };

  try {
    const waveRes = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });

    const waveData = await waveRes.json();
    const rawCustomers = waveData?.data?.business?.customers?.edges?.map(e => e.node) || [];

    const formattedCustomers = rawCustomers.map(c => {
      const nameParts = (c.name || "").trim().split(" ");
      const firstName = c.firstName || nameParts[0] || "";
      const lastName = c.lastName || nameParts.slice(1).join(" ") || "";
      const stateCode = c.address?.province?.code ? c.address.province.code.replace('US-', '') : "";

      return {
        wave_id: c.id,
        first_name: firstName,
        last_name: lastName,
        email: c.email || "",
        phone: c.phone || c.mobile || "",
        address: c.address?.addressLine1 || "",
        city: c.address?.city || "",
        state: stateCode,
        zip: c.address?.postalCode || ""
      };
    });

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      for (const cust of formattedCustomers) {
        if (!cust.first_name) continue;
        
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .ilike('first_name', cust.first_name)
          .ilike('last_name', cust.last_name)
          .maybeSingle();

        if (existing) {
          await supabase.from('customers').update({
            email: cust.email || undefined,
            phone: cust.phone || undefined,
            address: cust.address || undefined,
            city: cust.city || undefined,
            state: cust.state || undefined,
            zip: cust.zip || undefined
          }).eq('id', existing.id);
        } else {
          await supabase.from('customers').insert([cust]);
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: formattedCustomers.length,
      customers: formattedCustomers
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
