import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("📥 WEBSITE LEAD RECEIVED:", req.body);

  const {
    firstName = '',
    lastName = '',
    phone = '',
    email = '',
    streetAddress = '',
    unit = '',
    city = '',
    state = 'MA',
    zip = '',
    description = '',
    smsConsent = false
  } = req.body;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const fullAddress = [streetAddress, unit, city, state, zip].filter(Boolean).join(', ');
    const fullName = `${firstName} ${lastName}`.trim() || 'Website Customer';
    let customerId;

    // 1. SUPABASE: CUSTOMER INSERT OR UPDATE
    if (email) {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
        await supabase
          .from('customers')
          .update({ sms_opt_in: !!smsConsent })
          .eq('id', customerId);
      }
    }

    if (!customerId) {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          address: fullAddress,
          sms_opt_in: !!smsConsent
        }])
        .select()
        .single();

      if (custErr) throw custErr;
      customerId = newCust.id;
    }

    // 2. SUPABASE: CREATE JOB LEAD
    const autoTitle = `${fullName} - Website Lead`;
    const { error: jobErr } = await supabase
      .from('jobs')
      .insert([{
        customer_id: customerId,
        title: autoTitle,
        service_type: 'General Handyman Work',
        status: 'Lead',
        job_stage: 'Lead',
        assigned_to: 'Unassigned',
        site_notes: `Project Details: ${description}`
      }]);

    if (jobErr) throw jobErr;

    // 3. WAVE API DRAFT ESTIMATE SYNC
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      await fetch(`${protocol}://${host}/api/waveTest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: autoTitle,
          quotedPrice: 0,
          notes: `Project Details: ${description}`,
          customerName: fullName,
          customerEmail: email,
          customerPhone: phone,
          customerAddress: fullAddress
        })
      });
    } catch (waveErr) {
      console.warn('Wave Sync Issue:', waveErr.message);
    }

    // 4. ONESIGNAL PUSH NOTIFICATION
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      await fetch(`${protocol}://${host}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🚨 New Website Lead!',
          message: `${fullName} just requested a quote in ${city || 'your area'}.`
        })
      });
    } catch (pushErr) {
      console.warn('Push Notification Issue:', pushErr.message);
    }

    return res.status(200).json({ success: true, customerId });
  } catch (error) {
    console.error('Lead Processing Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
