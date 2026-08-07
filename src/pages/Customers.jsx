import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);

  const streetInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (isModalOpen && streetInputRef.current && window.google?.maps?.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(streetInputRef.current, {
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
  }, [isModalOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
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

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!firstName && !lastName) {
      alert('Please enter at least a first or last name.');
      return;
    }

    setSaving(true);
    const fullAddress = [street, city, state ? `${state} ${zip}`.trim() : zip].filter(Boolean).join(', ');

    const { error } = await supabase.from('customers').insert([
      {
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        address: fullAddress
      }
    ]);

    setSaving(false);

    if (error) {
      alert('Error saving customer: ' + error.message);
    } else {
      setIsModalOpen(false);
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phoneStr = c.phone || '';
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || phoneStr.includes(query);
  });

  const inputStyle = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '12px',
    borderRadius: '6px',
    border: '1.5px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-main)',
    fontSize: '15px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search and Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 22 }}>
          👥 Customer Directory ({filteredCustomers.length})
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          + Add New Customer
        </button>
      </div>

      <input
        type="text"
        placeholder="🔍 Search customers by name or phone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={inputStyle}
      />

      {/* Customer List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading customers...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              onClick={() => navigate(`/customers/${cust.id}`)}
              style={{
                background: 'var(--bg-card)',
                padding: 16,
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              <strong style={{ fontSize: 17, color: 'var(--text-main)', display: 'block' }}>
                👤 {cust.first_name} {cust.last_name}
              </strong>
              {cust.phone && (
                <div style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 'bold', marginTop: 6 }}>
                  📞 {cust.phone}
                </div>
              )}
              {cust.email && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  ✉️ {cust.email}
                </div>
              )}
              {cust.address && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  📍 {cust.address}
                </div>
              )}
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>No matching customers found.</div>
          )}
        </div>
      )}

      {/* FIXED ADD CUSTOMER MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--border-color)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 460,
              padding: 20,
              color: 'var(--text-main)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>👤 Add New Customer</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <input
                placeholder="Phone Number"
                value={phone}
                onChange={handlePhoneChange}
                style={inputStyle}
              />

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <input
                ref={streetInputRef}
                placeholder="🔍 Street Address (Google Autocomplete)"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Town / City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Zipcode"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: 8,
                  minHeight: 46,
                  padding: 12,
                  background: 'var(--success)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: 16
                }}
              >
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
