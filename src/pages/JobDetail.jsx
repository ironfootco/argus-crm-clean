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

  const handleUpdateStage = async (newStage) => {
    if (!job) return;

    let updateData = { job_stage: newStage, status: newStage };

    if (newStage === 'Job Complete') {
      updateData.status = 'Job Complete';
      const updatedJob = { ...job, job_stage: newStage };
      await processAndUploadMarketingGraphic(updatedJob);
    }

    await supabase.from('jobs').update(updateData).eq('id', id);
    fetchJobDetail();
  };

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Loading job details...</div>;
  if (!job) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Job not found.</div>;

  return (
    <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 15, fontWeight: 'bold' }}>
        ← Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>🛠️ {job.title}</h2>
          {customer && (
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 4 }}>
              👤 {customer.first_name} {customer.last_name} • 📞 {customer.phone || 'No phone'}
            </div>
          )}
          {job.address && <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>📍 {job.address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
            Stage: {job.job_stage || job.status}
          </span>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border-color)', margin: '20px 0' }} />

      {/* Proof-of-Work Photos Preview */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)' }}>📸 Proof of Work Photos</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 4 }}>BEFORE PHOTO</div>
            {job.before_photo_url ? (
              <img src={job.before_photo_url} alt="Before" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
            ) : (
              <div style={{ height: 160, borderRadius: 8, border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No Before Photo</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 4 }}>AFTER PHOTO</div>
            {job.after_photo_url ? (
              <img src={job.after_photo_url} alt="After" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
            ) : (
              <div style={{ height: 160, borderRadius: 8, border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No After Photo</div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Override Action Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => handleUpdateStage('Scheduled')} style={{ flex: 1, padding: 12, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          Mark Scheduled
        </button>
        <button onClick={() => handleUpdateStage('In Progress')} style={{ flex: 1, padding: 12, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          Mark In Progress
        </button>
        <button onClick={() => handleUpdateStage('Job Complete')} style={{ flex: 1, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          ✅ Mark Job Complete & Sync Drive
        </button>
      </div>
    </div>
  );
}
