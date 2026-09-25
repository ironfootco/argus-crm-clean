import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Hardcoded Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyAzDxcRibWvd8rcIF11nK9MFU8-fARac1M";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('argus_user') || 'Jason';

  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Visit Tracker State
  const [activeVisit, setActiveVisit] = useState(null);
  const [jobVisits, setJobVisits] = useState([]);
  const [visitLoading, setVisitLoading] = useState(false);
  const [uploadingVisitPhoto, setUploadingVisitPhoto] = useState(false);

  // Infinite Gallery State
  const [jobPhotos, setJobPhotos] = useState([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [selectedTag, setSelectedTag] = useState('Progress');
  const [galleryFilter, setGalleryFilter] = useState('All');

  // Social Media Studio State
  const [showStudio, setShowStudio] = useState(false);
  const [studioStep, setStudioStep] = useState(0); // 0=Pick Before, 1=Pick After, 2=Preview
  const [studioBefore, setStudioBefore] = useState(null);
  const [studioAfter, setStudioAfter] = useState(null);
  const [stitchedPreview, setStitchedPreview] = useState(null);
  const [savingStitch, setSavingStitch] = useState(false);

  // Header View State
  const [headerView, setHeaderView] = useState('street');

  // Edit Modal State
  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editCustomerForm, setEditCustomerForm] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  const [editStreet, setEditStreet] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('MA');
  const [editZip, setEditZip] = useState('');

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    setLoading(true);
    
    // 1. Fetch Job
    const { data: jobData, error: jobErr } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (jobErr || !jobData) {
      alert("Error loading job details.");
      setLoading(false);
      return;
    }
    setJob(jobData);
    setEditForm(jobData);

    // 2. Fetch Customer
    if (jobData.customer_id) {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', jobData.customer_id).single();
      if (custData) {
        setCustomer(custData);
        setEditCustomerForm(custData);
      }
    }

    // 3. Fetch Visits (For liability/payroll)
    const { data: visitsData } = await supabase.from('job_visits').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (visitsData) {
      setJobVisits(visitsData);
      const active = visitsData.find(v => v.worker_name === currentUser && v.status !== 'Completed');
      setActiveVisit(active || null);
    }

    // 4. Fetch Infinite Gallery Photos
    const { data: photosData } = await supabase.from('job_photos').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (photosData) {
      setJobPhotos(photosData);
    }

    setLoading(false);
  };

  // --- VISIT TRACKER ACTION LOGIC ---
  const handleVisitAction = async (actionType) => {
    setVisitLoading(true);
    const timestamp = new Date().toISOString();
    const newTimelineEvent = { action: actionType, timestamp };

    try {
      let currentTimeline = activeVisit ? (activeVisit.timeline || []) : [];
      let newStatus = 'Pending';
      let jobStatusUpdate = null;
      let smsMessage = null;

      if (actionType === 'On My Way') {
        newStatus = 'En Route'; jobStatusUpdate = 'En Route';
        smsMessage = `Hi, this is ${currentUser} from Argus. I'm on my way to your property!`;
      } else if (actionType === 'On Scene') {
        newStatus = 'In Progress'; jobStatusUpdate = 'In Progress';
      } else if (actionType === 'Pause') {
        newStatus = 'Paused';
      } else if (actionType === 'Resume') {
        newStatus = 'In Progress';
      } else if (actionType === 'Wrap Up Visit') {
        newStatus = 'Completed';
      } else if (actionType === 'Job Complete') {
        newStatus = 'Completed'; jobStatusUpdate = 'Job Complete';
        smsMessage = `All done! Thanks for choosing Argus. We will send the final invoice over shortly.`;
      }

      if (!activeVisit && actionType === 'On My Way') {
        await supabase.from('job_visits').insert([{
          job_id: id, worker_name: currentUser, visit_date: new Date().toISOString().split('T')[0], status: newStatus, timeline: [newTimelineEvent]
        }]);
      } else if (activeVisit) {
        await supabase.from('job_visits').update({ status: newStatus, timeline: [...currentTimeline, newTimelineEvent] }).eq('id', activeVisit.id);
      }

      if (jobStatusUpdate) await supabase.from('jobs').update({ status: jobStatusUpdate, job_stage: jobStatusUpdate }).eq('id', id);

      if (smsMessage && customer?.phone && customer?.sms_opt_in) {
        const digits = customer.phone.replace(/\D/g, '');
        const coreNumber = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
        const formattedTwilio = coreNumber.length === 10 ? `+1${coreNumber}` : coreNumber;
        await fetch('/api/outbound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: formattedTwilio, body: smsMessage, sender_name: currentUser }) });
      }
      
      await fetchJobDetails();
    } catch (err) {
      alert("Error logging visit time: " + err.message);
    }
    setVisitLoading(false);
  };

  const handleVisitPhotoUpload = async (e, visitId, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVisitPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } 
        else { if (height > 800) { width *= 800 / height; height = 800; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        
        const payload = type === 'before' ? { before_photo_url: canvas.toDataURL('image/jpeg', 0.6) } : { after_photo_url: canvas.toDataURL('image/jpeg', 0.6) };
        await supabase.from('job_visits').update(payload).eq('id', visitId);
        fetchJobDetails();
        setUploadingVisitPhoto(false);
      };
    };
    reader.readAsDataURL(file);
  };

  // --- INFINITE GALLERY UPLOAD LOGIC ---
  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingGallery(true);
    let processed = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > height) { if (width > 1200) { height *= 1200 / width; width = 1200; } } 
          else { if (height > 1200) { width *= 1200 / height; height = 1200; } }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          
          await supabase.from('job_photos').insert([{
            job_id: id,
            photo_url: canvas.toDataURL('image/jpeg', 0.6),
            tag: selectedTag
          }]);

          processed++;
          if (processed === files.length) {
            fetchJobDetails();
            setUploadingGallery(false);
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteGalleryPhoto = async (photoId) => {
    if (!window.confirm("Delete this photo?")) return;
    await supabase.from('job_photos').delete().eq('id', photoId);
    fetchJobDetails();
  };

  // --- SOCIAL MEDIA STUDIO LOGIC ---
  const processStitch = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1080, 1080);

    const loadImg = (src) => new Promise(res => { const img = new Image(); img.src = src; img.onload = () => res(img); });
    
    const imgBefore = await loadImg(studioBefore.photo_url);
    const imgAfter = await loadImg(studioAfter.photo_url);

    const drawCover = (img, x, w) => {
      const targetRatio = w / 1080;
      const imgRatio = img.width / img.height;
      let sx, sy, sw, sh;
      if (imgRatio > targetRatio) {
        sh = img.height; sw = img.height * targetRatio;
        sx = (img.width - sw) / 2; sy = 0;
      } else {
        sw = img.width; sh = img.width / targetRatio;
        sx = 0; sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, 0, w, 1080);
    };

    drawCover(imgBefore, 0, 540);
    drawCover(imgAfter, 540, 540);

    // Divider
    ctx.fillStyle = '#fff';
    ctx.fillRect(538, 0, 4, 1080);

    // Badges
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, 20, 160, 50);
    ctx.fillRect(560, 20, 160, 50);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('BEFORE', 45, 55);
    ctx.fillText('AFTER', 595, 55);

    setStitchedPreview(canvas.toDataURL('image/jpeg', 0.8));
    setStudioStep(2);
  };

  const handleSaveMarketingStitch = async () => {
    setSavingStitch(true);
    await supabase.from('job_photos').insert([{
      job_id: id,
      photo_url: stitchedPreview,
      tag: 'Marketing'
    }]);
    
    // Reset and close studio
    setShowStudio(false);
    setStudioStep(0);
    setStudioBefore(null);
    setStudioAfter(null);
    setStitchedPreview(null);
    setSavingStitch(false);
    fetchJobDetails();
  };

  // General Edit/Delete Helpers
  const handleEditPhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '');
    let formatted = input;
    if (input.length > 0) {
      if (input.length <= 3) formatted = `(${input}`;
      else if (input.length <= 6) formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
      else formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`;
    }
    setEditCustomerForm({ ...editCustomerForm, phone: formatted });
  };

  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);
    const fullAddress = [editStreet, editUnit, editCity, editState ? `${editState} ${editZip}`.trim() : editZip].filter(Boolean).join(', ');

    const { error: jobError } = await supabase.from('jobs').update({
      title: editForm.title, service_type: editForm.service_type, quoted_price: parseFloat(editForm.quoted_price) || 0,
      assigned_to: editForm.assigned_to, scheduled_date: editForm.scheduled_date || null, scheduled_time: editForm.scheduled_time || null,
      materials_needed: editForm.materials_needed || '', site_notes: editForm.site_notes || '', status: editForm.status, job_stage: editForm.status 
    }).eq('id', id);

    if (job.customer_id && editCustomerForm) {
      await supabase.from('customers').update({
        first_name: editCustomerForm.first_name, last_name: editCustomerForm.last_name, phone: editCustomerForm.phone,
        email: editCustomerForm.email, address: fullAddress, sms_opt_in: editCustomerForm.sms_opt_in 
      }).eq('id', job.customer_id);
    }
    fetchJobDetails();
    setEditingJob(false);
    setSavingJob(false);
  };

  const handleDeleteJob = async () => {
    if (!window.confirm("Delete this job permanently?")) return;
    await supabase.from('jobs').delete().eq('id', id);
    navigate('/jobs');
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
          <button onClick={() => setEditingJob(true)} style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>✏️ Edit</button>
        </div>
      </div>

      {/* ⏱️ LIVE VISIT TRACKER */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 16, color: 'var(--text-main)' }}>⏱️ Live Visit Tracker</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeVisit ? `Current Status: ${activeVisit.status}` : 'No active visit started today.'}</span>
          </div>
          {visitLoading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Updating...</span>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {!activeVisit ? (
            <button onClick={() => handleVisitAction('On My Way')} disabled={visitLoading || job.status === 'Job Complete' || job.status === 'Paid'} style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>🚗 On My Way</button>
          ) : activeVisit.status === 'En Route' ? (
            <button onClick={() => handleVisitAction('On Scene')} disabled={visitLoading} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>📍 Arrived On Scene</button>
          ) : activeVisit.status === 'In Progress' ? (
            <>
              <button onClick={() => handleVisitAction('Pause')} disabled={visitLoading} style={{ flex: 1, background: '#eab308', color: '#000', border: 'none', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>⏸️ Pause</button>
              <button onClick={() => handleVisitAction('Wrap Up Visit')} disabled={visitLoading} style={{ flex: 1, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>🛑 Wrap Up Visit</button>
              <button onClick={() => handleVisitAction('Job Complete')} disabled={visitLoading} style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>✅ Job Complete</button>
            </>
          ) : activeVisit.status === 'Paused' ? (
            <button onClick={() => handleVisitAction('Resume')} disabled={visitLoading} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>▶️ Resume Work</button>
          ) : null}
        </div>
        
        {/* Visit specific Liability photos */}
        {activeVisit && (
          <div style={{ marginTop: 10, padding: 14, background: 'var(--bg-input)', borderRadius: 8, border: '1px dashed var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ background: activeVisit.before_photo_url ? 'var(--bg-card)' : 'var(--primary)', color: activeVisit.before_photo_url ? 'var(--text-main)' : 'var(--primary-text)', padding: '10px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: activeVisit.before_photo_url ? '1px solid var(--success)' : 'none' }}>
                {uploadingVisitPhoto ? "Saving..." : activeVisit.before_photo_url ? "✅ Before Logged" : "📸 Visit Before Photo"}
                <input type="file" accept="image/*" onChange={(e) => handleVisitPhotoUpload(e, activeVisit.id, 'before')} disabled={uploadingVisitPhoto} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ background: activeVisit.after_photo_url ? 'var(--bg-card)' : 'var(--primary)', color: activeVisit.after_photo_url ? 'var(--text-main)' : 'var(--primary-text)', padding: '10px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: activeVisit.after_photo_url ? '1px solid var(--success)' : 'none' }}>
                {uploadingVisitPhoto ? "Saving..." : activeVisit.after_photo_url ? "✅ After Logged" : "📸 Visit After Photo"}
                <input type="file" accept="image/*" onChange={(e) => handleVisitPhotoUpload(e, activeVisit.id, 'after')} disabled={uploadingVisitPhoto} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 📷 HD MAP HEADER */}
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {propertyAddress ? (
          <div style={{ marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border-color)', position: 'relative', height: 280, background: 'var(--bg-card)' }}>
            <img src={activeHeaderImg} alt="Map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#888; font-size:13px; font-weight:bold;">Map View Unavailable</div>'; }} />
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, background: 'rgba(0,0,0,0.75)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setHeaderView('street')} style={{ background: headerView === 'street' ? 'var(--primary)' : 'transparent', color: headerView === 'street' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>🏠 Street</button>
              <button onClick={() => setHeaderView('satellite')} style={{ background: headerView === 'satellite' ? 'var(--primary)' : 'transparent', color: headerView === 'satellite' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>🛰️ Sat</button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 18, borderRadius: 10, padding: 14, border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>⚠️ No address linked to this job yet.</div>
        )}
      </div>

      {/* 📸 INFINITE TAGGED GALLERY & MARKETING STUDIO */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        
        {/* Gallery Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 18, color: 'var(--text-main)' }}>📸 Job Photo Gallery</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tag unlimited task photos. Build social posts.</span>
          </div>
          <button 
            onClick={() => setShowStudio(true)}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}
          >
            🎨 Open Social Studio
          </button>
        </div>

        {/* Upload Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, background: 'var(--bg-input)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: 13, fontWeight: 'bold' }}>
            <option value="Before">Before</option>
            <option value="Progress">Progress</option>
            <option value="After">After</option>
            <option value="Issue">Issue/Damage</option>
          </select>
          <label style={{ background: 'var(--primary)', color: 'var(--primary-text)', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer', flex: 1, textAlign: 'center' }}>
            {uploadingGallery ? "Uploading..." : `➕ Upload as "${selectedTag}"`}
            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploadingGallery} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {['All', 'Before', 'Progress', 'After', 'Issue', 'Marketing'].map(tag => (
            <button key={tag} onClick={() => setGalleryFilter(tag)} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', border: '1px solid var(--border-color)', background: galleryFilter === tag ? 'var(--primary)' : 'var(--bg-input)', color: galleryFilter === tag ? 'var(--primary-text)' : 'var(--text-muted)' }}>
              {tag}
            </button>
          ))}
        </div>

        {/* Image Grid */}
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
          <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            No photos found for {galleryFilter}. Select a tag and start uploading!
          </div>
        )}
      </div>

      {/* 📅 DAILY VISIT HISTORY (Liability / Payroll) */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: 'var(--text-accent)' }}>📅 Visit History Log</h3>
        {jobVisits.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 13 }}>No visits recorded for this job yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {jobVisits.map((v, index) => (
              <div key={v.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-input)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--text-main)' }}>Visit {jobVisits.length - index} • {new Date(v.visit_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Worker: {v.worker_name} | Status: <span style={{ color: v.status === 'Completed' ? 'var(--success)' : 'var(--primary)' }}>{v.status}</span></div>
                  </div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <strong style={{ display: 'block', marginBottom: 6 }}>Timeline Log:</strong>
                    {v.timeline && v.timeline.length > 0 ? (
                      v.timeline.map((event, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{event.action}</span><span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))
                    ) : "No timeline events recorded."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🎨 SOCIAL MEDIA STUDIO MODAL */}
      {showStudio && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', zIndex: 9999, overflowY: 'auto' }}>
          
          <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
            <h2 style={{ margin: 0, color: 'var(--primary)' }}>🎨 Social Media Studio</h2>
            <button onClick={() => { setShowStudio(false); setStudioStep(0); setStudioBefore(null); setStudioAfter(null); setStitchedPreview(null); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, padding: 20, maxWidth: 800, margin: '0 auto', width: '100%' }}>
            
            {/* Step 0 & 1: Select Photos */}
            {studioStep < 2 && (
              <>
                <h3 style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>
                  {studioStep === 0 ? "Step 1: Select a BEFORE photo" : "Step 2: Select an AFTER photo"}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {jobPhotos.map(photo => (
                    <div 
                      key={photo.id} 
                      onClick={() => {
                        if (studioStep === 0) { setStudioBefore(photo); setStudioStep(1); }
                        else { setStudioAfter(photo); processStitch(); }
                      }}
                      style={{ cursor: 'pointer', border: '3px solid transparent', borderRadius: 8, overflow: 'hidden' }}
                    >
                      <img src={photo.photo_url} alt={photo.tag} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Preview & Save */}
            {studioStep === 2 && stitchedPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <h3 style={{ color: '#fff', margin: 0 }}>Review Your Post</h3>
                <img src={stitchedPreview} alt="Stitched Preview" style={{ width: '100%', maxWidth: 500, borderRadius: 10, border: '4px solid #333' }} />
                
                <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 500 }}>
                  <button onClick={() => { setStudioStep(0); setStudioBefore(null); setStudioAfter(null); }} style={{ flex: 1, padding: 14, background: '#333', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                    Restart
                  </button>
                  <button onClick={handleSaveMarketingStitch} disabled={savingStitch} style={{ flex: 2, padding: 14, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                    {savingStitch ? "Saving to Vault..." : "💾 Save to Marketing Vault"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL (Standard Edit Code) */}
      {editingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>✏️ Edit Job Details</h3>
              <button onClick={() => setEditingJob(false)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB TITLE</label><input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} /></div>
              
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingJob(false)} style={{ flex: 1, padding: 10, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={savingJob} style={{ flex: 1.5, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>{savingJob ? 'Saving...' : '💾 Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
