import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PublicBooking() {
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
  
  const [tosConsent, setTosConsent] = useState(false);
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
        if (!waveRes.ok) console.warn(`Wave API Issue: ${waveRes.status}`);
      } catch (err) {
        console.warn(`Network Error hitting Wave API`);
      }

      // 🔔 ONE-SIGNAL TRIGGER (Targeting ALL for new leads)
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🚨 New Website Lead!',
            message: `${firstName} ${lastName} just requested a quote in ${city}.`,
            target: 'All'
          })
        });
      } catch (err) {
        console.warn(`Push notification failed`);
      }

      setStep(3);
    } catch (err) {
      console.error('Booking Error:', err);
      setError(err.message || 'Error submitting request. Please check Supabase permissions.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #3f3f46', background: '#27272a', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: '12px 16px', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '440px', color: '#ffffff', boxSizing: 'border-box', background: 'transparent', border: 'none', padding: '0' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <img src="/logo.png" alt="Iron Foot Co. Logo" style={{ height: 50, width: 'auto', background: '#ffffff', padding: '6px 12px', borderRadius: '6px', marginBottom: '12px' }} />
          <h1 style={{ margin: 0, fontSize: '24px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Iron Foot Co.</h1>
          <p style={{ color: '#a1a1aa', margin: '4px 0 0 0', fontSize: '13px' }}>Service Request & Scheduling</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleZipCheck} style={{ width: '100%', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', fontSize: '15px', marginBottom: '14px', color: '#eee' }}>Let&apos;s check if we operate in your area</h3>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#bbb' }}>Enter your Zip Code</label>
            <input type="text" required style={{ ...inputStyle, padding: '12px', marginBottom: '14px', fontSize: '15px' }} placeholder="e.g. 02066" value={zip} onChange={(e) => setZip(e.target.value)} />
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Verify Zip Code</button>
          </form>
        )}

        {step === -1 && (
          <div style={{ textAlign: 'center', width: '100%', margin: '0 auto' }}>
            <h3 style={{ fontSize: '16px', color: '#f97316', marginBottom: '8px' }}>Outside Service Area</h3>
            <p style={{ color: '#ccc', lineHeight: '1.5', fontSize: '13px', marginBottom: '16px' }}>{"Looks like you're outside our standard online booking area. Give us a call at "}<strong style={{ color: '#fff' }}>(781) 851-6777</strong>{" and we'll see how we can help!"}</p>
            <button onClick={() => setStep(1)} style={{ width: '100%', padding: '12px', background: '#27272a', color: '#fff', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Try Another Zip</button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}><input type="text" required style={inputStyle} placeholder="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div style={{ flex: 1 }}><input type="text" required style={inputStyle} placeholder="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}><input type="tel" required style={inputStyle} placeholder="Phone Number *" value={phone} onChange={handlePhoneChange} /></div>
              <div style={{ flex: 1 }}><input type="email" required style={inputStyle} placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}><input type="text" required style={inputStyle} placeholder="Street Address *" value={street} onChange={e => setStreet(e.target.value)} /></div>
              <div style={{ flex: 1 }}><input type="text" style={inputStyle} placeholder="Unit/Apt" value={unit} onChange={e => setUnit(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 2 }}><input type="text" required style={inputStyle} placeholder="City *" value={city} onChange={e => setCity(e.target.value)} /></div>
              <div style={{ flex: 1 }}><input type="text" disabled style={{ ...inputStyle, opacity: 0.7 }} value="MA" /></div>
            </div>
            <textarea required style={{ ...inputStyle, minHeight: '75px', resize: 'vertical' }} placeholder="Briefly describe what you need done..." value={projectNotes} onChange={e => setProjectNotes(e.target.value)} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', padding: '8px 10px', background: '#27272a', borderRadius: '6px', border: '1px solid #3f3f46' }}>
              <input type="checkbox" id="tos" required checked={tosConsent} onChange={(e) => setTosConsent(e.target.checked)} style={{ marginTop: '2px', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
              <label htmlFor="tos" style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: '1.35', cursor: 'pointer' }}>I agree to the Iron Foot Co.{' '}<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37', textDecoration: 'underline' }}>Terms of Service and Privacy Policy and SMS Terms.</a> *</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', padding: '8px 10px', background: '#27272a', borderRadius: '6px', border: '1px solid #3f3f46' }}>
              <input type="checkbox" id="sms" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} style={{ marginTop: '2px', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
              <label htmlFor="sms" style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.35', cursor: 'pointer' }}><strong>(Optional)</strong> By checking this box, I consent to receive text messages regarding my estimate, scheduling, and project updates. Consent is voluntary and not a condition of service. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out.</label>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '12px', textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Submitting...' : 'Request Estimate'}</button>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <h2 style={{ color: '#22c55e', fontSize: '18px', margin: '0 0 8px 0' }}>✓ Request Received</h2>
            <p style={{ color: '#ccc', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>{`Thank you, ${firstName}! We've received your information and will be in touch shortly to confirm details and scheduling.`}</p>
          </div>
        )}
      </div>
    </div>
  );
}
