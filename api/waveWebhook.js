import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only accept POST requests from Wave
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const waveEvent = req.body;
    
    // 1. LOG EVERYTHING to Vercel so we can debug if needed
    console.log('🌊 WAVE WEBHOOK RECEIVED:', JSON.stringify(waveEvent, null, 2));

    const eventType = waveEvent?.event || waveEvent?.type;

    // 2. Verify this is an event we actually care about
    const validEvents = ['estimate.sent', 'estimate.accepted', 'estimate.approved', 'invoice.paid'];
    if (!validEvents.includes(eventType)) {
      console.log(`Ignoring event type: ${eventType}`);
      return res.status(200).json({ message: `Event ignored - ${eventType}` });
    }

    // 3. Extract customer email from the Wave payload
    const customerEmail = 
      waveEvent?.data?.estimate?.customer?.email || 
      waveEvent?.data?.invoice?.customer?.email;

    if (!customerEmail) {
      console.error('No customer email found in Wave payload');
      return res.status(400).json({ error: 'No customer email found in Wave payload' });
    }

    // 4. Initialize Supabase Admin Client (Bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    // 5. Look up the Customer in Argus by their email
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (custErr || !customer) {
      console.error('Customer not found in Argus:', customerEmail);
      return res.status(404).json({ error: 'Customer not found in Argus' });
    }

    // 6. Find their most recent active Job
    // We remove the strict 'Lead' requirement so it can progress through multiple stages
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, site_notes, status')
      .eq('customer_id', customer.id)
      .neq('status', 'Paid') // Ignore fully closed out jobs
      .neq('status', 'Job Complete') 
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobErr || !job) {
      console.error('No active job found to update for customer:', customer.id);
      return res.status(404).json({ error: 'No active job found to update' });
    }

    // 7. Determine the new status based on the Wave Event
    let newStatus = job.status;
    let newStage = job.job_stage;
    let noteAddition = '';

    if (eventType === 'estimate.sent') {
      newStatus = 'Estimate Sent';
      noteAddition = '\n\n📧 [Wave] Estimate sent to customer.';
    } else if (eventType === 'estimate.accepted' || eventType === 'estimate.approved') {
      newStatus = 'Scheduled'; // Ready to be assigned in Manager Hub
      newStage = 'Scheduled';
      noteAddition = '\n\n✅ [Wave] Estimate APPROVED by customer!';
    } else if (eventType === 'invoice.paid') {
      newStatus = 'Paid';
      newStage = 'Paid';
      noteAddition = '\n\n💰 [Wave] Invoice fully paid!';
    }

    // 8. Update the Job in Argus
    const newNotes = job.site_notes ? job.site_notes + noteAddition : noteAddition.trim();

    const { error: updateErr } = await supabaseAdmin
      .from('jobs')
      .update({ 
        status: newStatus,
        job_stage: newStage, 
        site_notes: newNotes
      })
      .eq('id', job.id);

    if (updateErr) throw updateErr;

    console.log(`Successfully updated Job ID: ${job.id} to ${newStatus}`);
    return res.status(200).json({ success: true, message: `Argus Job updated to ${newStatus}` });

  } catch (error) {
    console.error('Wave Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
