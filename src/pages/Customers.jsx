import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) console.error("Error fetching customers:", error.message);
    if (data) setCustomers(data);
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

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!firstName && !lastName) {
      alert("Please enter a first or last name.");
      return;
    }
    setSaving(true);

    const fullAddress = [street, city, state ? `${state} ${zip}`.trim() : zip].filter(Boolean).join(', ');

    const { error } = await supabase
      .from('customers')
      .insert([{
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        address: fullAddress
      }]);

    setSaving(false);

    if (error) {
      alert("Error adding customer: " + error.message);
      return;
    }

    setShowAddModal(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setStreet('');
    setCity('');
    setState('');
    setZip('');
    fetchCustomers();
  };

  const filteredCustomers = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phoneNum = (c.phone || '').toLowerCase();
    const addr = (c.address || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || phoneNum.includes(term) || addr.includes(term);
  });

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 20 }}>👥 Customer Directory</h2>
        <button 
          onClick={() => setShowAddModal(true)} 
          style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}
        >
          + Add Customer
        </button>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 20 }}>
        <input 
          placeholder="🔍 Search by name, phone, or address..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
        />
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 12 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '88dvh', overflowY: 'auto', padding: 18, color: 'var(--text-main)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottom: '1.5px solid var(--border-color)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>👤 New Customer Profile</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
                <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>

              <input placeholder="Phone (e.g. 7817246829)" value={phone} onChange={handlePhoneChange} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              <input placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />

              <input placeholder="Street Address" value={street} onChange={e => setStreet(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
                <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
                <input placeholder="Zip" value={zip} onChange={e => setZip(e.target.value)} style={{ padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>

              <button type="submit" disabled={saving} style={{ marginTop: 10, minHeight: 48, padding: 12, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}>
                {saving ? "Saving Customer..." : "Save Customer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Directory List Cards */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading customers...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCustomers.map(cust => (
            <div 
              key={cust.id} 
              onClick={() => navigate(`/customers/${cust.id}`)}
              style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '2px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
            >
              <div>
                <strong style={{ fontSize: 17, color: 'var(--text-main)', display: 'block' }}>
                  👤 {cust.first_name} {cust.last_name}
                </strong>
                {cust.phone && (
                  <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 'bold', marginTop: 4 }}>
                    📞 {cust.phone}
                  </div>
                )}
                {cust.address && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    📍 {cust.address}
                  </div>
                )}
              </div>

              <button style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
                View Profile ➔
              </button>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No customers found matching "{searchTerm}".</p>
          )}
        </div>
      )}
    </div>
  );
}
