import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { processAndUploadMarketingGraphic } from '../utils/driveUpload';

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

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dispatch Toast State
  const [dispatchAlert, setDispatchAlert] = useState('');

  // Live Tech Notepad State
  const [siteNotes, setSiteNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAlert, setNotesSavedAlert] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Modal State
  const [photoModalType, setPhotoModalType] = useState(null);

  useEffect(() => {
    fetchJobDetail();
    fetchTeamMembers();
  }, [id]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from('team_members').select('*').order('name');
    if (data) setTeamMembers(data);
  };

  const fetchJobDetail = async () => {
    setLoading(true);
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (jobData) {
      setJob(jobData);
      setSiteNotes(jobData.site_notes || '');
      if (jobData.customer_id) {
        const { data: custData } = await supabase.from('customers').select('*').eq('id', jobData.customer_id).single();
        if (custData) setCustomer(custData);
      }
    }
    setLoading(false);
  };

  const handleCrewChange = async (newCrew) => {
    setJob(prev => ({ ...prev, assigned_to: newCrew }));
    await supabase.from('jobs').update({ assigned_to: newCrew }).eq('id', id);

    if (newCrew && newCrew !== 'Unassigned') {
      setDispatchAlert(`📲 Dispatching job to ${newCrew}...`);

      try {
        await fetch('/api/notifyDispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerName: newCrew,
            jobTitle: job.title,
            jobAddress: customer?.address || job.address || '',
            scheduledDate: job.scheduled_date,
            scheduledTime: job.scheduled_time
          })
        });
        setDispatchAlert(`✅ Dispatched to ${newCrew}! Notification sent.`);
      } catch (err) {
        console.warn('Dispatch notification bypass:', err);
        setDispatchAlert(`✅ Assigned to ${newCrew}`);
      }

      setTimeout(() => setDispatchAlert(''), 4000);
    }
  };

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not natively supported in this browser. Please tap the microphone key on your keyboard!");
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
      setSiteNotes(prev => (prev ? `${prev}\n${transcript}` : transcript));
    };

    recognition.start();
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);

    // 1. Save to Supabase CRM first
    const { error } = await supabase
      .from('jobs')
      .update({ site_notes: siteNotes })
      .eq('id', id);

    if (error) {
      alert("Error saving notes: " + error.message);
      setSavingNotes(false);
      return;
    }

    setJob(prev => ({ ...prev, site_notes: siteNotes }));

    // 2. Multi-tier resolution for Customer Name & Email
    let resolvedName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : "";
    if (!resolvedName && job.customer_name) resolvedName = job.customer_name;
    if (!resolvedName && job.client_name) resolvedName = job.client_name;
    if (!resolvedName && job.title && job.title.includes(' - ')) {
      resolvedName = job.title.split(' - ')[0].trim();
    }

    let resolvedEmail = customer?.email || job.customer_email || job.email || "";

    // 3. Sync to Wave Draft Estimate
    try {
      const waveRes = await fetch('/api/waveSync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          notes: siteNotes,
          customerName: resolvedName,
          customerEmail: resolvedEmail,
          quotedPrice: job.quoted_price || 0
        })
      });
      
      const waveData = await waveRes.json();
      
      if (!waveData.success) {
        alert("Wave Sync Failed: " + (waveData.error || "Unknown Error"));
        setSavingNotes(false);
        return;
      }
    } catch (err) {
      alert("Network Error hitting Wave API: " + err.message);
      setSavingNotes(false);
      return;
    }

    setSavingNotes(false);
    setNotesSavedAlert(true);
    setTimeout(() => setNotesSavedAlert(false), 3000);
  };

  const handlePhotoUpload = (e, targetField) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
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
        const updatePayload = { [targetField]: compressedBase64 };

        await supabase.from('jobs').update(updatePayload).eq('id', id);
        setJob(prev => ({ ...prev, ...updatePayload }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleStageClick = (targetStage) => {
    if (targetStage === 'On Site / In Progress' && !job.before_photo_url) {
      setPhotoModalType('before');
      return;
    }

    if (targetStage === 'Job Complete' && !job.after_photo_url) {
      setPhotoModalType('after');
      return;
    }

    commitStageUpdate(targetStage);
  };

  const handlePhotoSaved = async (photoBase64) => {
    const isBefore = photoModalType === 'before';
    const updateField = isBefore ? { before_photo_url: photoBase64 } : { after_photo_url: photoBase64 };

    await supabase.from('jobs').update(updateField).eq('id', id);

    const nextStage = isBefore ? 'On Site / In Progress' : 'Job Complete';
    const updatedJob = { ...job, ...updateField };
    
    setPhotoModalType(null);
    commitStageUpdate(nextStage, false, updatedJob);
  };

  const handlePhotoSkipped = () => {
    const nextStage = photoModalType === 'before' ? 'On Site / In Progress' : 'Job Complete';
    setPhotoModalType(null);
    commitStageUpdate(nextStage);
  };

  const commitStageUpdate = async (newStage, isPaused = false, overrideJobData = null) => {
    setSaving(true);
    let activeJob = overrideJobData || job;
    let updateData = { job_stage: newStage, is_paused: isPaused };

    if (newStage === 'On Site / In Progress' && !isPaused) {
      updateData.job_started_at = new Date().toISOString();
      updateData.status = 'In Progress';
    }

    if (newStage === 'Job Complete') {
      updateData.status = 'Job Complete';
      const finalJob = { ...activeJob, ...updateData };
      await processAndUploadMarketingGraphic(finalJob);
    }

    await supabase.from('jobs').update(updateData).eq('id', id);
    await fetchJobDetail();
    setSaving(false);
  };

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Loading full job specs...</div>;
  if (!job) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Job not found.</div>;

  const fullAddress = customer?.address || job.address || '';
  const googleMapsApiKey = "AIzaSyAzDxcRibWvd8rcIF11nK9MFU8-fARac1M";
  
  const streetViewUrl = fullAddress 
    ? `https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=${encodeURIComponent(fullAddress)}&fov=90&key=${googleMapsApiKey}`
    : null;

  const stage = job.job_stage || job.status || 'Scheduled';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PhotoModal 
        isOpen={!!photoModalType} 
        type={photoModalType} 
        jobTitle={job.title} 
        onClose={() => setPhotoModalType(null)} 
        onSave={handlePhotoSaved} 
        onSkip={handlePhotoSkipped} 
      />

      {/* Navigation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
          ← Back to Overview
        </button>
        <span style={{ fontSize: 12, padding: '6px 14px', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1.5px solid var(--border-color)' }}>
          Stage: {stage} {job.is_paused ? '(Paused)' : ''}
        </span>
      </div>

      {/* Dispatch Toast Alert Banner */}
      {dispatchAlert && (
        <div style={{ padding: '12px 16px', background: 'var(--primary)', color: 'var(--primary-text)', borderRadius: 8, fontWeight: 'bold', fontSize: 14, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {dispatchAlert}
        </div>
      )}

      {/* Expanded Google Street View Header Card */}
      {fullAddress && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '2px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 280, width: '100%', background: '#000' }}>
            <img 
              src={streetViewUrl} 
              alt="Street View" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)', padding: '12px 16px', borderRadius: 8, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold' }}>📍 {fullAddress}</div>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`} 
                target="_blank" 
                rel="noreferrer"
                style={{ background: 'var(--primary)', color: 'var(--primary-text)', padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap' }}
              >
                🗺️ Open Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Job Overview Card */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 22, color: 'var(--text-main)' }}>🛠️ {job.title}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-accent)', fontWeight: 'bold' }}>
              Service Type: {job.service_type || 'General Handyman'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--success)' }}>
              ${job.quoted_price?.toLocaleString() || 0}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quoted Estimate</div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', opacity: 0.4, margin: '16px 0' }} />

        {/* Customer Contact Details */}
        {customer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>CUSTOMER</label>
              <div style={{ fontSize: 15, fontWeight: 'bold', marginTop: 2 }}>👤 {customer.first_name} {customer.last_name}</div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>PHONE</label>
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold', fontSize: 15, display: 'inline-block', marginTop: 2 }}>
                  📞 {customer.phone}
                </a>
              ) : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No Phone</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>EMAIL</label>
              {customer.email ? (
                <a href={`mailto:${customer.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginTop: 2 }}>
                  ✉️ {customer.email}
                </a>
              ) : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No Email</span>}
            </div>
          </div>
        )}

        {/* Dispatch Spec Info with Editable Crew Dropdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, background: 'var(--bg-input)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>ASSIGNED CREW</label>
            <select 
              value={job.assigned_to || 'Unassigned'} 
              onChange={(e) => handleCrewChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-accent)',
                fontWeight: 'bold',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <option value="Unassigned">⚠️ Unassigned</option>
              <option value="Jason">👤 Jason</option>
              <option value="Edwin">👤 Edwin</option>
              <option value="Both (Jason & Edwin)">👥 Both (Jason & Edwin)</option>
              {teamMembers.map(m => (
                m.name !== 'Jason' && m.name !== 'Edwin' && (
                  <option key={m.id} value={m.name}>👤 {m.name}</option>
                )
              ))}
            </select>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>SCHEDULED DATE</span>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>{job.scheduled_date || 'Unscheduled'}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>SCHEDULED TIME</span>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>{job.scheduled_time || 'Flex / Morning'}</span>
          </div>
        </div>
      </div>

      {/* Interactive On-Scene Tech Notepad & Materials Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: 15 }}>📝 Tech Notepad & Wave Estimate Memo</h4>
            <button 
              type="button" 
              onClick={startDictation} 
              style={{ background: isListening ? '#ef4444' : 'var(--primary)', color: isListening ? '#fff' : 'var(--primary-text)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            >
              {isListening ? "🔴 Listening..." : "🎤 Dictate"}
            </button>
          </div>

          <textarea
            rows="5"
            placeholder="Add or update site notes here to push into Wave estimate memo..."
            value={siteNotes}
            onChange={(e) => setSiteNotes(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 6,
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.5,
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            {notesSavedAlert ? (
              <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 'bold' }}>
                ✅ Saved & Synced to Wave Draft Estimate!
              </span>
            ) : <span />}

            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              style={{
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 6,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              {savingNotes ? "Saving & Syncing..." : "💾 Save & Draft Wave Estimate"}
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)', fontSize: 15 }}>📦 Required Materials & Tools</h4>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
            {job.materials_needed || "No specific materials or tools logged."}
          </p>
        </div>
      </div>

      {/* Proof-of-Work Interactive Photo Section */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-accent)', fontSize: 16 }}>📸 Proof of Work Marketing Photos</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          
          {/* Before Photo Box */}
          <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>BEFORE PHOTO</span>
              <span>{job.before_photo_url ? '✅ Attached' : '⚠️ Missing'}</span>
            </div>
            {job.before_photo_url ? (
              <div style={{ position: 'relative' }}>
                <img src={job.before_photo_url} alt="Before" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6 }} />
                <label style={{ display: 'block', textAlign: 'center', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: 6, borderRadius: '0 0 6px 6px', marginTop: -26, position: 'relative', cursor: 'pointer', fontWeight: 'bold' }}>
                  🔄 Replace Before Photo
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'before_photo_url')} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, border: '2px dashed var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold', fontSize: 13, gap: 6 }}>
                <span>📸 Snap / Upload Before Photo</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'before_photo_url')} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* After Photo Box */}
          <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>AFTER PHOTO</span>
              <span>{job.after_photo_url ? '✅ Attached' : '⚠️ Missing'}</span>
            </div>
            {job.after_photo_url ? (
              <div style={{ position: 'relative' }}>
                <img src={job.after_photo_url} alt="After" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6 }} />
                <label style={{ display: 'block', textAlign: 'center', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: 6, borderRadius: '0 0 6px 6px', marginTop: -26, position: 'relative', cursor: 'pointer', fontWeight: 'bold' }}>
                  🔄 Replace After Photo
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'after_photo_url')} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, border: '2px dashed var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold', fontSize: 13, gap: 6 }}>
                <span>📷 Snap / Upload After Photo</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'after_photo_url')} style={{ display: 'none' }} />
              </label>
            )}
          </div>

        </div>
      </div>

      {/* Sequential Dynamic Workflow Buttons */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {stage === 'Scheduled' || stage === 'Lead' ? (
          <button 
            disabled={saving} 
            onClick={() => handleStageClick('En Route')} 
            style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
          >
            🚗 On My Way
          </button>
        ) : null}

        {stage === 'En Route' ? (
          <button 
            disabled={saving} 
            onClick={() => handleStageClick('On Site / In Progress')} 
            style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
          >
            📍 Arrived On Site
          </button>
        ) : null}

        {stage === 'On Site / In Progress' ? (
          <>
            <button 
              disabled={saving} 
              onClick={() => commitStageUpdate('On Site / In Progress', !job.is_paused)} 
              style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
            >
              {job.is_paused ? "▶️ Resume Work" : "⏸️ Pause Work"}
            </button>
            <button 
              disabled={saving} 
              onClick={() => handleStageClick('Job Complete')} 
              style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
            >
              {saving ? "Syncing Drive..." : "✅ Job Finished"}
            </button>
          </>
        ) : null}

        {stage === 'Job Complete' && (
          <div style={{ width: '100%', textAlign: 'center', padding: 12, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--success)', borderRadius: 6, color: 'var(--success)', fontWeight: 'bold', fontSize: 15 }}>
            🎉 Job Complete & Stitched Photo Synced to Drive!
          </div>
        )}
      </div>
    </div>
  );
}
