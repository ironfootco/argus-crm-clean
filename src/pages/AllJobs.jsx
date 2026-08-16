import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AllJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'

  useEffect(() => {
    fetchJobsAndCustomers();
  }, []);

  const fetchJobsAndCustomers = async () => {
    setLoading(true);

    // 1. Fetch Customers for name/phone mapping
    const { data: custData } = await supabase.from('customers').select('*');
    if (custData) {
      const custMap = Object.fromEntries(custData.map(c => [c.id, c]));
      setCustomers(custMap);
    }

    // 2. Fetch Jobs
    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      alert("Error fetching jobs: " + error.message);
    } else {
      setJobs(jobData || []);
    }
    
    setLoading(false);
  };

  const handlePurgeInactiveImports = async () => {
    if (!window.confirm("Delete all unassigned/inactive test imported jobs from Argus?")) return;

    const { error } = await supabase
      .from('jobs')
      .delete()
      .ilike('site_notes', '%Imported from Wave Estimate%')
      .neq('title', 'Maura Woodard - Estimate');

    if (error) {
      alert("Purge error: " + error.message);
    } else {
      setSyncStatus("🧹 Cleared inactive test estimates.");
      await fetchJobsAndCustomers();
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
          fullScopeText ? `Scope of Work: ${fullScopeText}` : '',
          est.memo ? `Memo: ${est.memo}` : '',
          `Imported from Wave Estimate #${est.estimateNumber}`
        ].filter(Boolean).join('\n\n');

        // Extract materials ONLY if specific keywords match (otherwise keep empty)
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
          status: 'Lead',
          job_stage: 'Lead',
          assigned_to: 'Unassigned',
          scheduled_date: new Date().toISOString().split('T')[0],
          site_notes: combinedNotes,
          materials_needed: materialsText || '' // 🎯 FIX: Only fills materials if keywords matched!
        };

        if (existingJob) {
          await supabase.from('jobs').update(payload).eq('id', existingJob.id);
        } else {
          await supabase.from('jobs').insert([payload]);
        }
      }

      setSyncStatus(`✅ Synced active Wave estimates!`);
      await fetchJobsAndCustomers();
      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      alert("Error pulling estimates: " + err.message);
    }

    setImporting(false);
  };

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Jobs...</div>;
  }

  // Filter Jobs by Active vs Archive
  const activeJobs = jobs.filter(j => j.status !== 'Paid');
  const archivedJobs = jobs.filter(j => j.status === 'Paid');
  const displayedJobs = activeTab === 'active' ? activeJobs : archivedJobs;

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      
      {/* HEADER & TOP ACTION BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        <div>
          <h2 style={{ color: 'var(--text-accent)', margin: '0 0 4px 0', fontSize: 22 }}>📋 All Jobs</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Track and manage your entire project pipeline.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={handlePurgeInactiveImports}
            style={{ background: 'var(--bg-card)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}
          >
            🧹 Clean Old Imports
          </button>

          <button 
            onClick={handlePullWaveEstimates}
            disabled={importing}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {importing ? '⏳ Syncing...' : '🌊 Pull Wave Estimates'}
          </button>

          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('active')}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none',
                background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'active' ? 'var(--primary-text)' : 'var(--text-muted)',
                fontWeight: 'bold', cursor: 'pointer', fontSize: 13
              }}
            >
              🔥 Active Jobs ({activeJobs.length})
            </button>
            <button 
              onClick={() => setActiveTab('archive')}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none',
                background: activeTab === 'archive' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'archive' ? 'var(--primary-text)' : 'var(--text-muted)',
                fontWeight: 'bold', cursor: 'pointer', fontSize: 13
              }}
            >
              🗄️ Archive ({archivedJobs.length})
            </button>
          </div>
        </div>
      </div>

      {syncStatus && (
        <div style={{ padding: '12px 16px', marginBottom: 15, background: 'var(--bg-card)', color: 'var(--text-accent)', borderRadius: 8, border: '1.5px solid var(--border-color)', fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>
          {syncStatus}
        </div>
      )}

      {/* JOB LISTING */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayedJobs.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', padding: 30, borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
            {activeTab === 'active' ? 'No active jobs right now.' : 'No paid jobs in the archive yet.'}
          </div>
        ) : (
          displayedJobs.map(job => {
            const cust = customers[job.customer_id];
            
            return (
              <Link 
                to={`/jobs/${job.id}`} 
                key={job.id} 
                style={{ 
                  display: 'block', textDecoration: 'none', background: 'var(--bg-card)', 
                  border: '2px solid var(--border-color)', borderRadius: 8, padding: 16,
                  opacity: activeTab === 'archive' ? 0.75 : 1, transition: '0.2s ease-in-out'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</h3>
                    {cust && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        👤 {cust.first_name} {cust.last_name} {cust.phone ? `• 📞 ${cust.phone}` : ''}
                      </div>
                    )}
                    {job.scheduled_date && (
                      <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 6, fontWeight: 'bold' }}>
                        📅 Scheduled: {new Date(job.scheduled_date).toLocaleDateString()} {job.scheduled_time ? `at ${job.scheduled_time}` : ''}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--success)', marginBottom: 6 }}>
                      ${job.quoted_price?.toLocaleString() || '0'}
                    </div>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                      {job.status || 'Lead'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

    </div>
  );
}
