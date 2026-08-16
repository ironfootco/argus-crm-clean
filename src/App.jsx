import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { processAndUploadMarketingGraphic } from './utils/driveUpload';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
import ManagerHub from './pages/ManagerHub';
import DesignSandbox from './pages/DesignSandbox';
import Login from './components/Login';

/* ========================================================================== */
/* 🔓 PUBLIC BOOKING COMPONENT (Clean, Borderless for Website Embeds)          */
/* ========================================================================== */
function PublicBooking() {
  const [step, setStep] = useState(2); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [zip, setZip] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);

  const allowedZips = [
    '02025', '02043', '02045', '02050', '02061', 
    '02066', '02188', '02189', '02190', '02332', 
    '02333', '02338', '02339', '02341', '02351', 
    '02359', '02364', '02367', '02370', '02382'
  ]; 

  const handleZipCheck = (e) => {
    e.preventDefault();
    if (allowedZips.includes(zip.trim())) {
      setStep(2);
    } else {
      setStep(-1);
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let customerId;
      const fullAddress = [street, unit, city, 'MA', zip].filter(Boolean).join(', ');

      const { data: existingCust, error: selectErr } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (existingCust) {
        customerId = existingCust.id;
        await supabase
          .from('customers')
          .update({ sms_opt_in: smsConsent })
          .eq('id', customerId);
      } else {
        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert([{
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            address: fullAddress,
            sms_opt_in: smsConsent
          }])
          .select()
          .single();
        
        if (custError) throw custError;
        customerId = newCust.id;
      }

      const autoTitle = `${firstName} ${lastName} - Website Lead`;

      const { error: jobError } = await supabase
        .from('jobs')
        .insert([{
          customer_id: customerId,
          title: autoTitle,
          service_type: 'General Handyman Work',
          status: 'Lead',
          job_stage: 'Lead',
          assigned_to: 'Unassigned',
          site_notes: `Project Details: ${projectNotes}`,
        }]);

      if (jobError) throw jobError;

      try {
        const waveRes = await fetch('/api/waveTest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobTitle: autoTitle,
            quotedPrice: 0,
            notes: `Project Details: ${projectNotes}`,
            customerName: `${firstName} ${lastName}`.trim(),
            customerEmail: email,
            customerPhone: phone,
            customerAddress: fullAddress
          })
        });

        if (!waveRes.ok) {
          const errText = await waveRes.text();
          console.warn(`Wave API Issue: ${waveRes.status}`, errText);
        }
      } catch (err) {
        console.warn(`Network Error hitting Wave API: ${err.message}`);
      }

      setStep(3);
    } catch (err) {
      console.error('Booking Error:', err);
      setError(err.message || 'Error submitting request. Please check Supabase permissions.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '10px',
    borderRadius: '6px',
    border: '1px solid #3f3f46',
    background: '#27272a',
    color: '#ffffff',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      padding: '12px 16px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* 🎯 BORDERLESS FORM CONTAINER */}
      <div style={{ 
        width: '100%', 
        maxWidth: '440px', 
        color: '#ffffff', 
        boxSizing: 'border-box',
        background: 'transparent',
        border: 'none',
        padding: '0'
      }}>
        
        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>
            Iron Foot Co.
          </h1>
          <p style={{ color: '#a1a1aa', margin: '4px 0 0 0', fontSize: '13px' }}>Service Request & Scheduling</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleZipCheck} style={{ width: '100%', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', fontSize: '15px', marginBottom: '14px', color: '#eee' }}>
              Let&apos;s check if we operate in your area
            </h3>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#bbb' }}>Enter your Zip Code</label>
            <input 
              type="text" 
              required 
              style={{ ...inputStyle, padding: '12px', marginBottom: '14px', fontSize: '15px' }} 
              placeholder="e.g. 02066" 
              value={zip} 
              onChange={(e) => setZip(e.target.value)} 
            />
            <button type="submit" style={{
              width: '100%', padding: '12px', background: '#d4af37', color: '#000',
              border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer'
            }}>Verify Zip Code</button>
          </form>
        )}

        {step === -1 && (
          <div style={{ textAlign: 'center', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '16px', color: '#f97316', marginBottom: '8px' }}>Outside Service Area</h3>
            <p style={{ color: '#ccc', lineHeight: '1.5', fontSize: '13px', marginBottom: '16px' }}>
              {"Looks like you're outside our standard online booking area. Give us a call at "}
              <strong style={{ color: '#fff' }}>(781) 851-6777</strong>
              {" and we'll see how we can help!"}
            </p>
            <button onClick={() => setStep(1)} style={{
              width: '100%', padding: '12px', background: '#27272a', color: '#fff',
              border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
            }}>Try Another Zip</button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <input type="text" required style={inputStyle} placeholder="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" required style={inputStyle} placeholder="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <input type="tel" required style={inputStyle} placeholder="Phone Number *" value={phone} onChange={handlePhoneChange} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="email" required style={inputStyle} placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}>
                <input type="text" required style={inputStyle} placeholder="Street Address *" value={street} onChange={e => setStreet(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" style={inputStyle} placeholder="Unit/Apt" value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}>
                <input type="text" required style={inputStyle} placeholder="City *" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" disabled style={{ ...inputStyle, opacity: 0.7 }} value="MA" />
              </div>
            </div>

            <textarea required style={{ ...inputStyle, minHeight: '75px', resize: 'vertical' }} placeholder="Briefly describe what you need done..." value={projectNotes} onChange={e => setProjectNotes(e.target.value)} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', padding: '8px 10px', background: '#27272a', borderRadius: '6px', border: '1px solid #3f3f46' }}>
              <input 
                type="checkbox" 
                id="sms"
                required
                checked={smsConsent} 
                onChange={(e) => setSmsConsent(e.target.checked)} 
                style={{ marginTop: '2px', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }}
              />
              <label htmlFor="sms" style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.35', cursor: 'pointer' }}>
                By checking this box, I consent to receive text messages from Iron Foot Company LLC regarding my estimate and scheduling. Message and data rates may apply. Reply STOP to opt out. I consent to the{' '}
                <a 
                  href="/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: '#d4af37', textDecoration: 'underline' }}
                >
                  Terms of Service and Privacy Policy
                </a>.
              </label>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '12px', textAlign: 'center' }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', background: '#d4af37', color: '#000',
              border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer'
            }}>
              {loading ? 'Submitting...' : 'Request Estimate'}
            </button>
            
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <h2 style={{ color: '#22c55e', fontSize: '18px', margin: '0 0 8px 0' }}>✓ Request Received</h2>
            <p style={{ color: '#ccc', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
              {`Thank you, ${firstName}! We've received your information and will be in touch shortly to confirm details and scheduling.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 📸 MODALS & CRM COMPONENTS                                                 */
/* ========================================================================== */
function PhotoModal({ isOpen, type, jobTitle, onClose, onSave, onSkip }) {
  const [photo, setPhoto] = useState(null);

  if (!isOpen) return null;

  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setPhoto(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const isBefore = type === 'before';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
      alignItems: 'center', zIndex: 9999, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '2px solid var(--border-color)',
        borderRadius: 12, width: '100%', maxWidth: 440, padding: 20, color: 'var(--text-main)', textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: 'var(--text-accent)' }}>
          {isBefore ? '📸 Work Area: Before Photo' : '📷 Proof of Work: After Photo'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          {isBefore 
            ? `Take a quick before photo of the site for "${jobTitle}" before starting.` 
            : `Snap a photo of the completed work for "${jobTitle}".`}
        </p>

        {photo ? (
          <div style={{ marginBottom: 16 }}>
            <img src={photo} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
            <button type="button" onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', marginTop: 6, fontWeight: 'bold' }}>
              🔄 Retake Photo
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', padding: '24px 12px', border: '2px dashed var(--border-color)', borderRadius: 8,
              background: 'var(--bg-input)', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, color: 'var(--primary)'
            }}>
              📷 Tap to Open Camera / Select Photo
              <input type="file" accept="image/*" capture="environment" onChange={handleCapture} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button 
            type="button" 
            onClick={() => { setPhoto(null); onSkip(); }} 
            style={{ flex: 1, padding: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
          >
            Skip for Now
          </button>
          <button 
            type="button" 
            disabled={!photo} 
            onClick={() => { const p = photo; setPhoto(null); onSave(p); }} 
            style={{ flex: 1.5, padding: 12, background: photo ? 'var(--success)' : 'var(--border-color)', color: '#fff', border: 'none', borderRadius: 6, cursor: photo ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: 14 }}
          >
            Save Photo & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function NewLeadModal({ isOpen, onClose, onLeadCreated }) {
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
  const [photos, setPhotos] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  const streetInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !selectedCustomerId && streetInputRef.current && window.google?.maps?.places) {
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
  }, [isOpen, selectedCustomerId]);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name');
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

  const handleCustomerSelect = (id) => {
    setSelectedCustomerId(id);
    if (!id) {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      setSmsOptIn(true);
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
    if (!SpeechRecognition) {
      alert("Voice recognition is not natively supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSiteNotes(prev => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  const handlePhotoCapture = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPhotos(prev => [...prev, compressedBase64]);
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!firstName && !lastName && !selectedCustomerId) {
      alert("Please select an existing customer or enter a customer name.");
      return;
    }
    setLoading(true);

    let customerId = selectedCustomerId;

    const fullAddress = selectedCustomerId 
      ? address 
      : [street, city, state ? `${state} ${zip}`.trim() : zip].filter(Boolean).join(', ');

    if (!customerId) {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          address: fullAddress,
          sms_opt_in: smsOptIn
        }])
        .select()
        .single();

      if (custErr) {
        alert("Error saving customer: " + custErr.message);
        setLoading(false);
        return;
      }
      if (newCust) customerId = newCust.id;
    } else {
      await supabase
        .from('customers')
        .update({ sms_opt_in: smsOptIn })
        .eq('id', customerId);
    }

    const activeService = serviceType === 'Custom' ? customService || 'General Work' : serviceType;
    const clientName = `${firstName} ${lastName}`.trim() || 'Client';
    const autoTitle = `${clientName} - ${activeService}`;

    const { error: jobErr } = await supabase
      .from('jobs')
      .insert([{
        title: autoTitle,
        customer_id: customerId,
        service_type: activeService,
        status: 'Lead',
        job_stage: 'Lead', 
        assigned_to: 'Unassigned',
        quoted_price: parseFloat(quotedPrice) || 0,
        site_notes: siteNotes,
        photo_urls: photos
      }]);

    if (jobErr) {
      alert("Error saving job lead: " + jobErr.message);
      setLoading(false);
      return;
    }

    try {
      const waveRes = await fetch('/api/waveTest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: autoTitle,
          quotedPrice: parseFloat(quotedPrice) || 0,
          notes: siteNotes,
          customerName: clientName,
          customerEmail: email,
          customerPhone: phone,
          customerAddress: fullAddress
        })
      });

      if (!waveRes.ok) {
        const errorText = await waveRes.text();
        console.warn(`Wave API Error: ${waveRes.status}`, errorText);
      }
    } catch (err) {
      console.warn(`Network Error hitting Wave API: ${err.message}`);
    }

    setLoading(false);
    onLeadCreated();
    onClose();

    setSelectedCustomerId('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setStreet('');
    setCity('');
    setState('');
    setZip('');
    setSiteNotes('');
    setPhotos([]);
    setQuotedPrice('');
    setSmsOptIn(true);
  };

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.85)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'flex-start', 
      zIndex: 9999, 
      padding: '12px 10px',
      overflowY: 'auto'
    }}>
      <div style={{ 
        background: 'var(--bg-card)', 
        border: '2px solid var(--border-color)', 
        borderRadius: 12, 
        width: '100%', 
        maxWidth: 500, 
        marginTop: 'auto',
        marginBottom: 'auto',
        padding: 16, 
        color: 'var(--text-main)', 
        boxSizing: 'border-box' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1.5px solid var(--border-color)', paddingBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>📌 Quick New Lead / Sticky Note</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 22, cursor: 'pointer', fontWeight: 'bold', minWidth: 36, minHeight: 36 }}>✕</button>
        </div>

        <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SELECT EXISTING CUSTOMER</label>
            <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}>
              <option value="">-- Or Create New Customer Below --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.phone || 'No phone'})</option>
              ))}
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
              <input 
                ref={streetInputRef}
                placeholder="🔍 Type Street Address (Google Autocomplete)" 
                value={street} 
                onChange={e => setStreet(e.target.value)} 
                style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} 
              />
              <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
                <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SMS OPT-IN</label>
            <select 
              value={smsOptIn ? 'true' : 'false'} 
              onChange={e => setSmsOptIn(e.target.value === 'true')} 
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
            >
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
                <option value="Sealcoating & Asphalt">Sealcoating & Asphalt</option>
                <option value="Custom">Custom Service...</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>EST. QUOTE ($)</label>
              <input type="number" placeholder="Optional ($)" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: 15 }} />
            </div>
          </div>

          {serviceType === 'Custom' && (
            <input placeholder="Enter Custom Service Name" value={customService} onChange={e => setCustomService(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box', width: '100%' }} />
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>INTERNAL NOTES</label>
              <button type="button" onClick={startDictation} style={{ background: isListening ? '#ef4444' : 'var(--primary)', color: isListening ? '#fff' : 'var(--primary-text)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                {isListening ? "🔴 Listening..." : "🎤 Voice Dictate"}
              </button>
            </div>
            <textarea rows="3" placeholder="Speak or type scope details..." value={siteNotes} onChange={e => setSiteNotes(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>📷 SITE PHOTOS</label>
            <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoCapture} style={{ fontSize: 13, color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt="site preview" style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  <button type="button" onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ marginTop: 6, minHeight: 46, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}>
            {loading ? "Saving Lead & Syncing Draft..." : "📌 Save Sticky Note Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Layout({ children, onOpenLeadModal, activeWorker, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('argus_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('argus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <>
      <style>{`
        :root, [data-theme="dark"] {
          --bg-main: #121316;
          --bg-card: #1c1e24;
          --bg-input: #121316;
          --border-color: #374151;
          --primary: #eab308;
          --primary-text: #000000;
          --success: #10b981;
          --warning: #f97316;
          --text-main: #ffffff;
          --text-muted: #9ca3af;
          --text-accent: #fde047;
        }

        [data-theme="light"] {
          --bg-main: #f8fafc;
          --bg-card: #ffffff;
          --bg-input: #ffffff;
          --border-color: #0f172a;
          --primary: #0284c7;
          --primary-text: #ffffff;
          --success: #059669;
          --warning: #d97706;
          --text-main: #0f172a;
          --text-muted: #334155;
          --text-accent: #0284c7;
        }

        html, body {
          margin: 0;
          padding: 0;
          background-color: var(--bg-main) !important;
          color: var(--text-main) !important;
          font-family: system-ui, -apple-system, sans-serif;
          min-height: 100dvh;
        }

        .pac-container {
          background-color: #1c1e24 !important;
          border: 1.5px solid #374151 !important;
          border-radius: 8px !important;
          font-family: inherit !important;
          z-index: 10000 !important;
        }
        .pac-item {
          color: #ffffff !important;
          border-top: 1px solid #374151 !important;
          padding: 8px 12px !important;
        }
        .pac-item:hover, .pac-item-selected {
          background-color: #121316 !important;
        }
        .pac-item-query {
          color: #eab308 !important;
        }
        .pac-matched {
          color: #10b981 !important;
        }

        input::placeholder, textarea::placeholder {
          color: var(--text-muted);
          opacity: 0.8;
        }

        button, input, select, textarea {
          font-family: inherit;
        }

        .desktop-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 15px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .mobile-bottom-nav {
          display: none;
        }

        @media (max-width: 640px) {
          .desktop-nav-buttons {
            display: none !important;
          }

          .desktop-header {
            margin-bottom: 15px;
            padding-bottom: 10px;
          }

          .app-container {
            padding-bottom: 90px !important;
          }

          .mobile-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-card);
            border-top: 2px solid var(--border-color);
            padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) 12px;
            justify-content: space-around;
            align-items: center;
            z-index: 9000;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 10px;
            font-weight: bold;
            gap: 3px;
            cursor: pointer;
            padding: 6px 8px;
            min-width: 55px;
          }

          .mobile-nav-item.active {
            color: var(--primary);
          }

          .mobile-lead-btn {
            background: var(--success) !important;
            color: #fff !important;
            border-radius: 50% !important;
            width: 48px;
            height: 48px;
            font-size: 20px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: -20px;
            border: 3px solid var(--bg-main) !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          }
        }
      `}</style>

      <div className="app-container" style={{ maxWidth: 850, margin: '0 auto', padding: 20 }}>
        <header className="desktop-header">
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Argus CRM</h2>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-accent)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)' }}>
              👤 {activeWorker}
            </span>

            <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              {theme === 'dark' ? '☀️' : '⚡'}
            </button>

            <button onClick={onLogout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              🔒 Logout
            </button>
          </div>
          
          <div className="desktop-nav-buttons" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onOpenLeadModal} style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              📌 + New Lead
            </button>
            <button onClick={() => navigate('/')} style={{ background: location.pathname === '/' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              ⚡ My Dashboard
            </button>
            <button onClick={() => navigate('/jobs')} style={{ background: location.pathname === '/jobs' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/jobs' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              📋 All Jobs
            </button>
            <button onClick={() => navigate('/customers')} style={{ background: location.pathname.startsWith('/customers') ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname.startsWith('/customers') ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              👥 Customers
            </button>
            
            {activeWorker !== 'Edwin' && (
              <button onClick={() => navigate('/manager')} style={{ background: location.pathname === '/manager' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/manager' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                💼 Manager
              </button>
            )}
          </div>
        </header>

        {children}

        <nav className="mobile-bottom-nav">
          <button onClick={() => navigate('/')} className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span>Dashboard</span>
          </button>
          <button onClick={() => navigate('/jobs')} className={`mobile-nav-item ${location.pathname === '/jobs' ? 'active' : ''}`}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span>Jobs</span>
          </button>
          
          <button onClick={onOpenLeadModal} className="mobile-nav-item mobile-lead-btn" title="Add New Lead">
            📌
          </button>

          <button onClick={() => navigate('/customers')} className={`mobile-nav-item ${location.pathname.startsWith('/customers') ? 'active' : ''}`}>
            <span style={{ fontSize: 18 }}>👥</span>
            <span>Customers</span>
          </button>

          {activeWorker !== 'Edwin' && (
            <button onClick={() => navigate('/manager')} className={`mobile-nav-item ${location.pathname === '/manager' ? 'active' : ''}`}>
              <span style={{ fontSize: 18 }}>💼</span>
              <span>Manager</span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)', maxWidth: 750, margin: '20px auto' }}>
      <h2 style={{ color: 'var(--text-accent)', marginTop: 0 }}>Privacy Policy & SMS Terms</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Last Updated: August 2026</p>

      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>1. Information Collection & Use</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
        We collect customer names, phone numbers, email addresses, and physical property addresses solely for the purpose of scheduling, estimating, and performing handyman, repairs, and property management services.
      </p>

      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>2. Mobile Information Safeguard (A2P Compliance)</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18, background: 'var(--bg-input)', padding: 12, borderRadius: 6, borderLeft: '4px solid var(--primary)' }}>
        <strong>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.</strong> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
      </p>

      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>3. SMS Communication & Frequency</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
        By booking a service or requesting a quote, you consent to receive operational SMS notifications (such as crew &apos;En Route&apos; alerts, job completion updates, and appointment reminders). Message frequency varies based on active service jobs. Standard message and data rates may apply.
      </p>

      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>4. Opt-Out & Assistance</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
        You can cancel the SMS service at any time by texting <strong>STOP</strong>. After sending <strong>STOP</strong>, we will send an SMS confirmation that you have been unsubscribed. For help, reply <strong>HELP</strong> or contact our office directly.
      </p>
    </div>
  );
}

function Dashboard({ refreshTrigger, activeWorker }) {
  const [jobs, setJobs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);

  const [photoModalJob, setPhotoModalJob] = useState(null);
  const [photoModalType, setPhotoModalType] = useState(null);

  const navigate = useNavigate();

  const getTodayIso = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayIso = getTodayIso();
  const [selectedFilterDate, setSelectedFilterDate] = useState(todayIso);

  useEffect(() => {
    fetchActiveJobs();
    fetchTeamMembers();
  }, [refreshTrigger, activeWorker]);

  useEffect(() => {
    checkShiftStatus();
  }, [activeWorker]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from('team_members').select('*').order('name');
    if (data && data.length > 0) {
      setTeamMembers(data);
    }
  };

  const fetchActiveJobs = async () => {
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Job Complete')
      .order('scheduled_date', { ascending: true, nullsFirst: false });

    if (jobData) {
      const activeFieldJobs = jobData.filter(j => {
        if (!j.assigned_to || j.assigned_to === 'Unassigned') return false;
        return (
          j.assigned_to === activeWorker ||
          j.assigned_to.includes(activeWorker) ||
          j.assigned_to.includes('Both')
        );
      });

      const merged = activeFieldJobs.map(j => ({ ...j, customers: custMap[j.customer_id] }));
      setJobs(merged);
    }
  };

  const checkShiftStatus = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*')
      .eq('worker_name', activeWorker)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveShift(data[0]);
    } else {
      setActiveShift(null);
    }
  };

  const toggleShiftClock = async () => {
    setLoadingShift(true);
    if (activeShift) {
      const clockInTime = new Date(activeShift.clock_in);
      const clockOutTime = new Date();
      const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

      await supabase
        .from('timesheets')
        .update({ clock_out: clockOutTime.toISOString(), total_hours: hours })
        .eq('id', activeShift.id);

      setActiveShift(null);
    } else {
      const { data } = await supabase
        .from('timesheets')
        .insert([{ worker_name: activeWorker, clock_in: new Date().toISOString() }])
        .select()
        .single();

      if (data) setActiveShift(data);
    }
    setLoadingShift(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unscheduled';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const handleStageClick = (job, targetStage) => {
    if (targetStage === 'En Route' && job.scheduled_date && job.scheduled_date !== todayIso) {
      const formattedDate = formatDate(job.scheduled_date);
      const confirmNotice = `⚠️ SAFETY CHECK:\nThis job is scheduled for ${formattedDate}, NOT TODAY.\n\nAre you sure you want to start 'En Route' for this job?`;
      if (!window.confirm(confirmNotice)) return;
    }

    if (targetStage === 'On Site / In Progress' && !job.before_photo_url) {
      setPhotoModalJob(job);
      setPhotoModalType('before');
      return;
    }

    if (targetStage === 'Job Complete' && !job.after_photo_url) {
      setPhotoModalJob(job);
      setPhotoModalType('after');
      return;
    }

    commitStageUpdate(job, targetStage);
  };

  const handlePhotoSaved = async (photoBase64) => {
    if (!photoModalJob) return;

    const isBefore = photoModalType === 'before';
    const updateField = isBefore ? { before_photo_url: photoBase64 } : { after_photo_url: photoBase64 };

    const { error: saveErr } = await supabase.from('jobs').update(updateField).eq('id', photoModalJob.id);
    if (saveErr) {
      alert(`❌ Database Save Error:\n${saveErr.message}`);
      return;
    }

    const { data: freshJob } = await supabase.from('jobs').select('*').eq('id', photoModalJob.id).single();

    const nextStage = isBefore ? 'On Site / In Progress' : 'Job Complete';
    
    setPhotoModalJob(null);
    setPhotoModalType(null);

    commitStageUpdate(freshJob || { ...photoModalJob, ...updateField }, nextStage);
  };

  const handlePhotoSkipped = () => {
    if (!photoModalJob) return;
    const nextStage = photoModalType === 'before' ? 'On Site / In Progress' : 'Job Complete';
    const job = photoModalJob;
    
    setPhotoModalJob(null);
    setPhotoModalType(null);

    commitStageUpdate(job, nextStage);
  };

  const commitStageUpdate = async (job, stage, isPaused = false) => {
    let updateData = { job_stage: stage, is_paused: isPaused };

    if (stage === 'On Site / In Progress' && !isPaused) {
      updateData.job_started_at = new Date().toISOString();
      updateData.status = 'In Progress';
    }

    if ((isPaused && stage === 'On Site / In Progress') || stage === 'Job Complete') {
      if (job.job_started_at) {
        const startTime = new Date(job.job_started_at);
        const endTime = new Date();
        let hoursWorked = parseFloat(((endTime - startTime) / (1000 * 60 * 60)).toFixed(2));
        if (hoursWorked <= 0) hoursWorked = 0.02;

        const activeMember = teamMembers.find(m => m.name === activeWorker);
        const activeRate = activeMember ? activeMember.hourly_rate : 40;

        const newLog = { 
          worker_name: activeWorker, 
          hours: hoursWorked, 
          rate: activeRate 
        };
        const currentLogs = job.time_logs || [];
        
        updateData.time_logs = [...currentLogs, newLog];
        updateData.job_started_at = null;
      }
    }

    if (stage === 'Job Complete') {
      updateData.status = 'Job Complete';

      const jobWithPhotos = { ...job, ...updateData };
      await processAndUploadMarketingGraphic(jobWithPhotos);
    }

    await supabase.from('jobs').update(updateData).eq('id', job.id);
    fetchActiveJobs();
  };

  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoStr = `${year}-${month}-${day}`;
      
      const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;
      
      const dayJobs = jobs.filter(j => j.scheduled_date === isoStr);
      
      days.push({
        isoStr,
        dayLabel,
        monthDay,
        jobCount: dayJobs.length
      });
    }
    return days;
  };

  const next7Days = getNext7Days();

  const filteredJobs = jobs.filter(j => {
    if (selectedFilterDate === 'ALL_UPCOMING') return true;
    return j.scheduled_date === selectedFilterDate;
  });

  const targetLoadoutDate = selectedFilterDate === 'ALL_UPCOMING' ? todayIso : selectedFilterDate;
  const isTodayLoadout = targetLoadoutDate === todayIso;
  
  const loadoutTitle = isTodayLoadout
    ? `🚛 ${activeWorker}'s Truck & Tool Loadout`
    : `🚛 Tool & Equipment Prep for ${formatDate(targetLoadoutDate)}`;

  const loadoutJobs = jobs.filter(j => j.scheduled_date === targetLoadoutDate);
  const loadoutMaterials = loadoutJobs.map(j => j.materials_needed).filter(Boolean).join(' • ');

  let lastRenderedDate = null;

  return (
    <div>
      <PhotoModal 
        isOpen={!!photoModalJob} 
        type={photoModalType} 
        jobTitle={photoModalJob?.title} 
        onClose={() => setPhotoModalJob(null)} 
        onSave={handlePhotoSaved} 
        onSkip={handlePhotoSkipped} 
      />

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 4 }}>PAYROLL SHIFT CLOCK</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-main)' }}>
              👤 {activeWorker}
            </div>
            {activeShift && (
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 'bold' }}>
                🟢 Clocked in since {new Date(activeShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={toggleShiftClock} 
          disabled={loadingShift}
          style={{ minHeight: 48, padding: '10px 20px', background: activeShift ? '#ef4444' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
        >
          {loadingShift ? "Saving..." : activeShift ? `🛑 Clock Out ${activeWorker}` : `🟢 Clock In ${activeWorker}`}
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: 15 }}>📅 {activeWorker}&apos;s 7-Day Field Outlook</h4>
          <button 
            onClick={() => setSelectedFilterDate('ALL_UPCOMING')} 
            style={{ background: selectedFilterDate === 'ALL_UPCOMING' ? 'var(--primary)' : 'var(--bg-input)', color: selectedFilterDate === 'ALL_UPCOMING' ? 'var(--primary-text)' : 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}
          >
            Show All
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
          {next7Days.map(d => {
            const isSelected = selectedFilterDate === d.isoStr;
            return (
              <button
                key={d.isoStr}
                onClick={() => setSelectedFilterDate(isSelected ? 'ALL_UPCOMING' : d.isoStr)}
                style={{
                  background: isSelected ? 'var(--primary)' : d.jobCount > 0 ? 'var(--bg-input)' : 'transparent',
                  color: isSelected ? 'var(--primary-text)' : 'var(--text-main)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 'bold', opacity: 0.8 }}>{d.dayLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 'bold' }}>{d.monthDay}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: d.jobCount > 0 ? 'var(--success)' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 'bold', marginTop: 2 }}>
                  {d.jobCount} {d.jobCount === 1 ? 'job' : 'jobs'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-accent)', fontSize: 15 }}>{loadoutTitle}</h4>
        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
          {loadoutMaterials || (isTodayLoadout ? "No materials specified for today's jobs." : `No materials specified for ${formatDate(targetLoadoutDate)}.`)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ color: 'var(--text-main)', margin: 0 }}>
          ⚡ {activeWorker}&apos;s Schedule ({filteredJobs.length})
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-accent)', fontWeight: 'bold' }}>
          {selectedFilterDate === 'ALL_UPCOMING' ? 'Viewing All Upcoming Days' : `Filtering: ${formatDate(selectedFilterDate)}`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {filteredJobs.map(job => {
          const stage = job.job_stage || 'Scheduled';
          const isUnassigned = job.assigned_to === 'Unassigned' || !job.assigned_to;
          const cust = job.customers;
          const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;
          const address = cust?.address || job.address || null;

          let showDateBanner = false;
          if (selectedFilterDate === 'ALL_UPCOMING') {
            if (job.scheduled_date !== lastRenderedDate) {
              showDateBanner = true;
              lastRenderedDate = job.scheduled_date;
            }
          }

          const isJobToday = job.scheduled_date === todayIso;

          return (
            <React.Fragment key={job.id}>
              {showDateBanner && (
                <div style={{ 
                  margin: '15px 0 5px 0', 
                  padding: '10px 14px', 
                  background: isJobToday ? 'var(--primary)' : 'var(--bg-card)', 
                  color: isJobToday ? 'var(--primary-text)' : 'var(--text-accent)', 
                  borderRadius: 6, 
                  border: '1.5px solid var(--border-color)', 
                  fontWeight: 'bold', 
                  fontSize: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>📅 {isJobToday ? "TODAY'S SCHEDULE" : `UPCOMING: ${formatDate(job.scheduled_date)}`}</span>
                  {!isJobToday && <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>Future Date</span>}
                </div>
              )}

              <div style={{ 
                background: 'var(--bg-card)', 
                padding: 18, 
                borderRadius: 8, 
                border: isJobToday ? '2px solid var(--border-color)' : '1.5px dashed var(--border-color)',
                opacity: (selectedFilterDate === 'ALL_UPCOMING' && !isJobToday) ? 0.85 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.id}`)}>
                  <div>
                    <strong style={{ fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                    
                    {custName && (
                      <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 'bold', marginTop: 4 }}>
                        👤 {custName} {cust?.phone ? `• 📞 ${cust.phone}` : ''}
                      </div>
                    )}

                    {address && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        📍 {address}
                      </div>
                    )}

                    {job.materials_needed && (
                      <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 4, fontWeight: 'bold' }}>
                        📦 Tools & Materials: {job.materials_needed}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: job.before_photo_url ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)', color: job.before_photo_url ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                        {job.before_photo_url ? '📸 Before Photo: ✅' : '📸 Before Photo: ⚠️ Missing'}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: job.after_photo_url ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)', color: job.after_photo_url ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                        {job.after_photo_url ? '📷 After Photo: ✅' : '📷 After Photo: ⚠️ Missing'}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>
                        Assigned: <span style={{ color: isUnassigned ? 'var(--warning)' : 'var(--text-accent)', fontWeight: 'bold' }}>{isUnassigned ? '⚠️ Unassigned' : job.assigned_to}</span>
                      </span>

                      {job.scheduled_date ? (
                        <span style={{ color: isJobToday ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>
                          📅 {formatDate(job.scheduled_date)} {job.scheduled_time ? `⏰ ${formatTime(job.scheduled_time)}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontWeight: 'bold', background: 'rgba(249, 115, 22, 0.15)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--warning)' }}>
                          ⚠️ Unscheduled
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block' }}>
                      Stage: {stage} {job.is_paused ? '(Paused)' : ''}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stage === 'Scheduled' || stage === 'Lead' ? (
                    <button onClick={() => handleStageClick(job, 'En Route')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      🚗 On My Way
                    </button>
                  ) : null}

                  {stage === 'En Route' ? (
                    <button onClick={() => handleStageClick(job, 'On Site / In Progress')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      📍 Arrived On Site
                    </button>
                  ) : null}

                  {stage === 'On Site / In Progress' ? (
                    <>
                      <button onClick={() => commitStageUpdate(job, 'On Site / In Progress', !job.is_paused)} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                        {job.is_paused ? "▶️ Resume Work" : "⏸️ Pause Work"}
                      </button>
                      <button onClick={() => handleStageClick(job, 'Job Complete')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                        ✅ Job Finished
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {filteredJobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No dispatched jobs found for {activeWorker} on this date selection.</p>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* ⚡ MAIN ROUTER & ROOT APP                                                  */
/* ========================================================================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loadingAuth) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Authenticating Argus...</div>;
  }

  const userEmail = session?.user?.email?.toLowerCase() || '';
  const activeWorker = userEmail.includes('edwin') ? 'Edwin' : 'Jason';

  return (
    <Router>
      <Routes>
        {/* PUBLIC ROUTE - Unrestricted access */}
        <Route path="/book" element={<PublicBooking />} />

        {/* PROTECTED APP ROUTES - Locked behind login */}
        <Route path="/*" element={
          !session ? (
            <Login />
          ) : (
            <Layout 
              onOpenLeadModal={() => setIsLeadModalOpen(true)}
              activeWorker={activeWorker}
              onLogout={handleLogout}
            >
              <NewLeadModal 
                isOpen={isLeadModalOpen} 
                onClose={() => setIsLeadModalOpen(false)} 
                onLeadCreated={() => setRefreshTrigger(prev => prev + 1)}
              />
              <Routes>
                <Route path="/" element={<Dashboard refreshTrigger={refreshTrigger} activeWorker={activeWorker} />} />
                <Route path="/jobs" element={<AllJobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/customers" element={<Customers activeWorker={activeWorker} />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                
                <Route 
                  path="/manager" 
                  element={
                    activeWorker === 'Edwin' ? <Navigate to="/" replace /> : <ManagerHub />
                  } 
                />

                <Route path="/sandbox" element={<DesignSandbox />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </Router>
  );
}
