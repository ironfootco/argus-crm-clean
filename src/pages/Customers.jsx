import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const navigate = useNavigate();
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

  // Auto-format phone number to (XXX) XXX-XXXX
  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, ''); // strip non-digits
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

    // Combine address parts into a clean single line for storage
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
    <div style={{ maxWidth: 800, margin: '20px auto', padding: 20, fontFamily: 'sans-serif' }}>
      {/* Universal Top-Left Navigation */}
      <button 
        onClick={() => navigate('/')} 
        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginBottom: 15, fontSize: 14, fontWeight: 'bold' }}
      >
        ← Back to Dashboard
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #374151', paddingBottom: 15 }}>
        <h2 style={{ margin: 0, color: '#fff' }}>👥 Customer Directory</h2>
      </header>

      {/* New Customer Form */}
      <form onSubmit={createCustomer} style={{ background: '#1f2937', padding: 20, borderRadius: 8, marginBottom: 25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        
        <input placeholder="Phone (e.g. 7817246829)" value={phone} onChange={handlePhoneChange} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <input placeholder="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        
        {/* Address Breakdown */}
        <input placeholder="Street Address" value={street} onChange={e => setStreet(e.target.value)} style={{ gridColumn: 'span 2', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
          <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
          <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#fff' }} />
        </div>

        <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', marginTop: 5, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
          {loading ? "Saving..." : "+ Add Customer"}
        </button>
      </form>

      {/* Customers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {customers.map(c => (
          <div key={c.id} style={{ background: '#1f2937', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {/* High Contrast Name Header */}
              <strong style={{ fontSize: 17, color: '#ffffff', display: 'block', marginBottom: 4 }}>
                {c.first_name} {c.last_name}
              </strong>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                📍 {c.address || 'No address provided'}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#d1d5db' }}>
              <div style={{ marginBottom: 2 }}>📞 <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{c.phone || 'N/A'}</span></div>
              <div>✉️ {c.email || 'N/A'}</div>
            </div>
          </div>
        ))}
        {customers.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>No customers found. Add your first client above!</p>}
      </div>
    </div>
  );
}
