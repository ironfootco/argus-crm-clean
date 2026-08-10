import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AllJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [filterStage, setFilterStage] = useState('ALL');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .order('scheduled_date', { ascending: false, nullsFirst: false });

    if (!error && jobData) {
      const merged = jobData.map(j => ({ ...j, customer: custMap[j.customer_id] }));
      setJobs(merged);
    }
    setLoading(false);
  };

  const handlePurgeInactiveImports = async () => {
    if (!window.confirm("Delete all unassigned/inactive test imported jobs from Argus?")) return;

    // Remove old imported jobs that aren't for active current jobs
    const { error } = await supabase
      .from('jobs')
      .delete()
      .ilike('site_notes', '%Imported from Wave Estimate%')
      .neq('title', 'Maura Woodard - Estimate');

    if (error) {
      alert("Purge error: " + error.message);
    } else {
      setSyncStatus("🧹 Cleared inactive test estimates.");
      await fetchJobs();
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handlePullWaveEstimates = async () => {
    setImporting(true);
    setSyncStatus('Fetching active estimates from Wave...');

    try {
      const res = await fetch('/api/syncWaveEstimates');
      const result = await res.json();

      if (!result.success) {
        alert("Wave Estimate Pull Error: " + result.error);
        setImporting(false);
        setSyncStatus('');
        return;
      }

      const waveEstimates = result.estimates || [];
      setSyncStatus(`Processing ${waveEstimates.length} active Wave estimates...`);

      let newJobsCount = 0;

      for (const est of waveEstimates) {
        const custNode = est.customer;
        let customerId = null;

        if (custNode) {
          let fn = custNode.firstName || '';
          let ln = custNode.lastName || '';
          if (!fn && !ln && custNode.name) {
            const parts = custNode.name.trim().split(' ');
            fn = parts[0] || '';
            ln = parts.slice(1).join(' ') || '';
          }

          if (custNode.email) {
            const { data } = await supabase.from('customers').select('id').eq('email', custNode.email).maybeSingle();
            if (data) customerId = data.id;
          }

          if (!customerId && fn) {
            const { data } = await supabase.from('customers').select('id').eq('first_name', fn).maybeSingle();
            if (data) customerId = data.id;
          }

          if (!customerId) {
            const addr = custNode.address || {};
            const fullAddr = [addr.addressLine1, addr.addressLine2, addr.city, addr.province?.code?.replace('US-', ''), addr.postalCode].filter(Boolean).join(', ');
            
            const { data: newCust } = await supabase.from('customers').insert([{
              first_name: fn || 'Client',
              last_name: ln || '',
              email: custNode.email || '',
              phone: custNode.phone || '',
              address: fullAddr || ''
            }]).select().single();

            if (newCust) customerId = newCust.id;
          }
        }

        const clientName = custNode ? `${custNode.firstName || ''} ${custNode.lastName || ''}`.trim() || custNode.name : 'Client';
        const jobTitle = est.title ? `${clientName} - ${est.title}` : `${clientName} - Estimate`;
        
        const rawTotalStr = String(est.total?.value || est.total?.raw || '0').replace(/,/g, '');
        const price = parseFloat(rawTotalStr) || 0;

        const items = est.items || [];
        const scopeLines = items.map(i => `${i.product?.name ? `[${i.product.name}] ` : ''}${i.description || ''}`.trim()).filter(Boolean);
        const fullScopeText = scopeLines.join('\n');
        
        const combinedNotes = [
          fullScopeText ? `Scope of Work:\n${fullScopeText}` : '',
          est.memo ? `Memo: ${est.memo}` : '',
          `Imported from Wave Estimate #${est.estimateNumber}`
        ].filter(Boolean).join('\n\n');

        const materialsLines = scopeLines.filter(line => /paint|primer|bm|ben moor|supplies|material|green/i.test(line));
        const materialsText = materialsLines.join(' • ');

        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id')
          .ilike('site_notes', `%Estimate #${est.estimateNumber}%`)
          .maybeSingle();

        const payload = {
          title: jobTitle,
          customer_id: customerId,
          quoted_price: price,
          service_type: items[0]?.product?.name || est.title || 'Handyman Service',
          status: 'Scheduled',
          job_stage: 'Scheduled',
          assigned_to: 'Unassigned',
          scheduled_date: new Date().toISOString().split('T')[0],
          site_notes: combinedNotes,
          materials_needed: materialsText || fullScopeText
        };

        if (existingJob) {
          await supabase.from('jobs').update(payload).eq('id', existingJob.id);
        } else {
          await supabase.from('jobs').insert([payload]);
          newJobsCount++;
        }
      }

      setSyncStatus(`✅ Synced active Wave estimates!`);
      await fetchJobs();
      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      alert("Error pulling estimates: " + err.message);
    }

    setImporting(false);
  };

  const filteredJobs = jobs.filter(j => {
    if (filterStage === 'ALL') return true;
    return (j.job_stage || j.status) === filterStage;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-main)' }}>📋 All Jobs Master Registry</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{jobs.length} total active & completed jobs</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handlePurgeInactiveImports}
            style={{
              background: 'var(--bg-card)',
              color: '#ef4444',
              border: '1px solid #ef4444',
              padding: '10px 14px',
              borderRadius: 6,
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            🧹 Clean Old Imports
          </button>

          <button
            onClick={handlePullWaveEstimates}
            disabled={importing}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-text)',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 6,
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            {importing ? "🔄 Pulling from Wave..." : "📥 Pull Wave Estimates"}
          </button>
        </div>
      </div>

      {syncStatus && (
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', color: 'var(--text-accent)', borderRadius: 8, border: '1.5px solid var(--border-color)', fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>
          {syncStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['ALL', 'Scheduled', 'En Route', 'On Site / In Progress', 'Job Complete'].map(stage => (
          <button
            key={stage}
            onClick={() => setFilterStage(stage)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: filterStage === stage ? 'var(--primary)' : 'var(--bg-card)',
              color: filterStage === stage ? 'var(--primary-text)' : 'var(--text-main)',
              fontWeight: 'bold',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {stage}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-main)', padding: 10 }}>Loading job database...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map(j => (
            <div
              key={j.id}
              onClick={() => navigate(`/jobs/${j.id}`)}
              style={{
                background: 'var(--bg-card)',
                padding: 16,
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-main)' }}>
                  🛠️ {j.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Assigned: <strong style={{ color: 'var(--text-accent)' }}>{j.assigned_to || 'Unassigned'}</strong> • Date: <strong>{j.scheduled_date || 'Unscheduled'}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--success)' }}>
                  ${j.quoted_price?.toLocaleString() || 0}
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block' }}>
                  {j.job_stage || j.status || 'Scheduled'}
                </span>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div style={{ color: 'var(--text-muted)', padding: 10 }}>No jobs found for this stage.</div>
          )}
        </div>
      )}
    </div>
  );
}
