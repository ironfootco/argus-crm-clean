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

    const activeEstimates = rawEstimates.filter(est => {
      const status = String(est.status || '').toUpperCase();
      return status !== 'CONVERTED' && status !== 'EXPIRED';
    });

    let syncedCount = 0;
    if (supabase) {
      const { data: dbCustomers } = await supabase.from('customers').select('*');
      const { data: dbJobs } = await supabase.from('jobs').select('*');

      for (const est of activeEstimates) {
        const waveCust = est.customer || {};
        const custEmail = (waveCust.email || '').trim().toLowerCase();
        
        let wavePhoneDigits = (waveCust.phone || '').replace(/\D/g, '');
        if (wavePhoneDigits.length === 11 && wavePhoneDigits.startsWith('1')) {
          wavePhoneDigits = wavePhoneDigits.slice(1);
        }

        const fullName = (waveCust.name || `${waveCust.firstName || ''} ${waveCust.lastName || ''}`).trim().toLowerCase();

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
          const itemDesc = est.items?.[0]?.description || est.items?.[0]?.product?.name || 'General Work';
          const custDisplayName = `${matchedCust.first_name || ''} ${matchedCust.last_name || ''}`.trim() || 'Client';
          
          let jobTitle = `${custDisplayName} - ${itemDesc}`;
          if (est.title && est.title !== 'Estimate') jobTitle = est.title;

          const price = parseFloat(est.total?.value || est.total?.raw || 0);
          const estTag = `Imported from Wave Estimate #${est.estimateNumber}`;
          const combinedNotes = est.memo ? `${est.memo}\n\n${estTag}` : estTag;

          const existingJob = (dbJobs || []).find(j => {
            if (j.customer_id !== matchedCust.id) return false;
            const hasEstimateTag = j.site_notes && j.site_notes.includes(estTag);
            const isUnlinkedLead = j.status === 'Lead' || j.job_stage === 'Lead';
            const sameTitle = j.title?.toLowerCase() === jobTitle.toLowerCase() || j.title?.toLowerCase() === `${custDisplayName.toLowerCase()} - estimate`;
            return hasEstimateTag || isUnlinkedLead || sameTitle;
          });

          const pendingPhotos = matchedCust.pending_photos || [];
          let targetJobId = null;

          if (existingJob) {
            targetJobId = existingJob.id;
            await supabase.from('jobs').update({
              title: jobTitle,
              quoted_price: price,
              site_notes: combinedNotes
            }).eq('id', existingJob.id);
            syncedCount++;
          } else {
            const { data: insertedJob, error: insertErr } = await supabase.from('jobs').insert([{
              customer_id: matchedCust.id,
              title: jobTitle,
              status: 'Lead',
              job_stage: 'Lead',
              quoted_price: price,
              site_notes: combinedNotes
            }]).select().single();

            if (!insertErr && insertedJob) {
              targetJobId = insertedJob.id;
              syncedCount++;
            }
          }

          // Move pending photos into the job_photos gallery table!
          if (targetJobId && pendingPhotos.length > 0) {
            const photoInserts = pendingPhotos.map(url => ({
              job_id: targetJobId,
              photo_url: url,
              tag: 'Before'
            }));
            
            await supabase.from('job_photos').insert(photoInserts);
            await supabase.from('customers').update({ pending_photos: [] }).eq('id', matchedCust.id);
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
