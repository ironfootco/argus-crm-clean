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

  // PHOTO UPLOAD HANDLER (CAMERA OR GALLERY)
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
      {/* HEADER NAV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
          &larr; Back
        </button>
        <span style={{ fontSize: 13, padding: '4px 10px', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
          Stage: {job.job_stage || 'Scheduled'}
        </span>
      </div>

      {/* JOB SUMMARY CARD */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
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
        {job.site_notes && (
          <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14, lineHeight: '1.5', whitespace: 'pre-wrap' }}>
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

      {/* ADDITIONAL SITE & PROGRESS PHOTOS (CAMERA OR GALLERY) */}
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
    </div>
  );
}
