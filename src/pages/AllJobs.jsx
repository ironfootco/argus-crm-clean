import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
            ? `Take a quick before photo for "${jobTitle}" before starting.` 
            : `Snap a photo of completed work for "${jobTitle}".`}
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

export default function AllJobs() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [photoModalJob, setPhotoModalJob] = useState(null);
  const [photoModalType, setPhotoModalType] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });

    if (jobData) {
      const merged = jobData.map(j => ({ ...j, customers: custMap[j.customer_id] }));
      setJobs(merged);
    }
  };

  const handleStageClick = (job, targetStage) => {
    if (targetStage === 'On Site / In Progress' && !job.before_photo_url) {
      setPhotoModalJob(job);
      setPhotoModalType('before');
      return;
    }

    if (targetStage === 'Job Complete' && !job.after_photo_url) {
      setPhotoModalJob(job);
      setPhotoModalType('after');
      return;
    }

    commitStageUpdate(job, targetStage);
  };

  const handlePhotoSaved = async (photoBase64) => {
    if (!photoModalJob) return;

    const isBefore = photoModalType === 'before';
    const updateField = isBefore ? { before_photo_url: photoBase64 } : { after_photo_url: photoBase64 };

    await supabase.from('jobs').update(updateField).eq('id', photoModalJob.id);

    const nextStage = isBefore ? 'On Site / In Progress' : 'Job Complete';
    const updatedJob = { ...photoModalJob, ...updateField };
    
    setPhotoModalJob(null);
    setPhotoModalType(null);

    commitStageUpdate(updatedJob, nextStage);
  };

  const handlePhotoSkipped = () => {
    if (!photoModalJob) return;
    const nextStage = photoModalType === 'before' ? 'On Site / In Progress' : 'Job Complete';
    const job = photoModalJob;
    
    setPhotoModalJob(null);
    setPhotoModalType(null);

    commitStageUpdate(job, nextStage);
  };

  const commitStageUpdate = async (job, stage) => {
    let updateData = { job_stage: stage, status: stage };

    if (stage === 'On Site / In Progress') {
      updateData.job_started_at = new Date().toISOString();
      updateData.status = 'In Progress';
    }

    if (stage === 'Job Complete') {
      updateData.status = 'Job Complete';
      await processAndUploadMarketingGraphic(job);
    }

    await supabase.from('jobs').update(updateData).eq('id', job.id);
    fetchJobs();
  };

  const filteredJobs = jobs.filter(j => {
    const titleMatch = j.title?.toLowerCase().includes(search.toLowerCase());
    const custName = j.customers ? `${j.customers.first_name} ${j.customers.last_name}`.toLowerCase() : '';
    const custMatch = custName.includes(search.toLowerCase());
    const matchesSearch = titleMatch || custMatch;

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && (j.status === statusFilter || j.job_stage === statusFilter);
  });

  return (
    <div>
      <PhotoModal 
        isOpen={!!photoModalJob} 
        type={photoModalType} 
        jobTitle={photoModalJob?.title} 
        onClose={() => setPhotoModalJob(null)} 
        onSave={handlePhotoSaved} 
        onSkip={handlePhotoSkipped} 
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>📋 Master Job Directory ({filteredJobs.length})</h2>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input 
          placeholder="🔍 Search jobs by title, customer, or address..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ flex: 1, minWidth: 240, padding: 12, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15 }} 
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 6 }}>
        {['All', 'Lead', 'Scheduled', 'In Progress', 'Job Complete'].map(st => (
          <button 
            key={st} 
            onClick={() => setStatusFilter(st)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: 20, 
              border: '1.5px solid var(--border-color)', 
              background: statusFilter === st ? 'var(--primary)' : 'var(--bg-card)', 
              color: statusFilter === st ? 'var(--primary-text)' : 'var(--text-main)', 
              fontWeight: 'bold', 
              fontSize: 13, 
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {st}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredJobs.map(job => {
          const cust = job.customers;
          const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'No Customer';
          const stage = job.job_stage || job.status || 'Scheduled';

          return (
            <div 
              key={job.id} 
              style={{ 
                background: 'var(--bg-card)', 
                padding: 16, 
                borderRadius: 8, 
                border: '1.5px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div style={{ cursor: 'pointer', flex: 1, minWidth: 220 }} onClick={() => navigate(`/jobs/${job.id}`)}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-main)' }}>🛠️ {job.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  👤 {custName} {job.address ? `• 📍 ${job.address}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 4 }}>
                  Assigned: <strong>{job.assigned_to || 'Unassigned'}</strong> • Date: {job.scheduled_date || 'Unscheduled'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)', fontSize: 16 }}>
                  ${job.quoted_price?.toLocaleString()}
                </div>
                {stage !== 'Job Complete' ? (
                  <button 
                    onClick={() => handleStageClick(job, stage === 'Scheduled' ? 'En Route' : stage === 'En Route' ? 'On Site / In Progress' : 'Job Complete')}
                    style={{ padding: '8px 12px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                  >
                    Advance ({stage})
                  </button>
                ) : (
                  <span style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 12, fontSize: 12, fontWeight: 'bold' }}>
                    ✅ Complete
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {filteredJobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No matching jobs found.</p>}
      </div>
    </div>
  );
}
