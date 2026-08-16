import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only accept POST requests from Wave
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const waveEvent = req.body;
    
    // 1. Verify this is an estimate approval event. 
    // Wave's webhook payloads usually trigger multiple events. We only care about approvals.
    // (Adjust the exact event string based on Wave's active webhook documentation)
    if (waveEvent?.event !== 'estimate.approved') {
      return res.status(200).json({ message: 'Event ignored - Not an estimate approval' });
    }

    // 2. Extract customer email from the Wave payload
    const customerEmail = waveEvent?.data?.estimate?.customer?.email; 

    if (!customerEmail) {
       return res.status(400).json({ error: 'No customer email found in Wave payload' });
    }

    // 3. Initialize Supabase Admin Client (Bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    // 4. Look up the Customer in Argus by their email
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (custErr || !customer) {
      console.error('Customer not found in Argus:', customerEmail);
      return res.status(404).json({ error: 'Customer not found in Argus' });
    }

    // 5. Find their most recent active "Lead" Job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, site_notes')
      .eq('customer_id', customer.id)
      .eq('job_stage', 'Lead') // Or 'Scheduled' depending on your exact pipeline
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobErr || !job) {
      console.error('No active lead found for customer:', customer.id);
      return res.status(404).json({ error: 'No active lead found to approve' });
    }

    // 6. Update the Job in Argus to "Approved / Scheduled"
    const newNotes = job.site_notes 
      ? job.site_notes + '\n\n✅ [Wave] Estimate Approved by Customer!' 
      : '✅ [Wave] Estimate Approved by Customer!';

    const { error: updateErr } = await supabaseAdmin
      .from('jobs')
      .update({ 
        status: 'Scheduled',
        job_stage: 'Scheduled', 
        site_notes: newNotes
      })
      .eq('id', job.id);

    if (updateErr) throw updateErr;

    console.log(`Successfully approved Job ID: ${job.id} for ${customerEmail}`);
    return res.status(200).json({ success: true, message: 'Argus Job updated successfully' });

  } catch (error) {
    console.error('Wave Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
