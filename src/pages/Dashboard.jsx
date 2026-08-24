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
      const img = new Image(); img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width; let height = img.height;
        if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } else { if (height > 800) { width *= 800 / height; height = 800; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
    reader.readAsDataURL(file);
  };

  const isBefore = type === 'before';
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 440, padding: 20, color: 'var(--text-main)', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: 'var(--text-accent)' }}>{isBefore ? '📸 Work Area: Before Photo' : '📷 Proof of Work: After Photo'}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>{isBefore ? `Take a quick before photo of the site for "${jobTitle}" before starting.` : `Snap a photo of the completed work for "${jobTitle}".`}</p>
        {photo ? (
          <div style={{ marginBottom: 16 }}>
            <img src={photo} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
            <button type="button" onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', marginTop: 6, fontWeight: 'bold' }}>🔄 Retake Photo</button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', padding: '24px 12px', border: '2px dashed var(--border-color)', borderRadius: 8, background: 'var(--bg-input)', cursor: 'pointer', fontWeight: 'bold', fontSize: 15, color: 'var(--primary)' }}>
              📷 Tap to Open Camera / Select Photo
              <input type="file" accept="image/*" capture="environment" onChange={handleCapture} style={{ display: 'none' }} />
            </label>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button type="button" onClick={() => { setPhoto(null); onSkip(); }} style={{ flex: 1, padding: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>Skip for Now</button>
          <button type="button" disabled={!photo} onClick={() => { const p = photo; setPhoto(null); onSave(p); }} style={{ flex: 1.5, padding: 12, background: photo ? 'var(--success)' : 'var(--border-color)', color: '#fff', border: 'none', borderRadius: 6, cursor: photo ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: 14 }}>Save Photo & Continue</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ refreshTrigger, activeWorker }) {
  const [jobs, setJobs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [photoModalJob, setPhotoModalJob] = useState(null);
  const [photoModalType, setPhotoModalType] = useState(null);
  const navigate = useNavigate();

  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedFilterDate, setSelectedFilterDate] = useState(todayIso);

  useEffect(() => { fetchActiveJobs(); fetchTeamMembers(); }, [refreshTrigger, activeWorker]);
  useEffect(() => { checkShiftStatus(); }, [activeWorker]);

  const fetchTeamMembers = async () => { const { data } = await supabase.from('team_members').select('*').order('name'); if (data) setTeamMembers(data); };

  const fetchActiveJobs = async () => {
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));
    const { data: jobData } = await supabase.from('jobs').select('*').neq('status', 'Job Complete').order('scheduled_date', { ascending: true, nullsFirst: false });
    if (jobData) {
      const activeFieldJobs = jobData.filter(j => {
        if (!j.assigned_to || j.assigned_to === 'Unassigned') return false;
        return (j.assigned_to === activeWorker || j.assigned_to.includes(activeWorker) || j.assigned_to.includes('Both'));
      });
      setJobs(activeFieldJobs.map(j => ({ ...j, customers: custMap[j.customer_id] })));
    }
  };

  const checkShiftStatus = async () => {
    const { data } = await supabase.from('timesheets').select('*').eq('worker_name', activeWorker).is('clock_out', null).order('clock_in', { ascending: false }).limit(1);
    setActiveShift(data && data.length > 0 ? data[0] : null);
  };

  const toggleShiftClock = async () => {
    setLoadingShift(true);
    if (activeShift) {
      const clockInTime = new Date(activeShift.clock_in); const clockOutTime = new Date();
      const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));
      await supabase.from('timesheets').update({ clock_out: clockOutTime.toISOString(), total_hours: hours }).eq('id', activeShift.id);
      setActiveShift(null);
    } else {
      const { data } = await supabase.from('timesheets').insert([{ worker_name: activeWorker, clock_in: new Date().toISOString() }]).select().single();
      if (data) setActiveShift(data);
    }
    setLoadingShift(false);
  };

  const formatDate = (dateStr) => { if (!dateStr) return 'Unscheduled'; const [year, month, day] = dateStr.split('-'); return `${month}/${day}/${year}`; };
  const formatTime = (timeStr) => { if (!timeStr) return ''; const [hours, minutes] = timeStr.split(':'); let h = parseInt(hours, 10); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${minutes} ${ampm}`; };

  const handleStageClick = (job, targetStage) => {
    if (targetStage === 'En Route' && job.scheduled_date && job.scheduled_date !== todayIso) {
      if (!window.confirm(`⚠️ SAFETY CHECK:\nThis job is scheduled for ${formatDate(job.scheduled_date)}, NOT TODAY.\n\nAre you sure you want to start 'En Route' for this job?`)) return;
    }
    if (targetStage === 'On Site / In Progress' && !job.before_photo_url) { setPhotoModalJob(job); setPhotoModalType('before'); return; }
    if (targetStage === 'Job Complete' && !job.after_photo_url) { setPhotoModalJob(job); setPhotoModalType('after'); return; }
    commitStageUpdate(job, targetStage);
  };

  const handlePhotoSaved = async (photoBase64) => {
    if (!photoModalJob) return;
    const isBefore = photoModalType === 'before';
    const updateField = isBefore ? { before_photo_url: photoBase64 } : { after_photo_url: photoBase64 };
    const { error: saveErr } = await supabase.from('jobs').update(updateField).eq('id', photoModalJob.id);
    if (saveErr) { alert(`❌ Database Save Error:\n${saveErr.message}`); return; }
    const { data: freshJob } = await supabase.from('jobs').select('*').eq('id', photoModalJob.id).single();
    const nextStage = isBefore ? 'On Site / In Progress' : 'Job Complete';
    setPhotoModalJob(null); setPhotoModalType(null);
    commitStageUpdate(freshJob || { ...photoModalJob, ...updateField }, nextStage);
  };

  const handlePhotoSkipped = () => {
    if (!photoModalJob) return;
    const nextStage = photoModalType === 'before' ? 'On Site / In Progress' : 'Job Complete';
    const job = photoModalJob;
    setPhotoModalJob(null); setPhotoModalType(null);
    commitStageUpdate(job, nextStage);
  };

  const commitStageUpdate = async (job, stage, isPaused = false) => {
    let updateData = { job_stage: stage, is_paused: isPaused };
    if (stage === 'On Site / In Progress' && !isPaused) { updateData.job_started_at = new Date().toISOString(); updateData.status = 'In Progress'; }
    if ((isPaused && stage === 'On Site / In Progress') || stage === 'Job Complete') {
      if (job.job_started_at) {
        const startTime = new Date(job.job_started_at); const endTime = new Date();
        let hoursWorked = parseFloat(((endTime - startTime) / (1000 * 60 * 60)).toFixed(2)); if (hoursWorked <= 0) hoursWorked = 0.02;
        const activeMember = teamMembers.find(m => m.name === activeWorker);
        const activeRate = activeMember ? activeMember.hourly_rate : 40;
        updateData.time_logs = [...(job.time_logs || []), { worker_name: activeWorker, hours: hoursWorked, rate: activeRate }];
        updateData.job_started_at = null;
      }
    }
    if (stage === 'Job Complete') { updateData.status = 'Job Complete'; await processAndUploadMarketingGraphic({ ...job, ...updateData }); }
    await supabase.from('jobs').update(updateData).eq('id', job.id);
    fetchActiveJobs();
  };

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const isoStr = d.toISOString().split('T')[0];
    return { isoStr, dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }), monthDay: `${d.getMonth() + 1}/${d.getDate()}`, jobCount: jobs.filter(j => j.scheduled_date === isoStr).length };
  });

  const filteredJobs = jobs.filter(j => selectedFilterDate === 'ALL_UPCOMING' ? true : j.scheduled_date === selectedFilterDate);
  const targetLoadoutDate = selectedFilterDate === 'ALL_UPCOMING' ? todayIso : selectedFilterDate;
  const loadoutMaterials = jobs.filter(j => j.scheduled_date === targetLoadoutDate).map(j => j.materials_needed).filter(Boolean).join(' • ');

  let lastRenderedDate = null;

  return (
    <div>
      <PhotoModal isOpen={!!photoModalJob} type={photoModalType} jobTitle={photoModalJob?.title} onClose={() => setPhotoModalJob(null)} onSave={handlePhotoSaved} onSkip={handlePhotoSkipped} />
      
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 4 }}>PAYROLL SHIFT CLOCK</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-main)' }}>👤 {activeWorker}</div>
            {activeShift && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 'bold' }}>🟢 Clocked in</span>}
          </div>
        </div>
        <button onClick={toggleShiftClock} disabled={loadingShift} style={{ minHeight: 48, padding: '10px 20px', background: activeShift ? '#ef4444' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
          {loadingShift ? "Saving..." : activeShift ? `🛑 Clock Out ${activeWorker}` : `🟢 Clock In ${activeWorker}`}
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: 15 }}>📅 {activeWorker}&apos;s 7-Day Field Outlook</h4>
          <button onClick={() => setSelectedFilterDate('ALL_UPCOMING')} style={{ background: selectedFilterDate === 'ALL_UPCOMING' ? 'var(--primary)' : 'var(--bg-input)', color: selectedFilterDate === 'ALL_UPCOMING' ? 'var(--primary-text)' : 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>Show All</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
          {next7Days.map(d => {
            const isSelected = selectedFilterDate === d.isoStr;
            return (
              <button key={d.isoStr} onClick={() => setSelectedFilterDate(isSelected ? 'ALL_UPCOMING' : d.isoStr)} style={{ background: isSelected ? 'var(--primary)' : d.jobCount > 0 ? 'var(--bg-input)' : 'transparent', color: isSelected ? 'var(--primary-text)' : 'var(--text-main)', border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: 8, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 'bold', opacity: 0.8 }}>{d.dayLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 'bold' }}>{d.monthDay}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: d.jobCount > 0 ? 'var(--success)' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 'bold', marginTop: 2 }}>{d.jobCount} {d.jobCount === 1 ? 'job' : 'jobs'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-accent)', fontSize: 15 }}>🚛 Tool & Equipment Prep</h4>
        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>{loadoutMaterials || `No materials specified for ${formatDate(targetLoadoutDate)}.`}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ color: 'var(--text-main)', margin: 0 }}>⚡ {activeWorker}&apos;s Schedule ({filteredJobs.length})</h3>
        <span style={{ fontSize: 12, color: 'var(--text-accent)', fontWeight: 'bold' }}>{selectedFilterDate === 'ALL_UPCOMING' ? 'Viewing All Upcoming' : `Filtering: ${formatDate(selectedFilterDate)}`}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {filteredJobs.map(job => {
          const stage = job.job_stage || 'Scheduled';
          const isUnassigned = job.assigned_to === 'Unassigned' || !job.assigned_to;
          const cust = job.customers;
          const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;
          let showDateBanner = false;
          if (selectedFilterDate === 'ALL_UPCOMING' && job.scheduled_date !== lastRenderedDate) { showDateBanner = true; lastRenderedDate = job.scheduled_date; }
          const isJobToday = job.scheduled_date === todayIso;

          return (
            <React.Fragment key={job.id}>
              {showDateBanner && (
                <div style={{ margin: '15px 0 5px 0', padding: '10px 14px', background: isJobToday ? 'var(--primary)' : 'var(--bg-card)', color: isJobToday ? 'var(--primary-text)' : 'var(--text-accent)', borderRadius: 6, border: '1.5px solid var(--border-color)', fontWeight: 'bold', fontSize: 14 }}>
                  📅 {isJobToday ? "TODAY'S SCHEDULE" : `UPCOMING: ${formatDate(job.scheduled_date)}`}
                </div>
              )}
              <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, border: isJobToday ? '2px solid var(--border-color)' : '1.5px dashed var(--border-color)', opacity: (selectedFilterDate === 'ALL_UPCOMING' && !isJobToday) ? 0.85 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.id}`)}>
                  <div>
                    <strong style={{ fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                    {custName && <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 'bold', marginTop: 4 }}>👤 {custName} {cust?.phone ? `• 📞 ${cust.phone}` : ''}</div>}
                    {(cust?.address || job.address) && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>📍 {cust?.address || job.address}</div>}
                    {job.materials_needed && <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 4, fontWeight: 'bold' }}>📦 Tools & Materials: {job.materials_needed}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: job.before_photo_url ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)', color: job.before_photo_url ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>{job.before_photo_url ? '📸 Before Photo: ✅' : '📸 Before Photo: ⚠️ Missing'}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: job.after_photo_url ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)', color: job.after_photo_url ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>{job.after_photo_url ? '📷 After Photo: ✅' : '📷 After Photo: ⚠️ Missing'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>Assigned: <span style={{ color: isUnassigned ? 'var(--warning)' : 'var(--text-accent)', fontWeight: 'bold' }}>{isUnassigned ? '⚠️ Unassigned' : job.assigned_to}</span></span>
                      {job.scheduled_date ? <span style={{ color: isJobToday ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>📅 {formatDate(job.scheduled_date)} {job.scheduled_time ? `⏰ ${formatTime(job.scheduled_time)}` : ''}</span> : <span style={{ color: 'var(--warning)', fontWeight: 'bold', background: 'rgba(249, 115, 22, 0.15)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--warning)' }}>⚠️ Unscheduled</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block' }}>Stage: {stage} {job.is_paused ? '(Paused)' : ''}</span>
                  </div>
                </div>
                <div style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(stage === 'Scheduled' || stage === 'Lead') && <button onClick={() => handleStageClick(job, 'En Route')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>🚗 On My Way</button>}
                  {stage === 'En Route' && <button onClick={() => handleStageClick(job, 'On Site / In Progress')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>📍 Arrived On Site</button>}
                  {stage === 'On Site / In Progress' && (
                    <>
                      <button onClick={() => commitStageUpdate(job, 'On Site / In Progress', !job.is_paused)} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>{job.is_paused ? "▶️ Resume Work" : "⏸️ Pause Work"}</button>
                      <button onClick={() => handleStageClick(job, 'Job Complete')} style={{ flex: 1, minHeight: 48, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>✅ Job Finished</button>
                    </>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {filteredJobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No dispatched jobs found for {activeWorker} on this date selection.</p>}
      </div>
    </div>
  );
}
