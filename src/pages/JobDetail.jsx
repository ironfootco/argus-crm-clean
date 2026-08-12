import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit State
  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

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
      if (custData) setCustomer(custData);
    }

    setLoading(false);
  };

  /* ========================================================================== */
  /* 🛠️ JOB EDIT & DELETE HANDLERS                                              */
  /* ========================================================================== */
  
  const handleDeleteJob = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this job?")) return;
    
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      alert("Error deleting job: " + error.message);
    } else {
      navigate('/jobs'); // Kick back to all jobs list
    }
  };

  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);

    const { error } = await supabase
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
        job_stage: editForm.job_stage
      })
      .eq('id', id);

    if (error) {
      alert("Error saving job: " + error.message);
    } else {
      setJob({ ...job, ...editForm });
      setEditingJob(false);
    }
    setSavingJob(false);
  };

  /* ========================================================================== */
  /* 📷 PHOTO UPLOAD HANDLER (CAMERA OR GALLERY)                                */
  /* ========================================================================== */

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

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      {/* HEADER NAV & ACTION BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
          &larr; Back
        </button>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
            Stage: {job.job_stage || 'Scheduled'}
          </span>
          <button onClick={() => setEditingJob(true)} style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
            ✏️ Edit
          </button>
          <button onClick={handleDeleteJob} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* JOB SUMMARY CARD */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', color: 'var(--primary)', fontSize: 22 }}>🛠️ {job.title}</h2>
            {customer && (
              <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--text-main)', marginBottom: 6 }}>
                👤 {customer.first_name} {customer.last_name} {customer.phone ? `• 📞 ${customer.phone}` : ''}
              </div>
            )}
            {customer?.address && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                📍 {customer.address}
              </div>
            )}
            
            {/* MATERIALS NEEDED DISPLAY */}
            {job.materials_needed && (
              <div style={{ fontSize: 13, color: 'var(--text-accent)', marginBottom: 12, fontWeight: 'bold', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', border: '1px solid var(--border-color)' }}>
                📦 Tools & Materials: {job.materials_needed}
              </div>
            )}

          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--success)' }}>
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

          <label style={{
            background: 'var(--primary)',
            color: 'var(--primary-text)',
            padding: '8px 14px',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            {uploadingPhoto ? "Saving..." : "📷 Add Site Photos"}
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleAddPhotos} 
              disabled={uploadingPhoto} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>

        {/* PHOTO GALLERY GRID */}
        {job.photo_urls && job.photo_urls.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {job.photo_urls.map((photo, index) => (
              <div key={index} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <img src={photo} alt={`Site photo ${index + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(index)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(239, 68, 68, 0.85)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
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

      {/* ========================================================================== */}
      /* ✏️ EDIT JOB MODAL (Appears over screen when editing is true)                */
      /* ========================================================================== */
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS</label>
                  <select value={editForm.status || 'Lead'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                    <option value="Lead">Lead</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Job Complete">Job Complete</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STAGE</label>
                  <select value={editForm.job_stage || 'Scheduled'} onChange={e => setEditForm({ ...editForm, job_stage: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                    <option value="Lead">Lead</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="En Route">En Route</option>
                    <option value="On Site / In Progress">On Site / In Progress</option>
                    <option value="Job Complete">Job Complete</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>MATERIALS / TOOLS NEEDED</label>
                <input value={editForm.materials_needed || ''} onChange={e => setEditForm({ ...editForm, materials_needed: e.target.value })} placeholder="e.g. 2x4s, Sealant, Pressure Washer" style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE & PROJECT NOTES</label>
                <textarea rows="3" value={editForm.site_notes || ''} onChange={e => setEditForm({ ...editForm, site_notes: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} />
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
