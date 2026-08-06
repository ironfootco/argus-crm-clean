import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCustomerAndJobs();
  }, [id]);

  const fetchCustomerAndJobs = async () => {
    const { data: custData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (custData) setCustomer(custData);

    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (jobData) setJobs(jobData);

    setLoading(false);
  };

  const deleteCustomer = async () => {
    if (!window.confirm(`Are you sure you want to delete ${customer.first_name} ${customer.last_name}?`)) return;
    setDeleting(true);

    // Unassign linked jobs before deleting
    await supabase.from('jobs').update({ customer_id: null }).eq('customer_id', id);

    const { error } = await supabase.from('customers').delete().eq('id', id);

    setDeleting(false);

    if (error) {
      alert("Error deleting customer: " + error.message);
    } else {
      navigate('/customers');
    }
  };

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Loading customer profile...</div>;
  if (!customer) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Customer not found.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>👤 {customer.first_name} {customer.last_name}</h2>
        <button 
          onClick={deleteCustomer} 
          disabled={deleting}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
        >
          {deleting ? "Deleting..." : "🗑️ Delete Customer"}
        </button>
      </div>

      {/* Contact & Address Summary */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>CUSTOMER DETAILS</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div><strong style={{ color: 'var(--text-muted)' }}>Phone:</strong> <span style={{ color: 'var(--text-accent)', fontWeight: 'bold' }}>{customer.phone || 'N/A'}</span></div>
          <div><strong style={{ color: 'var(--text-muted)' }}>Email:</strong> <span style={{ color: 'var(--text-main)' }}>{customer.email || 'N/A'}</span></div>
          <div style={{ gridColumn: 'span 2' }}><strong style={{ color: 'var(--text-muted)' }}>Address:</strong> <span style={{ color: 'var(--text-main)' }}>📍 {customer.address || 'No address on file'}</span></div>
        </div>
      </div>

      {/* Tied Job History */}
      <h3 style={{ color: 'var(--text-main)', marginBottom: 15 }}>🛠️ Job History ({jobs.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {jobs.map(job => (
          <div 
            key={job.id} 
            onClick={() => navigate(`/jobs/${job.id}`)} 
            style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--border-color)' }}
          >
            <div>
              <strong style={{ fontSize: 17, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Status: {job.status}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
              {job.synced_to_wave && <span style={{ fontSize: 11, color: 'var(--text-accent)', fontWeight: 'bold' }}>Wave Synced ✓</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No jobs on record for this customer.</p>}
      </div>
    </div>
  );
}
