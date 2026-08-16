import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Hardcoded Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyAzDxcRibWvd8rcIF11nK9MFU8-fARac1M";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Header View State
  const [headerView, setHeaderView] = useState('street');

  // Edit State
  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editCustomerForm, setEditCustomerForm] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  // Broken out address fields for the modal
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
    const { data: jobData, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (jobErr || !jobData) {
      alert("Error loading job details.");
      setLoading(false);
      return;
    }

    setJob(jobData);
    setEditForm(jobData);

    if (jobData.customer_id) {
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', jobData.customer_id)
        .single();
      if (custData) {
        setCustomer(custData);
        setEditCustomerForm(custData);
      }
    }

    setLoading(false);
  };

  const handleDeleteJob = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this job?")) return;
    
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      alert("Error deleting job: " + error.message);
    } else {
      navigate('/jobs'); 
    }
  };

  // 🎯 Auto-formats phone number in the edit modal
  const handleEditPhoneChange = (e) => {
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
    setEditCustomerForm({ ...editCustomerForm, phone: formatted });
  };

  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);

    // Re-combine the address before saving
    const fullAddress = [editStreet, editUnit, editCity, editState ? `${editState} ${editZip}`.trim() : editZip]
      .filter(Boolean)
      .join(', ');

    // 1. Update Job Details (Syncing status and job_stage automatically)
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        title: editForm.title,
        service_type: editForm.service_type,
        quoted_price: parseFloat(editForm.quoted_price) || 0,
        assigned_to: editForm.assigned_to,
        scheduled_date: editForm.scheduled_date || null,
        scheduled_time: editForm.scheduled_time || null,
        materials_needed: editForm.materials_needed || '',
        site_notes: editForm.site_notes || '',
        status: editForm.status,
        job_stage: editForm.status 
      })
      .eq('id', id);

    // 2. Update Customer Details (if attached)
    let custError = null;
    if (job.customer_id && editCustomerForm) {
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editCustomerForm.first_name,
          last_name: editCustomerForm.last_name,
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          address: fullAddress, // Use re-combined address
          sms_opt_in: editCustomerForm.sms_opt_in // Saving the Opt-In Status
        })
        .eq('id', job.customer_id);
      custError = error;
    }

    if (jobError || custError) {
      alert("Error saving details.");
    } else {
      setJob({ ...job, ...editForm, job_stage: editForm.status });
      if (editCustomerForm) setCustomer({ ...customer, ...editCustomerForm, address: fullAddress });
      setEditingJob(false);
    }
    setSavingJob(false);
  };

  const handleAddPhotos = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingPhoto(true);
    let processedCount = 0;
    const newBase64Photos = [];

    files.forEach((file) => {
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
          newBase64Photos.push(compressedBase64);
          processedCount++;

          if (processedCount === files.length) {
            savePhotosToDatabase(newBase64Photos);
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const savePhotosToDatabase = async (newPhotos) => {
    const updatedPhotos = [...(job.photo_urls || []), ...newPhotos];

    const { error } = await supabase
      .from('jobs')
      .update({ photo_urls: updatedPhotos })
      .eq('id', id);

    if (error) {
      alert("Error saving photos: " + error.message);
    } else {
      setJob((prev) => ({ ...prev, photo_urls: updatedPhotos }));
    }
    setUploadingPhoto(false);
  };

  const handleDeletePhoto = async (indexToDelete) => {
    if (!window.confirm("Delete this photo from the job?")) return;

    const updatedPhotos = (job.photo_urls || []).filter((_, idx) => idx !== indexToDelete);

    const { error } = await supabase
      .from('jobs')
      .update({ photo_urls: updatedPhotos })
      .eq('id', id);

    if (error) {
      alert("Error deleting photo: " + error.message);
    } else {
      setJob((prev) => ({ ...prev, photo_urls: updatedPhotos }));
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Job Details...</div>;
  }

  if (!job) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Job not found.</div>;
  }

  // --- Map Header Logic ---
  const propertyAddress = customer?.address || job?.address;

  const streetViewUrl = propertyAddress
    ? `https://maps.googleapis.com/maps/api/streetview?size=850x320&scale=2&location=${encodeURIComponent(propertyAddress)}&fov=100&pitch=10&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  const satelliteUrl = propertyAddress
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(propertyAddress)}&zoom=19&size=850x320&scale=2&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  const activeHeaderImg = headerView === 'satellite' ? satelliteUrl : streetViewUrl;

  const handleOpenEditModal = () => {
    setEditForm(job);
    const custInfo = customer || { first_name: '', last_name: '', phone: '', email: '', address: '', sms_opt_in: true };
    setEditCustomerForm(custInfo);
    
    // Parse the address for the split fields
    const addressToParse = custInfo.address || '';
    if (addressToParse) {
      const parts = addressToParse.split(',').map(p => p.trim());
      if (parts.length === 1) {
          setEditStreet(parts[0]);
          setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
      } else if (parts.length === 3) {
          setEditStreet(parts[0]);
          setEditCity(parts[1]);
          const sz = parts[2].split(' ');
          setEditState(sz[0] || 'MA');
          setEditZip(sz[1] || '');
          setEditUnit('');
      } else if (parts.length >= 4) {
          setEditStreet(parts[0]);
          setEditUnit(parts[1]);
          setEditCity(parts[2]);
          const sz = parts[3].split(' ');
          setEditState(sz[0] || 'MA');
          setEditZip(sz[1] || '');
      } else {
          setEditStreet(addressToParse);
          setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
      }
    } else {
      setEditStreet(''); setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
    }

    setEditingJob(true);
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      {/* HEADER NAV & ACTION BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
          &larr; Back
        </button>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
            Status: {job.status || 'Lead'}
          </span>
          <button onClick={handleOpenEditModal} style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
            ✏️ Edit
          </button>
          <button onClick={handleDeleteJob} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* 📷 HD Property Header with View Switcher */}
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {propertyAddress ? (
          <div style={{ marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border-color)', position: 'relative', height: 280, background: 'var(--bg-card)' }}>
            <img 
              src={activeHeaderImg} 
              alt="Property Header" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              onError={(e) => {
                e.target.onerror = null; 
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#888; font-size:13px; font-weight:bold;">Map View Unavailable</div>';
              }}
            />
            
            <div style={{ position: 'absolute', bottom: 8, left: 12, background: 'rgba(0,0,0,0.85)', padding: '5px 12px', borderRadius: 6 }}>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(propertyAddress)}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                📍 {propertyAddress} <span style={{ fontSize: 10, color: 'var(--primary)' }}>(Open in Maps ↗)</span>
              </a>
            </div>

            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, background: 'rgba(0,0,0,0.75)', padding: 4, borderRadius: 8 }}>
              <button
                onClick={() => setHeaderView('street')}
                style={{ background: headerView === 'street' ? 'var(--primary)' : 'transparent', color: headerView === 'street' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}
              >
                🏠 Street View
              </button>
              <button
                onClick={() => setHeaderView('satellite')}
                style={{ background: headerView === 'satellite' ? 'var(--primary)' : 'transparent', color: headerView === 'satellite' ? 'var(--primary-text)' : '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}
              >
                🛰️ Satellite Driveway
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 18, borderRadius: 10, padding: 14, border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            ⚠️ No address linked to this job yet. Select or edit customer details to load map data.
          </div>
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
                {customer.phone ? ` • 📞 ${customer.phone}` : ''}
                {customer.email ? ` • ✉️ ${customer.email}` : ''}
                <div style={{ marginTop: 6, fontSize: 13, color: customer.sms_opt_in ? 'var(--success)' : 'var(--text-muted)' }}>
                  {customer.sms_opt_in ? '✅ SMS Opt-In: Yes' : '🔕 SMS Opt-In: No'}
                </div>
              </div>
            )}
            
            {job.materials_needed && (
              <div style={{ fontSize: 13, color: 'var(--text-accent)', marginBottom: 12, fontWeight: 'bold', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', border: '1px solid var(--border-color)' }}>
                📦 Tools & Materials: {job.materials_needed}
              </div>
            )}

          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--success)', marginLeft: 16 }}>
            ${job.quoted_price?.toLocaleString() || '0'}
          </div>
        </div>

        {job.site_notes && (
          <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14, lineHeight: '1.5', whitespace: 'pre-wrap', marginTop: 10 }}>
            <strong>Notes:</strong> {job.site_notes}
          </div>
        )}
      </div>

      {/* BEFORE & AFTER PROOF OF WORK */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: 'var(--text-accent)' }}>📸 Official Before & After Proof</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 6 }}>BEFORE PHOTO</div>
            {job.before_photo_url ? (
              <img src={job.before_photo_url} alt="Before" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
            ) : (
              <div style={{ height: 160, borderRadius: 6, border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Missing Before Photo</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 6 }}>AFTER PHOTO</div>
            {job.after_photo_url ? (
              <img src={job.after_photo_url} alt="After" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
            ) : (
              <div style={{ height: 160, borderRadius: 6, border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Missing After Photo</div>
            )}
          </div>
        </div>
      </div>

      {/* ADDITIONAL SITE & PROGRESS PHOTOS */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-accent)' }}>📷 Additional Site & Progress Photos</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Snap extra job photos or pick from your phone gallery</span>
          </div>

          <label style={{ background: 'var(--primary)', color: 'var(--primary-text)', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {uploadingPhoto ? "Saving..." : "📷 Add Site Photos"}
            <input type="file" accept="image/*" multiple onChange={handleAddPhotos} disabled={uploadingPhoto} style={{ display: 'none' }} />
          </label>
        </div>

        {job.photo_urls && job.photo_urls.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {job.photo_urls.map((photo, index) => (
              <div key={index} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <img src={photo} alt={`Site photo ${index + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(index)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Delete Photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px 12px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 13 }}>
            No additional progress photos uploaded yet. Tap <strong>📷 Add Site Photos</strong> above to upload from your gallery or camera.
          </div>
        )}
      </div>

      {/* EDIT JOB MODAL */}
      {editingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>✏️ Edit Job Details</h3>
              <button onClick={() => setEditingJob(false)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB TITLE</label>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>

              {/* CUSTOMER INFO FIELDS */}
              {editCustomerForm && (
                <div style={{ marginTop: 6, padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-accent)' }}>👤 EDIT CUSTOMER DETAILS</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>FIRST NAME</label>
                      <input value={editCustomerForm.first_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, first_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>LAST NAME</label>
                      <input value={editCustomerForm.last_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, last_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>PHONE</label>
                      <input value={editCustomerForm.phone || ''} onChange={handleEditPhoneChange} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>EMAIL</label>
                      <input value={editCustomerForm.email || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 4 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STREET ADDRESS</label>
                      <input value={editStreet} onChange={e => setEditStreet(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>UNIT / APT</label>
                      <input value={editUnit} onChange={e => setEditUnit(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginTop: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>CITY</label>
                      <input value={editCity} onChange={e => setEditCity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATE</label>
                      <input value={editState} onChange={e => setEditState(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ZIP CODE</label>
                      <input value={editZip} onChange={e => setEditZip(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SMS OPT-IN</label>
                    <select 
                      value={editCustomerForm.sms_opt_in ? 'true' : 'false'} 
                      onChange={e => setEditCustomerForm({ ...editCustomerForm, sms_opt_in: e.target.value === 'true' })} 
                      style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>QUOTED PRICE ($)</label>
                  <input type="number" value={editForm.quoted_price || ''} onChange={e => setEditForm({ ...editForm, quoted_price: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ASSIGNED CREW</label>
                  <select value={editForm.assigned_to || 'Unassigned'} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                    <option value="Unassigned">⚠️ Unassigned</option>
                    <option value="Jason">Jason</option>
                    <option value="Edwin">Edwin</option>
                    <option value="Both">Both (Jason & Edwin)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SCHEDULE DATE</label>
                  <input type="date" value={editForm.scheduled_date || ''} onChange={e => setEditForm({ ...editForm, scheduled_date: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SCHEDULE TIME</label>
                  <input type="time" value={editForm.scheduled_time || ''} onChange={e => setEditForm({ ...editForm, scheduled_time: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS</label>
                <select value={editForm.status || 'Lead'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                  <option value="Lead">Lead</option>
                  <option value="Estimate Sent">Estimate Sent</option>
                  <option value="Estimate Approved">Estimate Approved</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="En Route">En Route</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Job Complete">Job Complete</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              {/* 🎯 FIX: Auto-expanding Materials Textarea */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>MATERIALS / TOOLS NEEDED</label>
                <textarea 
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                  value={editForm.materials_needed || ''} 
                  onChange={e => {
                    setEditForm({ ...editForm, materials_needed: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }} 
                  placeholder="e.g. 2x4s, Sealant, Pressure Washer" 
                  style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: '60px', resize: 'vertical' }} 
                />
              </div>

              {/* 🎯 FIX: Auto-expanding Notes Textarea */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE & PROJECT NOTES</label>
                <textarea 
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                  value={editForm.site_notes || ''} 
                  onChange={e => {
                    setEditForm({ ...editForm, site_notes: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: '120px', resize: 'vertical' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingJob(false)} style={{ flex: 1, padding: 10, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={savingJob} style={{ flex: 1.5, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                  {savingJob ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
