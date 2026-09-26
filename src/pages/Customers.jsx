import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [workerPhone, setWorkerPhone] = useState(null);
  
  // Add Job Modal State
  const [jobModalCustomer, setJobModalCustomer] = useState(null);
  const [jobForm, setJobForm] = useState({ title: '', description: '', price: '' });
  const [savingJob, setSavingJob] = useState(false);
  
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('argus_user') || 'Jason';

  useEffect(() => {
    fetchCustomers();
    fetchWorkerPhone();
  }, []);

  const fetchWorkerPhone = async () => {
    try {
      const { data } = await supabase
        .from('team_members')
        .select('phone')
        .eq('name', currentUser)
        .single();
      if (data?.phone) setWorkerPhone(String(data.phone));
    } catch (e) {
      console.error("Worker phone fetch error:", e);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('first_name', { ascending: true });
      if (!error && data) setCustomers(data);
    } catch (e) {
      console.error("Customers fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = String(phoneStr).replace(/\D/g, '');
    const core = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
    if (core.length === 10) {
      return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6, 10)}`;
    }
    return String(phoneStr);
  };

  const handleCallCustomer = async (phone) => {
    if (!phone) return alert("No phone number saved for this contact.");
    if (!workerPhone) return alert(`We could not find a phone number for ${currentUser}.`);

    const cCore = String(phone).replace(/\D/g, '').slice(-10);
    const wCore = String(workerPhone).replace(/\D/g, '').slice(-10);

    if (cCore.length !== 10) return alert("Invalid customer phone number.");

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: `+1${cCore}`,
          workerNumber: `+1${wCore}`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initiate call");
      }

      alert(`📞 Calling ${currentUser}'s cell now! Answer to connect.`);
    } catch (err) {
      alert("Call Error: " + err.message);
    }
  };

  const handleSaveJob = async () => {
    if (!jobForm.title) return alert("Please enter a job title.");
    setSavingJob(true);

    try {
      // 1. Save Job to Supabase
      const { data: newJob, error: dbError } = await supabase.from('jobs').insert([{
        customer_id: jobModalCustomer.id,
        title: jobForm.title,
        description: jobForm.description,
        price: jobForm.price ? parseFloat(jobForm.price) : null,
        status: 'Lead'
      }]).select().single();
      
      if (dbError) throw dbError;

      // 2. Sync to Wave API to generate an Estimate
      const fullName = `${jobModalCustomer.first_name || ''} ${jobModalCustomer.last_name || ''}`.trim();
      const waveRes = await fetch('/api/wavesync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_estimate',
          jobTitle: jobForm.title,
          notes: jobForm.description,
          quotedPrice: jobForm.price,
          customerName: fullName,
          customerPhone: jobModalCustomer.phone,
          customerEmail: jobModalCustomer.email,
          customerAddress: jobModalCustomer.address
        })
      });

      const waveData = await waveRes.json().catch(() => ({}));
      if (!waveRes.ok || !waveData.success) {
        console.warn("Wave sync issue:", waveData.error);
        alert(`Saved locally, but Wave Estimate sync failed: ${waveData.error || 'Unknown error'}`);
      } else {
        alert("✅ Job created and Wave Estimate generated successfully!");
      }

      // Reset and close
      setJobModalCustomer(null);
      setJobForm({ title: '', description: '', price: '' });
      
    } catch (err) {
      alert("Error saving job: " + err.message);
    } finally {
      setSavingJob(false);
    }
  };

  const filtered = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const q = search.toLowerCase();
    return fullName.includes(q) || phone.includes(q) || email.includes(q);
  });

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 12,
    borderRadius: 8,
    border: '1px solid var(--border-color, #444)',
    background: 'var(--bg-input, #2a2a2a)',
    color: '#fff',
    fontSize: 15,
    boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', color: 'var(--text-main, #fff)', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Contacts ({customers.length})</h2>
        <input
          type="text"
          placeholder="🔍 Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a2a)', color: '#fff', fontSize: 14, width: 240 }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 20, color: 'var(--text-muted, #aaa)' }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--text-muted, #aaa)', textAlign: 'center' }}>No contacts found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => {
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed Contact';
            const displayPhone = formatPhone(c.phone);

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 16,
                  background: 'var(--bg-card, #1e1e1e)',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: 12
                }}
              >
                {/* Top Section: Contact Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>{fullName}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted, #aaa)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {displayPhone && <span>📱 {displayPhone}</span>}
                      {c.email && <span>✉️ {c.email}</span>}
                    </div>
                    {c.address && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginTop: 4 }}>📍 {c.address}</div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-color, #333)', paddingTop: 12 }}>
                  {c.phone && (
                    <button
                      onClick={() => handleCallCustomer(c.phone)}
                      style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📞 Call
                    </button>
                  )}
                  {c.phone && (
                    <button
                      onClick={() => navigate(`/inbox`, { state: { phone: c.phone } })}
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      💬 Text
                    </button>
                  )}
                  {c.email && (
                    <button
                      onClick={() => window.location.href = `mailto:${c.email}`}
                      style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      ✉️ Email
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/customers/${c.id}`)}
                    style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => {
                      setJobModalCustomer(c);
                      setJobForm({ title: '', description: '', price: '' });
                    }}
                    style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    ➕ Add Job
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW JOB MODAL OVERLAY */}
      {jobModalCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: 'var(--bg-card, #1e1e1e)', padding: 24, borderRadius: 12, width: '100%', maxWidth: 450, border: '1px solid var(--border-color, #444)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main, #fff)', borderBottom: '1px solid var(--border-color, #333)', paddingBottom: 10 }}>Create New Job</h3>
            
            {/* STATIC CUSTOMER INFO */}
            <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-input, #2a2a2a)', borderRadius: 8, border: '1px dashed var(--border-color, #444)' }}>
              <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                👤 {jobModalCustomer.first_name} {jobModalCustomer.last_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #aaa)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {jobModalCustomer.phone && <span>📱 {formatPhone(jobModalCustomer.phone)}</span>}
                {jobModalCustomer.email && <span>✉️ {jobModalCustomer.email}</span>}
                {jobModalCustomer.address && <span>📍 {jobModalCustomer.address}</span>}
              </div>
            </div>
            
            {/* INPUT FIELDS */}
            <input 
              placeholder="Job Title / Short Description *" 
              required 
              value={jobForm.title} 
              onChange={e => setJobForm({...jobForm, title: e.target.value})} 
              autoCapitalize="words"
              style={inputStyle} 
            />
            <textarea 
              placeholder="Detailed Notes / Scope of Work..." 
              value={jobForm.description} 
              onChange={e => setJobForm({...jobForm, description: e.target.value})} 
              rows={3}
              style={{...inputStyle, resize: 'vertical'}} 
            />
            <input 
              placeholder="Estimated Price ($)" 
              type="number"
              value={jobForm.price} 
              onChange={e => setJobForm({...jobForm, price: e.target.value})} 
              style={inputStyle} 
            />
            
            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button 
                onClick={() => setJobModalCustomer(null)} 
                style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveJob} 
                disabled={!jobForm.title || savingJob} 
                style={{ flex: 1, padding: '12px', background: 'var(--success, #22c55e)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: (!jobForm.title || savingJob) ? 'not-allowed' : 'pointer', opacity: (!jobForm.title) ? 0.5 : 1 }}
              >
                {savingJob ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
