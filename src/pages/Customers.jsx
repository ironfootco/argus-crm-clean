import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit/Add Modal State
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  // Job History Modal State
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [customerJobs, setCustomerJobs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) {
      alert("Error loading customers: " + error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const handleOpenHistory = async (customer) => {
    setHistoryCustomer(customer);
    setLoadingHistory(true);
    
    // Fetch all jobs linked to this customer
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCustomerJobs(data);
    }
    setLoadingHistory(false);
  };

  const handleDeleteCustomer = async (id, firstName, lastName) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${firstName} ${lastName}? This may affect linked jobs.`)) return;

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      alert("Error deleting customer: " + error.message);
    } else {
      setCustomers(customers.filter(c => c.id !== id));
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      first_name: editingCustomer.first_name,
      last_name: editingCustomer.last_name,
      phone: editingCustomer.phone,
      email: editingCustomer.email,
      address: editingCustomer.address,
      sms_opt_in: editingCustomer.sms_opt_in
    };

    let error;

    if (editingCustomer.id) {
      const res = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
      error = res.error;
    } else {
      const res = await supabase.from('customers').insert([payload]);
      error = res.error;
    }

    if (error) {
      alert("Error saving customer: " + error.message);
    } else {
      fetchCustomers();
      setEditingCustomer(null);
    }
    setSaving(false);
  };

  const handleOpenAddModal = () => {
    setEditingCustomer({
      first_name: '', last_name: '', phone: '', email: '', address: '', sms_opt_in: true
    });
  };

  const filteredCustomers = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const address = (c.address || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    return fullName.includes(search) || phone.includes(search) || email.includes(search) || address.includes(search);
  });

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Customer Directory...</div>;
  }

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        <div>
          <h2 style={{ color: 'var(--text-accent)', margin: '0 0 4px 0', fontSize: 22 }}>👥 Customer Directory</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Manage client contact info, addresses, and SMS preferences.</p>
        </div>
        <button 
          onClick={handleOpenAddModal} 
          style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}
        >
          ➕ Add New Customer
        </button>
      </div>

      {/* SEARCH BAR */}
      <div style={{ marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="🔍 Search by name, phone, email, or address..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '2px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {/* CUSTOMER GRID */}
      {filteredCustomers.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', padding: 30, borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
          No customers found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15 }}>
          {filteredCustomers.map(customer => (
            <div key={customer.id} style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: 18 }}>
                  👤 {customer.first_name} {customer.last_name}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  {customer.phone && <div>📞 {customer.phone}</div>}
                  {customer.email && <div>✉️ <a href={`mailto:${customer.email}`} style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>{customer.email}</a></div>}
                  {customer.address && <div>📍 {customer.address}</div>}
                </div>

                <div style={{ marginTop: 12, fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, background: 'var(--bg-input)', display: 'inline-block', border: '1px solid var(--border-color)', color: customer.sms_opt_in ? 'var(--success)' : 'var(--text-muted)' }}>
                  {customer.sms_opt_in ? '✅ SMS Opt-In: Yes' : '🔕 SMS Opt-In: No'}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => handleOpenHistory(customer)} 
                  style={{ background: 'var(--bg-input)', color: 'var(--text-accent)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                >
                  📜 Job History
                </button>
                <button 
                  onClick={() => setEditingCustomer(customer)} 
                  style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '8px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                >
                  ✏️ Edit
                </button>
                <button 
                  onClick={() => handleDeleteCustomer(customer.id, customer.first_name, customer.last_name)} 
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                >
                  🗑️
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* JOB HISTORY MODAL */}
      {historyCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 600, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>
                📜 Job History for {historyCustomer.first_name} {historyCustomer.last_name}
              </h3>
              <button onClick={() => setHistoryCustomer(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
            ) : customerJobs.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', background: 'var(--bg-input)', borderRadius: 8, color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                No past or active jobs found for this customer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customerJobs.map(job => (
                  <Link 
                    to={`/job/${job.id}`} 
                    key={job.id} 
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none',
                      background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12,
                      color: 'var(--text-main)', transition: '0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--text-main)', marginBottom: 4 }}>🛠️ {job.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Created: {new Date(job.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--success)', marginBottom: 4 }}>
                        ${job.quoted_price?.toLocaleString() || '0'}
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-accent)', border: '1px solid var(--border-color)', display: 'inline-block' }}>
                        {job.status || 'Lead'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT / ADD CUSTOMER MODAL */}
      {editingCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>
                {editingCustomer.id ? '✏️ Edit Customer' : '➕ Add New Customer'}
              </h3>
              <button onClick={() => setEditingCustomer(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>FIRST NAME</label>
                  <input required value={editingCustomer.first_name || ''} onChange={e => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>LAST NAME</label>
                  <input required value={editingCustomer.last_name || ''} onChange={e => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>PHONE</label>
                  <input value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>EMAIL</label>
                  <input type="email" value={editingCustomer.email || ''} onChange={e => setEditingCustomer({ ...editingCustomer, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ADDRESS</label>
                  <input value={editingCustomer.address || ''} onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SMS OPT-IN</label>
                  <select 
                    value={editingCustomer.sms_opt_in ? 'true' : 'false'} 
                    onChange={e => setEditingCustomer({ ...editingCustomer, sms_opt_in: e.target.value === 'true' })} 
                    style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setEditingCustomer(null)} style={{ flex: 1, padding: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 1.5, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                  {saving ? 'Saving...' : '💾 Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
