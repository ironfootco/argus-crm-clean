import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PublicBooking() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
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

  // Define your active service area zip codes here
  const allowedZips = ['02066', '02151', '02152', '01906', '01901', '02128']; 

  const handleZipCheck = (e) => {
    e.preventDefault();
    if (allowedZips.includes(zip.trim())) {
      setStep(2);
    } else {
      setStep(-1); // Rejected Step
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Check if customer exists or create new
      let customerId;
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const fullAddress = [street, unit, city, 'MA', zip].filter(Boolean).join(', ');
        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert([{
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            address: fullAddress
          }])
          .select()
          .single();
        
        if (custError) throw custError;
        customerId = newCust.id;
      }

      // 2. Create the Job Ticket as a New Lead
      const { error: jobError } = await supabase
        .from('jobs')
        .insert([{
          customer_id: customerId,
          title: `${firstName} ${lastName} - Website Lead`,
          status: 'New Lead',
          job_stage: 'New Lead',
          assigned_to: 'Unassigned',
          site_notes: `Project Details: ${projectNotes}\n\nSMS Opt-In: ${smsConsent ? 'Yes' : 'No'}`,
        }]);

      if (jobError) throw jobError;

      setStep(3); // Success Step
    } catch (err) {
      setError('Something went wrong submitting your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212', // Iron Foot Dark Background
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const cardStyle = {
    background: '#1e1e1e',
    padding: '40px',
    borderRadius: '12px',
    border: '2px solid #d4af37', // Iron Foot Gold/Accent
    maxWidth: '500px',
    width: '100%',
    color: '#ffffff',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#2c2c2c',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '14px',
    background: '#d4af37', // Iron Foot Gold
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Iron Foot Co.
          </h1>
          <p style={{ color: '#aaa', margin: '8px 0 0 0' }}>Service Request & Booking</p>
        </div>

        {/* STEP 1: ZIP CODE CHECK */}
        {step === 1 && (
          <form onSubmit={handleZipCheck}>
            <h3 style={{ textAlign: 'center' }}>Let's check if we operate in your area</h3>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>Enter your Zip Code</label>
            <input 
              type="text" 
              required 
              style={inputStyle} 
              placeholder="e.g. 02066" 
              value={zip} 
              onChange={(e) => setZip(e.target.value)} 
            />
            <button type="submit" style={buttonStyle}>Verify Zip Code</button>
          </form>
        )}

        {/* STEP -1: REJECTED ZIP CODE */}
        {step === -1 && (
          <div style={{ textAlign: 'center' }}>
            <h3>Outside Service Area</h3>
            <p style={{ color: '#ccc', lineHeight: '1.5' }}>
              Looks like you're outside our standard online booking area. Give us a call at <strong>(781) 851-6777</strong> and we'll see how we can help!
            </p>
            <button onClick={() => setStep(1)} style={{...buttonStyle, background: '#444', color: '#fff'}}>Try Another Zip</button>
          </div>
        )}

        {/* STEP 2: DETAILS FORM */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <input type="text" required style={inputStyle} placeholder="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" required style={inputStyle} placeholder="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <input type="tel" required style={inputStyle} placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} />
            <input type="email" required style={inputStyle} placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)} />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <input type="text" required style={inputStyle} placeholder="Street Address *" value={street} onChange={e => setStreet(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" style={inputStyle} placeholder="Unit/Apt" value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <input type="text" required style={inputStyle} placeholder="City *" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" disabled style={{...inputStyle, opacity: 0.7}} value="MA" />
              </div>
            </div>

            <textarea required style={{...inputStyle, minHeight: '80px'}} placeholder="Briefly describe what you need done..." value={projectNotes} onChange={e => setProjectNotes(e.target.value)} />

            {/* TWILIO COMPLIANCE CHECKBOX */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', padding: '10px', background: '#222', borderRadius: '6px', border: '1px solid #333' }}>
              <input 
                type="checkbox" 
                id="sms"
                required
                checked={smsConsent} 
                onChange={(e) => setSmsConsent(e.target.checked)} 
                style={{ marginTop: '4px', width: '18px', height: '18px' }}
              />
              <label htmlFor="sms" style={{ fontSize: '12px', color: '#aaa', lineHeight: '1.4' }}>
                By checking this box, I consent to receive text messages from Iron Foot Company LLC regarding my estimate and scheduling. Message and data rates may apply. Reply STOP to opt out. I consent to the Terms of Service and Privacy Policy.
              </label>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? 'Submitting...' : 'Request Estimate'}
            </button>
            <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: '#888', width: '100%', marginTop: '15px', cursor: 'pointer' }}>
              &larr; Back
            </button>
          </form>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#22c55e' }}>✓ Request Received</h2>
            <p style={{ color: '#ccc', lineHeight: '1.6' }}>
              Thank you, {firstName}! We've received your information and will be in touch shortly to confirm details and scheduling.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
