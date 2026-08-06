import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (data) setCustomers(data);
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '');
    let formatted = input;
    if (input.length > 0) {
      if (input.length <= 3) {
        formatted = `(${input}`;
      } else if (input.length <= 6) {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
      } else {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`;
      }
    }
    setPhone(formatted);
  };

  const createCustomer = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName) return alert("First and Last name are required");
    setLoading(true);

    const fullAddress = [street, city, state ? `${state} ${zip}`.trim() : zip]
      .filter(Boolean)
      .join(', ');

    const { error } = await supabase.from('customers').insert([{
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address: fullAddress
    }]);

    setLoading(false);

    if (error) {
      alert("Error saving customer: " + error.message);
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      fetchCustomers();
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>👥 Customer Directory</h2>

      {/* New Customer Form */}
      <form onSubmit={createCustomer} style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, marginBottom: 25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, border: '2px solid var(--border-color)' }}>
        <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        
        <input placeholder="Phone (e.g. 7817246829)" value={phone} onChange={handlePhoneChange} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        <input placeholder="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        
        <input placeholder="Street Address" value={street} onChange={e => setStreet(e.target.value)} style={{ gridColumn: 'span 2', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
          <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
          <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }} />
        </div>

        <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', marginTop: 5, padding: '12px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
          {loading ? "Saving..." : "+ Add Customer"}
        </button>
      </form>

      {/* Customers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {customers.map(c => (
          <div key={c.id} style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--border-color)' }}>
            <div>
              <strong style={{ fontSize: 18, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                {c.first_name} {c.last_name}
              </strong>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                📍 {c.address || 'No address provided'}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 14 }}>
              <div style={{ marginBottom: 2 }}>📞 <span style={{ color: 'var(--text-accent)', fontWeight: 'bold' }}>{c.phone || 'N/A'}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>✉️ {c.email || 'N/A'}</div>
            </div>
          </div>
        ))}
        {customers.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>No customers found. Add your first client above!</p>}
      </div>
    </div>
  );
}
