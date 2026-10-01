import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.WAVE_FULL_ACCESS_TOKEN || process.env.WAVE_ACCESS_TOKEN;
  const rawBusinessId = process.env.WAVE_BUSINESS_ID || "QnVzaW5lc3M6ZjY0NTE4OGQtNGEzNi00OTY0LTlhZDItODNhYWUxZWNjNzBk";

  if (!token) return res.status(400).json({ error: 'Wave access token missing.' });
  const businessId = rawBusinessId.startsWith('Qn') ? rawBusinessId : btoa(`Business:${rawBusinessId}`);

  // Initialize Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query GetEstimates($biz: ID!) {
            business(id: $biz) {
              estimates(page: 1, pageSize: 50) {
                edges {
                  node {
                    id
                    estimateNumber
                    status
                    createdAt
                    title
                    memo
                    customer {
                      id
                      name
                      firstName
                      lastName
                      email
                      phone
                      address {
                        addressLine1
                        addressLine2
                        city
                        province { code }
                        postalCode
                      }
                    }
                    total {
                      raw
                      value
                    }
                    items {
                      description
                      product {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { biz: businessId }
      })
    });

    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0].message);

    const edges = json?.data?.business?.estimates?.edges || [];
    const rawEstimates = edges.map(e => e.node);

    // Strictly keep only active/accepted estimates (Exclude CONVERTED and EXPIRED)
    const activeEstimates = rawEstimates.filter(est => {
      const status = String(est.status || '').toUpperCase();
      return status !== 'CONVERTED' && status !== 'EXPIRED';
    });

    // Perform Supabase Sync & Attach Pending Photos
    let syncedCount = 0;
    if (supabase) {
      const { data: dbCustomers } = await supabase.from('customers').select('*');
      const { data: dbJobs } = await supabase.from('jobs').select('id, title, customer_id');

      for (const est of activeEstimates) {
        const waveCust = est.customer || {};
        const custEmail = (waveCust.email || '').trim().toLowerCase();
        
        let wavePhoneDigits = (waveCust.phone || '').replace(/\D/g, '');
        if (wavePhoneDigits.length === 11 && wavePhoneDigits.startsWith('1')) {
          wavePhoneDigits = wavePhoneDigits.slice(1);
        }

        const fullName = (waveCust.name || `${waveCust.firstName || ''} ${waveCust.lastName || ''}`).trim().toLowerCase();

        // Match customer in Argus database
        const matchedCust = (dbCustomers || []).find(c => {
          const cEmail = (c.email || '').trim().toLowerCase();
          let cPhoneDigits = (c.phone || '').replace(/\D/g, '');
          if (cPhoneDigits.length === 11 && cPhoneDigits.startsWith('1')) cPhoneDigits = cPhoneDigits.slice(1);
          const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();

          return (custEmail && cEmail && cEmail === custEmail) ||
                 (wavePhoneDigits && cPhoneDigits && wavePhoneDigits === cPhoneDigits) ||
                 (fullName && cName && fullName === cName);
        });

        if (matchedCust) {
          const itemDesc = est.items?.[0]?.description || 'Handyman Services';
          const jobTitle = est.title || `${matchedCust.first_name || 'Client'} ${matchedCust.last_name || ''} - ${itemDesc}`.trim();
          
          // Check if this job already exists in Supabase
          const jobExists = (dbJobs || []).some(j => j.customer_id === matchedCust.id && j.title?.toLowerCase() === jobTitle.toLowerCase());

          if (!jobExists) {
            const pendingPhotos = matchedCust.pending_photos || [];
            const price = parseFloat(est.total?.value || est.total?.raw || 0);

            // Create new job in Argus with pending photos attached
            const { error: insertErr } = await supabase.from('jobs').insert([{
              customer_id: matchedCust.id,
              title: jobTitle,
              status: 'Lead',
              job_stage: 'Lead',
              quoted_price: price,
              site_notes: est.memo || '',
              photo_urls: pendingPhotos
            }]);

            if (!insertErr) {
              syncedCount++;
              // Clear pending_photos from customer record after attaching
              if (pendingPhotos.length > 0) {
                await supabase
                  .from('customers')
                  .update({ pending_photos: [] })
                  .eq('id', matchedCust.id);
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      count: activeEstimates.length, 
      syncedCount,
      estimates: activeEstimates 
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
