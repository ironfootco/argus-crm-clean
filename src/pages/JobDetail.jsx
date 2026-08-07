import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { processAndUploadMarketingGraphic } from '../utils/driveUpload';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJobDetail();
  }, [id]);

  const fetchJobDetail = async () => {
    setLoading(true);
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (jobData) {
      setJob(jobData);
      if (jobData.customer_id) {
        const { data: custData } = await supabase.from('customers').select('*').eq('id', jobData.customer_id).single();
        if (custData) setCustomer(custData);
      }
    }
    setLoading(false);
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

  const handleUpdateStage = async (newStage) => {
    setSaving(true);
    let updateData = { job_stage: newStage, status: newStage };

    if (newStage === 'Job Complete') {
      updateData.status = 'Job Complete';
      const updatedJob = { ...job, ...updateData };
      await processAndUploadMarketingGraphic(updatedJob);
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
    ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(fullAddress)}&key=${googleMapsApiKey}`
    : null;

  const stage = job.job_stage || job.status || 'Scheduled';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
          ← Back to Overview
        </button>
        <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1.5px solid var(--border-color)' }}>
          Stage: {stage}
        </span>
      </div>

      {/* Google Street View Header Card */}
      {fullAddress && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '2px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 200, width: '100%', background: '#000' }}>
            <img 
              src={streetViewUrl} 
              alt="Street View" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: '10px 14px', borderRadius: 8, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 'bold' }}>📍 {fullAddress}</div>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`} 
                target="_blank" 
                rel="noreferrer"
                style={{ background: 'var(--primary)', color: 'var(--primary-text)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 'bold' }}
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

        {/* Dispatch Spec Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, background: 'var(--bg-input)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block' }}>ASSIGNED CREW</span>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>{job.assigned_to || 'Unassigned'}</span>
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

      {/* Site Notes & Materials Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)', fontSize: 15 }}>📝 Site Notes & Scope Memo</h4>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
            {job.site_notes || "No site notes recorded for this job."}
          </p>
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

      {/* Time Logs / Payroll Summary */}
      {job.time_logs && job.time_logs.length > 0 && (
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)', fontSize: 15 }}>⏱️ Recorded Labor & Payroll Logs</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {job.time_logs.map((log, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 13, border: '1px solid var(--border-color)' }}>
                <span>👤 <strong>{log.worker_name}</strong></span>
                <span>⏱️ {log.hours} hrs @ ${log.rate}/hr = <strong>${(log.hours * log.rate).toFixed(2)}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage Action Override Buttons */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 10, border: '2px solid var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button disabled={saving} onClick={() => handleUpdateStage('Scheduled')} style={{ flex: 1, minHeight: 46, padding: 12, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}>
          Mark Scheduled
        </button>
        <button disabled={saving} onClick={() => handleUpdateStage('En Route')} style={{ flex: 1, minHeight: 46, padding: 12, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}>
          Mark En Route
        </button>
        <button disabled={saving} onClick={() => handleUpdateStage('On Site / In Progress')} style={{ flex: 1, minHeight: 46, padding: 12, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}>
          Mark In Progress
        </button>
        <button disabled={saving} onClick={() => handleUpdateStage('Job Complete')} style={{ flex: 2, minHeight: 46, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}>
          {saving ? "Syncing Drive..." : "✅ Mark Job Complete & Sync Drive"}
        </button>
      </div>
    </div>
  );
}
