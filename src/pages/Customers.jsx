import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Customer Form State
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);

  const addressInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Google Places Autocomplete Hook for Add Customer
  useEffect(() => {
    if (showModal && addressInputRef.current && window.google?.maps?.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' }
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let streetNumber = '';
        let route = '';
        let townCity = '';
        let stateCode = '';
        let postalCode = '';

        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) streetNumber = component.long_name;
          if (types.includes('route')) route = component.long_name;
          if (types.includes('locality')) townCity = component.long_name;
          if (types.includes('administrative_area_level_1')) stateCode = component.short_name;
          if (types.includes('postal_code')) postalCode = component.long_name;
        });

        const fullStreet = `${streetNumber} ${route}`.trim();
        setStreet(fullStreet || place.name || '');
        setCity(townCity);
        setState(stateCode);
        setZip(postalCode);
      });
    }
  }, [showModal]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_name', { ascending: true });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
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

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);

    const fullAddress = [street, city, state ? `${state} ${zip}`.trim() : zip].filter(Boolean).join(', ');

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        address: fullAddress
      }])
      .select();

    setSaving(false);

    if (error) {
      alert("Error adding customer: " + error.message);
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      setShowModal(false);
      fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(c => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phoneNum = (c.phone || '').toLowerCase();
    const addressStr = (c.address || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return name.includes(q) || phoneNum.includes(q) || addressStr.includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: 20 }}>👥 Customer Directory ({customers.length})</h2>
        <button 
          onClick={() => setShowModal(true)} 
          style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
        >
          + Add New Customer
        </button>
      </div>

      <input 
        type="text" 
        placeholder="🔍 Search customers by name, phone, or address..." 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, marginBottom: 20, boxSizing: 'border-box' }} 
      />

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading customers...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCustomers.map(c => (
            <div 
              key={c.id} 
              onClick={() => navigate(`/customers/${c.id}`)}
              style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1.5px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>👤 {c.first_name} {c.last_name}</strong>
                {c.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>📞 {c.phone}</div>}
                {c.address && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>📍 {c.address}</div>}
              </div>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>View →</span>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No matching customers found.</p>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 15 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 450, padding: 20, color: 'var(--text-main)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>👤 Add New Customer</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
                <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <input placeholder="Phone Number" value={phone} onChange={handlePhoneChange} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
              <input placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />

              <input 
                ref={addressInputRef}
                placeholder="🔍 Type Street Address (Google Autocomplete)" 
                value={street} 
                onChange={e => setStreet(e.target.value)} 
                style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} 
              />

              <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
                <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <button type="submit" disabled={saving} style={{ marginTop: 10, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
                {saving ? "Saving Customer..." : "Save Customer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
