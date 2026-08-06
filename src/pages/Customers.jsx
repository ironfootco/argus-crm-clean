import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (data) setCustomers(data);
  };

  const createCustomer = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) return alert("First and Last name required");
    setLoading(true);

    const { error } = await supabase.from('customers').insert([formData]);
    
    setLoading(false);
    if (error) {
      alert("Error saving customer: " + error.message);
    } else {
      setFormData({ first_name: '', last_name: '', email: '', phone: '', address: '' });
      fetchCustomers();
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #374151', paddingBottom: 15 }}>
        <h2>👥 Customer Directory</h2>
        <button onClick={() => navigate('/')} style={{ background: '#374151', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
          View Jobs
        </button>
      </header>

      {/* New Customer Form */}
      <form onSubmit={createCustomer} style={{ background: '#1f2937', padding: 15, borderRadius: 8, marginBottom: 25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder="First Name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Last Name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Home Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ gridColumn: 'span 2', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        
        <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? "Saving..." : "+ Add Customer"}
        </button>
      </form>

      {/* Customers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {customers.map(c => (
          <div key={c.id} style={{ background: '#1f2937', padding: 15, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: 16 }}>{c.first_name} {c.last_name}</strong>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>📍 {c.address || 'No address provided'}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#9ca3af' }}>
              <div>📞 {c.phone || 'N/A'}</div>
              <div>✉️ {c.email || 'N/A'}</div>
            </div>
          </div>
        ))}
        {customers.length === 0 && <p style={{ color: '#9ca3af' }}>No customers found. Add your first client above!</p>}
      </div>
    </div>
  );
}
