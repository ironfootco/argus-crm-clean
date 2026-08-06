import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
import ManagerHub from './pages/ManagerHub';
import DesignSandbox from './pages/DesignSandbox';

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
  const [serviceType, setServiceType] = useState('Sealcoating');
  const [customService, setCustomService] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

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
      return;
    }
    const cust = customers.find(c => c.id === id);
    if (cust) {
      setFirstName(cust.first_name || '');
      setLastName(cust.last_name || '');
      setPhone(cust.phone || '');
      setEmail(cust.email || '');
      setAddress(cust.address || '');
    }
  };

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not natively supported in this browser. Please tap the microphone key on your phone's keyboard!");
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
          address: fullAddress
        }])
        .select()
        .single();

      if (custErr) {
        alert("Error saving customer: " + custErr.message);
        setLoading(false);
        return;
      }
      if (newCust) customerId = newCust.id;
    }

    const activeService = serviceType === 'Custom' ? customService || 'General Work' : serviceType;
    const clientName = `${firstName} ${lastName}`.trim() || 'Client';
    const autoTitle = `${clientName} - ${activeService}`;

    const { data: newJob, error: jobErr } = await supabase
      .from('jobs')
      .insert([{
        title: autoTitle,
        customer_id: customerId,
        service_type: activeService,
        status: 'Lead',
        assigned_to: 'Unassigned',
        quoted_price: parseFloat(quotedPrice) || 0,
        site_notes: siteNotes,
        photo_urls: photos
      }])
      .select()
      .single();

    if (jobErr) {
      alert("Error saving job lead: " + jobErr.message);
      setLoading(false);
      return;
    }

    try {
      await fetch('/api/waveSync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: autoTitle,
          quotedPrice: parseFloat(quotedPrice) || 0,
          notes: siteNotes
        })
      });
    } catch (err) {
      console.warn("Wave draft sync bypassed:", err);
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
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 15 }}>
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 20, color: 'var(--text-main)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottom: '1.5px solid var(--border-color)', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>📌 Quick New Lead / Sticky Note</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SELECT EXISTING CUSTOMER</label>
            <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }}>
              <option value="">-- Or Create New Customer Below --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.phone || 'No phone'})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
            <input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
            <input placeholder="Phone" value={phone} onChange={handlePhoneChange} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!selectedCustomerId} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />

            {selectedCustomerId ? (
              <input placeholder="Property Address" value={address} disabled style={{ gridColumn: 'span 2', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
            ) : (
              <>
                <input placeholder="Street Address" value={street} onChange={e => setStreet(e.target.value)} style={{ gridColumn: 'span 2', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                  <input placeholder="Town / City" value={city} onChange={e => setCity(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                  <input placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                  <input placeholder="Zipcode" value={zip} onChange={e => setZip(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SERVICE TYPE</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                <option value="Sealcoating">Sealcoating</option>
                <option value="Crack Filling">Crack Filling</option>
                <option value="Line Striping">Line Striping</option>
                <option value="Paving & Patching">Paving & Patching</option>
                <option value="Custom">Custom Service...</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>EST. QUOTE PRICE ($)</label>
              <input type="number" placeholder="Optional ($)" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
            </div>
          </div>

          {serviceType === 'Custom' && (
            <input placeholder="Enter Custom Service Name" value={customService} onChange={e => setCustomService(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }} />
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE NOTES / MEMO (Pushes to Wave Draft)</label>
              <button type="button" onClick={startDictation} style={{ background: isListening ? '#ef4444' : 'var(--primary)', color: isListening ? '#fff' : 'var(--primary-text)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                {isListening ? "🔴 Listening..." : "🎤 Voice Dictate"}
              </button>
            </div>
            <textarea rows="3" placeholder="Speak or type scope details, square footage, driveway condition..." value={siteNotes} onChange={e => setSiteNotes(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>📷 SITE PHOTOS</label>
            <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoCapture} style={{ fontSize: 13, color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt="site preview" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  <button type="button" onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ marginTop: 10, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
            {loading ? "Saving Lead & Syncing Draft..." : "📌 Save Sticky Note Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Layout({ children, onOpenLeadModal }) {
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
          min-height: 100vh;
        }

        input::placeholder, textarea::placeholder {
          color: var(--text-muted);
          opacity: 0.8;
        }

        button, input, select, textarea {
          font-family: inherit;
        }
      `}</style>

      <div style={{ maxWidth: 850, margin: '0 auto', padding: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: '2px solid var(--border-color)', paddingBottom: 15, flexWrap: 'wrap', gap: 10 }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Argus CRM</h2>
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <button onClick={() => navigate('/manager')} style={{ background: location.pathname === '/manager' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/manager' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              💼 Manager
            </button>
            <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              {theme === 'dark' ? '☀️ Sunlight' : '⚡ High-Vis'}
            </button>
          </div>
        </header>

        {children}
      </div>
    </>
  );
}

function Dashboard({ refreshTrigger }) {
  const [jobs, setJobs] = useState([]);
  const [activeWorker, setActiveWorker] = useState('Jason');
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveJobs();
    checkShiftStatus();
  }, [activeWorker, refreshTrigger]);

  // Fetches jobs ordered chronologically by scheduled date and scheduled start time
  const fetchActiveJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Job Complete')
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (data) setJobs(data);
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

  const updateJobStage = async (job, stage, isPaused = false) => {
    let updateData = { job_stage: stage, is_paused: isPaused };

    if (stage === 'On Site / In Progress' && !isPaused) {
      updateData.job_started_at = new Date().toISOString();
    }

    if ((isPaused && stage === 'On Site / In Progress') || stage === 'Job Complete') {
      if (job.job_started_at) {
        const startTime = new Date(job.job_started_at);
        const endTime = new Date();
        let hoursWorked = parseFloat(((endTime - startTime) / (1000 * 60 * 60)).toFixed(2));
        if (hoursWorked <= 0) hoursWorked = 0.02;

        const newLog = { worker_name: activeWorker, hours: hoursWorked };
        const currentLogs = job.time_logs || [];
        
        updateData.time_logs = [...currentLogs, newLog];
        updateData.job_started_at = null;
      }
    }

    if (stage === 'Job Complete') {
      updateData.status = 'Job Complete';
    }

    await supabase.from('jobs').update(updateData).eq('id', job.id);
    fetchActiveJobs();
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 4 }}>PAYROLL SHIFT CLOCK</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={activeWorker} onChange={e => setActiveWorker(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: 'bold' }}>
              <option value="Jason">👤 Jason</option>
              <option value="Edwin">👤 Edwin</option>
            </select>
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
          {loadingShift ? "Saving..." : activeShift ? "🛑 Clock Out Shift" : "🟢 Clock In Shift"}
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-accent)', fontSize: 15 }}>🚛 Today's Truck & Material Loadout</h4>
        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
          {jobs.map(j => j.materials_needed).filter(Boolean).join(' • ') || "No materials specified on active jobs. Add material lists in job details."}
        </div>
      </div>

      <h3 style={{ color: 'var(--text-main)', marginBottom: 15 }}>⚡ Active Field Schedule ({jobs.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {jobs.map(job => {
          const stage = job.job_stage || 'Scheduled';
          const isUnassigned = job.assigned_to === 'Unassigned' || !job.assigned_to;
          return (
            <div key={job.id} style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, border: '2px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.id}`)}>
                <div>
                  <strong style={{ fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Assigned: <span style={{ color: isUnassigned ? 'var(--warning)' : 'var(--text-accent)', fontWeight: 'bold' }}>{isUnassigned ? '⚠️ Unassigned' : job.assigned_to}</span>
                    {job.scheduled_time && (
                      <span style={{ marginLeft: 10, color: 'var(--text-main)', fontWeight: 'bold' }}>
                        ⏰ {formatTime(job.scheduled_time)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block' }}>
                    Stage: {stage} {job.is_paused ? '(Paused)' : ''}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {stage === 'Scheduled' || stage === 'Lead' ? (
                  <button onClick={() => updateJobStage(job, 'En Route')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                    🚗 On My Way
                  </button>
                ) : null}

                {stage === 'En Route' ? (
                  <button onClick={() => updateJobStage(job, 'On Site / In Progress')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                    📍 Arrived On Site
                  </button>
                ) : null}

                {stage === 'On Site / In Progress' ? (
                  <>
                    <button onClick={() => updateJobStage(job, 'On Site / In Progress', !job.is_paused)} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      {job.is_paused ? "▶️ Resume Work" : "⏸️ Pause Work"}
                    </button>
                    <button onClick={() => updateJobStage(job, 'Job Complete')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      ✅ Job Finished
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active field jobs on schedule.</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLeadCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Router>
      <Layout onOpenLeadModal={() => setIsLeadModalOpen(true)}>
        <NewLeadModal 
          isOpen={isLeadModalOpen} 
          onClose={() => setIsLeadModalOpen(false)} 
          onLeadCreated={handleLeadCreated}
        />
        <Routes>
          <Route path="/" element={<Dashboard refreshTrigger={refreshTrigger} />} />
          <Route path="/jobs" element={<AllJobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/manager" element={<ManagerHub />} />
          <Route path="/sandbox" element={<DesignSandbox />} />
        </Routes>
      </Layout>
    </Router>
  );
}
