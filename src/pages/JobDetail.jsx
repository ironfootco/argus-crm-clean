import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const GOOGLE_MAPS_API_KEY = "AIzaSyAzDxcRibWvd8rcIF11nK9MFU8-fARac1M";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('argus_user') || 'Jason';

  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [workerPhone, setWorkerPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [jobPhotos, setJobPhotos] = useState([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [selectedTag, setSelectedTag] = useState('Progress');
  const [galleryFilter, setGalleryFilter] = useState('All');

  const [showStudio, setShowStudio] = useState(false);
  const [studioStep, setStudioStep] = useState(0); 
  const [studioBefore, setStudioBefore] = useState(null);
  const [studioAfter, setStudioAfter] = useState(null);
  const [stitchedPreview, setStitchedPreview] = useState(null);
  const [savingStitch, setSavingStitch] = useState(false);

  const [headerView, setHeaderView] = useState('street');

  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editCustomerForm, setEditCustomerForm] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  const [editStreet, setEditStreet] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('MA');
  const [editZip, setEditZip] = useState('');

  useEffect(() => { fetchJobDetails(); }, [id]);

  const fetchJobDetails = async () => {
    setLoading(true);
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (!jobData) { alert("Error loading job details."); setLoading(false); return; }
    
    setJob(jobData);
    setEditForm(jobData);

    if (jobData.customer_id) {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', jobData.customer_id).single();
      if (custData) { setCustomer(custData); setEditCustomerForm(custData); }
    }

    const { data: teamData } = await supabase.from('team_members').select('phone').eq('name', currentUser).single();
    if (teamData && teamData.phone) setWorkerPhone(teamData.phone);

    const { data: photosData } = await supabase.from('job_photos').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (photosData) setJobPhotos(photosData);

    setLoading(false);
  };

  const sendSms = async (phone, message, optIn) => {
    if (!phone || optIn === false) return;
    const digits = phone.replace(/\D/g, '');
    const coreNumber = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
    if (coreNumber.length !== 10) return;
    const formattedTwilio = `+1${coreNumber}`;
    try {
      await fetch('/api/outbound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: formattedTwilio, body: message, sender_name: currentUser }) });
    } catch(e) { console.error("SMS Failed"); }
  };

  const commitStageUpdate = async (stage, isPaused = false) => {
    let updateData = { job_stage: stage, is_paused: isPaused };
    if (stage === 'On Site / In Progress' && !isPaused) { updateData.job_started_at = new Date().toISOString(); updateData.status = 'In Progress'; }
    
    if ((isPaused && stage === 'On Site / In Progress') || stage === 'Job Complete') {
      if (job.job_started_at) {
        const startTime = new Date(job.job_started_at); const endTime = new Date();
        let hoursWorked = parseFloat(((endTime - startTime) / (1000 * 60 * 60)).toFixed(2)); if (hoursWorked <= 0) hoursWorked = 0.02;
        updateData.time_logs = [...(job.time_logs || []), { worker_name: currentUser, hours: hoursWorked, rate: 40 }];
        updateData.job_started_at = null;
      }
    }
    if (stage === 'Job Complete') { updateData.status = 'Job Complete'; }
    
    await supabase.from('jobs').update(updateData).eq('id', job.id);
    fetchJobDetails();

    const phone = customer?.phone;
    const optIn = customer?.sms_opt_in ?? true;

    if (stage === 'En Route') {
      sendSms(phone, `Hi! This is ${currentUser} with Iron Foot Company. I'm en route to your property for our scheduled visit and will be arriving shortly. See you soon!`, optIn);
    } else if (stage === 'Job Complete') {
      sendSms(phone, `All done! Thank you for choosing Iron Foot Company today. We appreciate your business and will email the final invoice over shortly. Have a great rest of your day!`, optIn);
    }
  };

  const handleClaimJob = async () => {
    await supabase.from('jobs').update({ assigned_to: currentUser }).eq('id', id);
    fetchJobDetails();
  };

  const handleOpenEditModal = () => {
    setEditForm({ ...job });
    setEditCustomerForm(customer ? { ...customer } : null);
    if (customer?.address) {
      const parts = customer.address.split(',').map(p => p.trim());
      setEditStreet(parts[0] || ''); setEditCity(parts[1] || '');
      if (parts[2]) { const stateZip = parts[2].split(' ').filter(Boolean); setEditState(stateZip[0] || 'MA'); setEditZip(stateZip[1] || ''); }
    } else { setEditStreet(''); setEditCity(''); setEditState('MA'); setEditZip(''); }
    setEditingJob(true);
  };

  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);
    try {
      const fullAddress = [editStreet, editUnit, editCity, editState ? `${editState} ${editZip}`.trim() : editZip].filter(Boolean).join(', ');
      const { error: jobError } = await supabase.from('jobs').update({
          title: editForm.title || job.title, service_type: editForm.service_type || job.service_type || 'General Handyman Work', quoted_price: parseFloat(editForm.quoted_price) || 0,
          assigned_to: editForm.assigned_to || job.assigned_to || '', scheduled_date: editForm.scheduled_date || null, scheduled_time: editForm.scheduled_time || null,
          materials_needed: editForm.materials_needed || '', site_notes: editForm.site_notes || '', status: editForm.status || job.status, job_stage: editForm.status || job.job_stage
        }).eq('id', id);
      if (jobError) throw new Error("Job Update Failed: " + jobError.message);

      if (job.customer_id && editCustomerForm) {
        const { error: custError } = await supabase.from('customers').update({
            first_name: editCustomerForm.first_name || '', last_name: editCustomerForm.last_name || '', phone: editCustomerForm.phone || '',
            email: editCustomerForm.email || '', address: fullAddress, sms_opt_in: editCustomerForm.sms_opt_in ?? true
          }).eq('id', job.customer_id);
        if (custError) throw new Error("Customer Update Failed: " + custError.message);
      }
      fetchJobDetails(); setEditingJob(false);
    } catch (err) { alert("❌ Error saving edits: " + err.message); } finally { setSavingJob(false); }
  };

  const handleClickToCall = async (customerPhone) => {
    if (!customerPhone) return alert("No customer phone number saved.");
    if (!workerPhone) return alert(`We could not find a phone number for ${currentUser} in the team accounts.`);
    const cDigits = customerPhone.replace(/\D/g, ''); const cCore = (cDigits.length === 11 && cDigits.startsWith('1')) ? cDigits.slice(1) : cDigits; const formattedCustomerTwilio = cCore.length === 10 ? `+1${cCore}` : cCore;
    const wDigits = workerPhone.replace(/\D/g, ''); const wCore = (wDigits.length === 11 && wDigits.startsWith('1')) ? wDigits.slice(1) : wDigits; const formattedWorkerTwilio = wCore.length === 10 ? `+1${wCore}` : wCore;
    try {
      const res = await fetch('/api/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerNumber: formattedCustomerTwilio, workerNumber: formattedWorkerTwilio }) });
      if (!res.ok) throw new Error("Call failed to initiate");
      alert(`📞 Calling your cell (${formattedWorkerTwilio}) now!`);
    } catch (err) { alert("Error starting call: " + err.message); }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingGallery(true);
    let processed = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas'); let width = img.width, height = img.height;
          if (width > height) { if (width > 1200) { height *= 1200 / width; width = 1200; } } else { if (height > 1200) { width *= 1200 / height; height = 1200; } }
          canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const { error } = await supabase.from('job_photos').insert([{ job_id: id, photo_url: canvas.toDataURL('image/jpeg', 0.6), tag: selectedTag }]);
          processed++; if (processed === files.length) { fetchJobDetails(); setUploadingGallery(false); }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteGalleryPhoto = async (photoId) => { if (!window.confirm("Delete this photo?")) return; await supabase.from('job_photos').delete().eq('id', photoId); fetchJobDetails(); };
  
  const handleEditPhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, ''); let formatted = input;
    if (input.length > 0) { if (input.length <= 3) formatted = `(${input}`; else if (input.length <= 6) formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`; else formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`; }
    setEditCustomerForm({ ...editCustomerForm, phone: formatted });
  };
  
  const handleDeleteJob = async () => { if (!window.confirm("Delete this job permanently?")) return; await supabase.from('jobs').delete().eq('id', id); navigate('/'); };

  const processStitch = async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1080; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1080);
    const loadImg = (src) => new Promise(res => { const img = new Image(); img.src = src; img.onload = () => res(img); });
    const imgBefore = await loadImg(studioBefore.photo_url); const imgAfter = await loadImg(studioAfter.photo_url);
    const drawCover = (img, x, w) => {
      const targetRatio = w / 1080; const imgRatio = img.width / img.height; let sx, sy, sw, sh;
      if (imgRatio > targetRatio) { sh = img.height; sw = img.height * targetRatio; sx = (img.width - sw) / 2; sy = 0; } else { sw = img.width; sh = img.width / targetRatio; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, x, 0, w, 1080);
    };
    drawCover(imgBefore, 0, 540); drawCover(imgAfter, 540, 540);
    ctx.fillStyle = '#fff'; ctx.fillRect(538, 0, 4, 1080);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(20, 20, 160, 50); ctx.fillRect(560, 20, 160, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('BEFORE', 45, 55); ctx.fillText('AFTER', 595, 55);
    setStitchedPreview(canvas.toDataURL('image/jpeg', 0.8)); setStudioStep(2);
  };

  const handleSaveMarketingStitch = async () => {
    setSavingStitch(true); await supabase.from('job_photos').insert([{ job_id: id, photo_url: stitchedPreview, tag: 'Marketing' }]);
    setShowStudio(false); setStudioStep(0); setStudioBefore(null); setStudioAfter(null); setStitchedPreview(null); setSavingStitch(false); fetchJobDetails();
  };

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Job Details...</div>;
  if (!job) return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Job not found.</div>;

  const propertyAddress = customer?.address || job?.address;
  const streetViewUrl = propertyAddress ? `https://maps.googleapis.com/maps/api/streetview?size=850x320&scale=2&location=${encodeURIComponent(propertyAddress)}&fov=100&pitch=10&source=outdoor&key=${GOOGLE_MAPS_API_KEY}` : null;
  const satelliteUrl = propertyAddress ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(propertyAddress)}&zoom=19&size=850x320&scale=2&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}` : null;
  const activeHeaderImg = headerView === 'satellite' ? satelliteUrl : streetViewUrl;
  const filteredGallery = galleryFilter === 'All' ? jobPhotos : jobPhotos.filter(p => p.tag === galleryFilter);

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)', position: 'relative' }}>
      
      {/* HEADER NAV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>&larr; Back</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>Status: {job.status || 'Lead'}</span>
          <button onClick={handleOpenEditModal} style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>✏️ Edit</button>
        </div>
      </div>

      {/* DISPATCH & TRACKING ROW */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)' }}>⚡ Dispatch & Tracking</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assigned to: <strong style={{ color: (!job.assigned_to || job.assigned_to === 'Unassigned') ? 'var(--warning)' : 'var(--success)'}}>{job.assigned_to || 'Unassigned'}</strong></span>
          </div>

          {(!job.assigned_to || job.assigned_to === 'Unassigned') ? (
              <button onClick={handleClaimJob} style={{ width: '100%', minHeight: 48, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>🙋‍♂️ Claim & Assign to Me</button>
          ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(job.job_stage === 'Scheduled' || job.job_stage === 'Lead' || !job.job_stage) && <button onClick={() => commitStageUpdate('En Route')} style={{ flex: 1, minHeight: 48, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>🚗 On My Way</button>}
                {job.job_stage === 'En Route' && <button onClick={() => commitStageUpdate('On Site / In Progress')} style={{ flex: 1, minHeight: 48, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>📍 Arrived On Site</button>}
                {job.job_stage === 'On Site / In Progress' && (
                  <>
                    <button onClick={() => commitStageUpdate('On Site / In Progress', !job.is_paused)} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>{job.is_paused ? "▶️ Resume Work" : "⏸ Pause Work"}</button>
                    <button onClick={() => commitStageUpdate('Job Complete')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>✅ Job Finished</button>
                  </>
                )}
              </div>
          )}
      </div>

      {/* MAP HEADER */}
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {propertyAddress ? (
          <div style={{ marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border-color)', position: 'relative', height: 280, background: 'var(--bg-card)' }}>
            <img src={activeHeaderImg} alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#888; font-size:13px; font-weight:bold;">Map View Unavailable</div>'; }} />
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, background: 'rgba(0,0,0,0.75)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setHeaderView('street')} style={{ background: headerView === 'street' ? 'var(--primary)' : 'transparent', color: headerView === 'street' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>🏠 Street</button>
              <button onClick={() => setHeaderView('satellite')} style={{ background: headerView === 'satellite' ? 'var(--primary)' : 'transparent', color: headerView === 'satellite' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>🛰 Sat</button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 18, borderRadius: 10, padding: 14, border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>⚠ No address linked to this job yet.</div>
        )}
      </div>

      {/* JOB SUMMARY CARD */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: '100%' }}>
            <h2 style={{ margin: '0 0 8px 0', color: 'var(--primary)', fontSize: 22 }}>🛠️ {job.title}</h2>
            {customer && (
              <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--text-main)', marginBottom: 12 }}>
                👤 {customer.first_name} {customer.last_name} 
                {customer.phone ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                    • 📞 {customer.phone}
                    <button onClick={() => handleClickToCall(customer.phone)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>Call</button>
                  </span>
                ) : ''}
                {customer.email ? ` • ✉️ ${customer.email}` : ''}
                <div style={{ marginTop: 6, fontSize: 13, color: customer.sms_opt_in ? 'var(--success)' : 'var(--text-muted)' }}>{customer.sms_opt_in ? '✅ SMS Opt-In: Yes' : '🔕 SMS Opt-In: No'}</div>
              </div>
            )}
            
            {job.materials_needed && (
              <div style={{ fontSize: 13, color: 'var(--text-accent)', marginBottom: 12, fontWeight: 'bold', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>📦 Tools & Materials: {job.materials_needed}</div>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--success)', marginLeft: 16 }}>${job.quoted_price?.toLocaleString() || '0'}</div>
        </div>

        {job.site_notes && (
          <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14, lineHeight: '1.6', whiteSpace: 'pre-wrap', marginTop: 10 }}>
            <strong style={{ color: 'var(--text-accent)', display: 'block', marginBottom: 6 }}>📋 Site & Project Notes:</strong>{job.site_notes}
          </div>
        )}
      </div>

      {/* INFINITE GALLERY */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div><h3 style={{ margin: '0 0 4px 0', fontSize: 18, color: 'var(--text-main)' }}>📸 Job Photo Gallery</h3><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tag unlimited task photos. Build social posts.</span></div>
          <button onClick={() => setShowStudio(true)} style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>🎨 Open Social Studio</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, background: 'var(--bg-input)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: 13, fontWeight: 'bold' }}>
            <option value="Before">Before</option><option value="Progress">Progress</option><option value="After">After</option><option value="Issue">Issue/Damage</option>
          </select>
          <label style={{ background: 'var(--primary)', color: 'var(--primary-text)', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer', flex: 1, textAlign: 'center' }}>
            {uploadingGallery ? "Uploading..." : `➕ Upload as "${selectedTag}"`}
            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploadingGallery} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {['All', 'Before', 'Progress', 'After', 'Issue', 'Marketing'].map(tag => (
            <button key={tag} onClick={() => setGalleryFilter(tag)} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', border: '1px solid var(--border-color)', background: galleryFilter === tag ? 'var(--primary)' : 'var(--bg-input)', color: galleryFilter === tag ? 'var(--primary-text)' : 'var(--text-muted)' }}>{tag}</button>
          ))}
        </div>

        {filteredGallery.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {filteredGallery.map((photo) => (
              <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
                <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>{photo.tag}</span>
                <img src={photo.photo_url} alt={photo.tag} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', opacity: 0.9 }} />
                <button onClick={() => handleDeleteGalleryPhoto(photo.id)} style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold', zIndex: 2 }}>Delete</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>No photos found for {galleryFilter}. Select a tag and start uploading!</div>
        )}
      </div>

      {/* TIME LOGS */}
      {job.time_logs && job.time_logs.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: 'var(--text-accent)' }}>⏱️ Tracked Time Logs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {job.time_logs.map((log, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>👤 {log.worker_name}</span>
                      <strong style={{ color: 'var(--text-main)' }}>{log.hours} hrs</strong>
                  </div>
              ))}
          </div>
        </div>
      )}

      {/* SOCIAL MEDIA STUDIO MODAL */}
      {showStudio && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', zIndex: 9999, overflowY: 'auto' }}>
          <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
            <h2 style={{ margin: 0, color: 'var(--primary)' }}>🎨 Social Media Studio</h2><button onClick={() => { setShowStudio(false); setStudioStep(0); setStudioBefore(null); setStudioAfter(null); setStitchedPreview(null); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, padding: 20, maxWidth: 800, margin: '0 auto', width: '100%' }}>
            {studioStep < 2 && (
              <>
                <h3 style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>{studioStep === 0 ? "Step 1: Select a BEFORE photo" : "Step 2: Select an AFTER photo"}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {jobPhotos.map(photo => (
                    <div key={photo.id} onClick={() => { if (studioStep === 0) { setStudioBefore(photo); setStudioStep(1); } else { setStudioAfter(photo); processStitch(); } }} style={{ cursor: 'pointer', border: '3px solid transparent', borderRadius: 8, overflow: 'hidden' }}>
                      <img src={photo.photo_url} alt={photo.tag} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {studioStep === 2 && stitchedPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <h3 style={{ color: '#fff', margin: 0 }}>Review Your Post</h3><img src={stitchedPreview} alt="Stitched Preview" style={{ width: '100%', maxWidth: 500, borderRadius: 10, border: '4px solid #333' }} />
                <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 500 }}>
                  <button onClick={() => { setStudioStep(0); setStudioBefore(null); setStudioAfter(null); }} style={{ flex: 1, padding: 14, background: '#333', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Restart</button>
                  <button onClick={handleSaveMarketingStitch} disabled={savingStitch} style={{ flex: 2, padding: 14, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>{savingStitch ? "Saving to Vault..." : "💾 Save to Marketing Vault"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {editingJob && editForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>✏ Edit Job Details</h3>
              <button onClick={() => setEditingJob(false)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB TITLE</label><input value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>QUOTED PRICE ($)</label><input type="number" value={editForm.quoted_price ?? ''} onChange={e => setEditForm({ ...editForm, quoted_price: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS</label><select value={editForm.status || 'Lead'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}><option value="Lead">Lead</option><option value="Scheduled">Scheduled</option><option value="En Route">En Route</option><option value="In Progress">In Progress</option><option value="Job Complete">Job Complete</option><option value="Invoiced">Invoiced</option><option value="Paid">Paid</option></select></div>
              </div>

              {editCustomerForm && (
                <>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-accent)', fontWeight: 'bold', display: 'block', marginBottom: 6 }}>CUSTOMER INFO</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}><input placeholder="First Name" value={editCustomerForm.first_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, first_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /><input placeholder="Last Name" value={editCustomerForm.last_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, last_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input placeholder="Phone" value={editCustomerForm.phone || ''} onChange={handleEditPhoneChange} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /><input placeholder="Email" value={editCustomerForm.email || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>PROPERTY ADDRESS</label>
                    <input placeholder="Street Address" value={editStreet} onChange={e => setEditStreet(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', marginBottom: 8 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                      <input placeholder="City" value={editCity} onChange={e => setEditCity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                      <input placeholder="State" value={editState} onChange={e => setEditState(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                      <input placeholder="Zip" value={editZip} onChange={e => setEditZip(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </>
              )}

              <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>MATERIALS / TOOLS NEEDED</label><input value={editForm.materials_needed || ''} onChange={e => setEditForm({ ...editForm, materials_needed: e.target.value })} placeholder="e.g. 2x4 lumber" style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE & PROJECT NOTES</label><textarea rows="3" value={editForm.site_notes || ''} onChange={e => setEditForm({ ...editForm, site_notes: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} /></div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingJob(false)} style={{ flex: 1, padding: 10, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={savingJob} style={{ flex: 1.5, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>{savingJob ? 'Saving...' : '💾 Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
        <button onClick={handleDeleteJob} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}>🗑️ Delete Job Card</button>
      </div>
    </div>
  );
}
