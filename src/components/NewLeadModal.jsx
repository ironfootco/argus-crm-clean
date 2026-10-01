import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const formatPhoneForWave = (phoneStr) => {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  return phoneStr;
};

const formatPhoneDisplay = (phoneStr) => {
  if (!phoneStr) return '(No phone)';
  const digits = String(phoneStr).replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${phoneStr})`;
};

export default function NewLeadModal({ isOpen, onClose, onLeadCreated }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [serviceType, setServiceType] = useState('General Handyman Work');
  const [customService, setCustomService] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  const streetInputRef = useRef(null);

  useEffect(() => { if (isOpen) fetchCustomers(); }, [isOpen]);

  useEffect(() => {
    if (isOpen && !selectedCustomerId && streetInputRef.current && window.google?.maps?.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(streetInputRef.current, { types: ['address'], componentRestrictions: { country: 'us' } });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;
        let streetNumber = ''; let route = ''; let townCity = ''; let stateCode = ''; let postalCode = '';
        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) streetNumber = component.long_name;
          if (types.includes('route')) route = component.long_name;
          if (types.includes('locality')) townCity = component.long_name;
          if (types.includes('administrative_area_level_1')) stateCode = component.short_name;
          if (types.includes('postal_code')) postalCode = component.long_name;
        });
        setStreet(`${streetNumber} ${route}`.trim() || place.name || '');
        setCity(townCity); setState(stateCode); setZip(postalCode);
      });
    }
  }, [isOpen, selectedCustomerId]);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('first_name', { ascending: true });
    if (data) setCustomers(data);
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '');
    let formatted = input;
    if (input.length > 0) {
      if (input.length <= 3) formatted = `(${input}`;
      else if (input.length <= 6) formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
      else formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`;
    }
    setPhone(formatted);
  };

  const handleCustomerSelect = (id) => {
    setSelectedCustomerId(id);
    if (!id) {
      setFirstName(''); setLastName(''); setPhone(''); setEmail(''); setAddress(''); setStreet(''); setCity(''); setState(''); setZip(''); setSmsOptIn(true);
      return;
    }
    const cust = customers.find(c => c.id === id);
    if (cust) {
      setFirstName(cust.first_name || ''); 
      setLastName(cust.last_name || ''); 
      setPhone(cust.phone || ''); 
      setEmail(cust.email || ''); 
      setAddress(cust.address || ''); 
      setSmsOptIn(cust.sms_opt_in ?? true);
    }
  };

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice recognition is not natively supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSiteNotes(prev => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.start();
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!firstName && !lastName && !selectedCustomerId) { alert("Please select an existing customer or enter a customer name."); return; }
    setLoading(true);

    let customerId = selectedCustomerId;
    const fullAddress = selectedCustomerId ? address : [street, city, state ? `${state} ${zip}`.trim() : zip].filter(Boolean).join(', ');

    if (!customerId) {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{ first_name: firstName, last_name: lastName, phone, email, address: fullAddress, sms_opt_in: smsOptIn }])
        .select().single();
      if (custErr) { alert("Error saving customer: " + custErr.message); setLoading(false); return; }
      if (newCust) customerId = newCust.id;
    } else {
      await supabase.from('customers').update({ sms_opt_in: smsOptIn }).eq('id', customerId);
    }

    const activeService = serviceType === 'Custom' ? customService || 'General Work' : serviceType;
    const clientName = `${firstName} ${lastName}`.trim() || 'Client';
    const autoTitle = `${clientName} - ${activeService}`;
    const wavePhone = formatPhoneForWave(phone);

    try {
      const waveRes = await fetch('/api/wavesync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobTitle: autoTitle, 
          quotedPrice: parseFloat(quotedPrice) || 0, 
          notes: siteNotes, 
          customerName: clientName, 
          customerEmail: email, 
          customerPhone: wavePhone, 
          customerAddress: fullAddress 
        })
      });

      const waveData = await waveRes.json().catch(() => ({}));
      
      if (!waveRes.ok || !waveData.success) {
        alert(`Wave Estimate creation failed: ${waveData.error || 'Unknown error'}`);
      } else {
        alert("✅ Draft Estimate successfully created in Wave! Sync it back to Argus when finalized.");
      }
    } catch (err) { 
      alert("Network error: Could not reach Wave API.");
    }

    setLoading(false); 
    onLeadCreated(); 
    onClose();
    setSelectedCustomerId(''); setFirstName(''); setLastName(''); setPhone(''); setEmail(''); setAddress(''); setStreet(''); setCity(''); setState(''); setZip(''); setSiteNotes(''); setQuotedPrice(''); setSmsOptIn(true);
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', zIndex: 9999, padding: '12px 10px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 500, marginTop: 'auto', marginBottom: 'auto', padding: 16, color: 'var(--text-main)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1.5px solid var(--border-color)', paddingBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>📌 Quick New Lead / Sticky Note</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 22, cursor: 'pointer', fontWeight: 'bold', minWidth: 36, minHeight: 36 }}>✕</button>
        </div>
        <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SELECT EXISTING CUSTOMER</label>
            <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}>
              <option value="">-- Or Create New Customer Below --</option>
              {customers.map(c => {
                const nameStr = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed Contact';
                const phoneStr = formatPhoneDisplay(c.phone);
                return (
                  <option key={c.id} value={c.id}>
                    {nameStr} {phoneStr}
                  </option>
                );
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={!!selectedCustomerId} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
            <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} disabled={!!selectedCustomerId} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
          <input placeholder="Phone" value={phone} onChange={handlePhoneChange} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
          {selectedCustomerId ? (
            <input placeholder="Property Address" value={address} disabled style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
          ) : (
            <>
              <input ref={streetInputRef} placeholder="🔍 Type Street Address" value={street} onChange={e => setStreet(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
              <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
                <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SMS OPT-IN</label>
            <select value={smsOptIn ? 'true' : 'false'} onChange={e => setSmsOptIn(e.target.value === 'true')} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SERVICE TYPE</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}>
                <option value="General Handyman Work">General Handyman Work</option>
                <option value="Property Maintenance">Property Maintenance</option>
                <option value="Repairs & Fixing">Repairs & Fixing</option>
                <option value="Custom">Custom Service...</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>EST. QUOTE ($)</label>
              <input type="number" placeholder="Optional ($)" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: 15 }} />
            </div>
          </div>
          {serviceType === 'Custom' && <input placeholder="Enter Custom Service Name" value={customService} onChange={e => setCustomService(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>INTERNAL NOTES</label>
              <button type="button" onClick={startDictation} style={{ background: isListening ? '#ef4444' : 'var(--primary)', color: isListening ? '#fff' : 'var(--primary-text)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>{isListening ? "🔴 Listening..." : "🎤 Voice Dictate"}</button>
            </div>
            <textarea rows="3" placeholder="Speak or type scope details..." value={siteNotes} onChange={e => setSiteNotes(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15 }} />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 6, minHeight: 46, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}>{loading ? "Sending Draft to Wave..." : "📌 Send to Wave Estimates"}</button>
        </form>
      </div>
    </div>
  );
}
