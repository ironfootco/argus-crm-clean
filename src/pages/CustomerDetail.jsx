import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCustomerAndJobs();
  }, [id]);

  const fetchCustomerAndJobs = async () => {
    setLoading(true);

    // 1. Fetch Customer Record
    const { data: custData, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (custErr) {
      console.error("Error fetching customer:", custErr);
      setLoading(false);
      return;
    }

    setCustomer(custData);

    // 2. Fetch Linked Job History
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .order('scheduled_date', { ascending: false, nullsFirst: false });

    if (jobsData) {
      setJobs(jobsData);
    }

    setLoading(false);
  };

  const startEditing = () => {
    if (!customer) return;
    setFirstName(customer.first_name || '');
    setLastName(customer.last_name || '');
    setPhone(formatPhoneNumber(customer.phone || ''));
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setIsEditing(true);
  };

  const handleSaveCustomer = async () => {
    setSaving(true);

    const updatePayload = {
      first_name: firstName,
      last_name: lastName,
      phone: formatPhoneNumber(phone),
      email: email,
      address: address
    };

    const { error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      alert("Error saving customer updates: " + error.message);
      setSaving(false);
      return;
    }

    await fetchCustomerAndJobs();
    setSaving(false);
    setIsEditing(false);
  };

  const handleDeleteCustomer = async () => {
    const confirmMsg = `Are you sure you want to delete ${customer?.first_name} ${customer?.last_name}? This will unlink their records.`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);

    // Unlink jobs first (or delete if your DB cascades)
    await supabase.from('jobs').update({ customer_id: null }).eq('customer_id', id);

    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      alert("Error deleting customer: " + error.message);
      setSaving(false);
      return;
    }

    navigate('/customers');
  };

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Loading customer profile...</div>;
  if (!customer) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Customer record not found.</div>;

  const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unnamed Client';
  const formattedPhone = formatPhoneNumber(customer.phone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Navigation and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <button 
          onClick={() => navigate('/customers')} 
          style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
        >
          ← Back to Customers
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isEditing ? (
            <>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                disabled={saving}
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveCustomer} 
                disabled={saving}
                style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
              >
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            </>
          ) : (
            <button 
              type="button" 
              onClick={startEditing} 
              style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
            >
              ✏️ Edit Profile
            </button>
          )}

          <button 
            type="button" 
            onClick={handleDeleteCustomer} 
            disabled={saving}
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
          >
            🗑️ Delete Customer
          </button>
        </div>
      </div>

      {/* Primary Customer Profile Card */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>FIRST NAME</label>
                <input 
                  value={firstName} 
                  onChange={e => setFirstName(e.target.value)} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>LAST NAME</label>
                <input 
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>PHONE</label>
                <input 
                  placeholder="(781) 555-5555"
                  value={phone} 
                  onChange={e => setPhone(formatPhoneNumber(e.target.value))} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>EMAIL</label>
                <input 
                  type="email"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>PROPERTY ADDRESS</label>
              <input 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 22, color: 'var(--text-main)' }}>👤 {fullName}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>PHONE</label>
                {formattedPhone ? (
                  <a href={`tel:${formattedPhone.replace(/\D/g, '')}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold', fontSize: 15, display: 'inline-block', marginTop: 2 }}>
                    📞 {formattedPhone}
                  </a>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No Phone Recorded</span>}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>EMAIL</label>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginTop: 2 }}>
                    ✉️ {customer.email}
                  </a>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No Email Recorded</span>}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>PROPERTY ADDRESS</label>
                <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2, color: 'var(--text-main)' }}>
                  📍 {customer.address || 'No Address Logged'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Service & Job History */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--text-accent)' }}>
          📋 Service & Job History ({jobs.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map(j => (
            <div 
              key={j.id} 
              onClick={() => navigate(`/jobs/${j.id}`)}
              style={{
                background: 'var(--bg-input)',
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--text-main)' }}>
                  🛠️ {j.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Scheduled: {j.scheduled_date || 'Unscheduled'} • Stage: <strong style={{ color: 'var(--text-accent)' }}>{j.job_stage || j.status || 'Scheduled'}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--success)' }}>
                  ${j.quoted_price?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 'bold', marginTop: 2 }}>
                  View Job Details →
                </div>
              </div>
            </div>
          ))}

          {jobs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No active or past jobs found for this customer.</p>
          )}
        </div>
      </div>
    </div>
  );
}
