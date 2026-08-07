import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const GOOGLE_MAPS_API_KEY = "AIzaSyAzDxcRibWvd8rcIF11nK9MFU8-fARac1M";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerView, setHeaderView] = useState('street'); // 'street' or 'satellite'

  // Form State
  const [status, setStatus] = useState("Lead");
  const [quotedPrice, setQuotedPrice] = useState(0);
  const [materialCost, setMaterialCost] = useState(0);
  const [timeLogs, setTimeLogs] = useState([]);
  const [workerName, setWorkerName] = useState("");
  const [workerHours, setWorkerHours] = useState("");
  const [syncingWave, setSyncingWave] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);

  // Scheduling & Scope State
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [assignedTo, setAssignedTo] = useState("Unassigned");
  const [materialsNeeded, setMaterialsNeeded] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState([]);

  useEffect(() => {
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    setLoading(true);

    const { data: custData } = await supabase.from('customers').select('*').order('last_name');
    if (custData) setCustomers(custData);

    const { data: teamData } = await supabase.from('team_members').select('*').order('name');
    if (teamData) {
      setTeamMembers(teamData);
      if (teamData.length > 0) setWorkerName(teamData[0].name);
    }

    const { data: jobData, error: jobErr } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (jobErr) console.error("Error fetching job details:", jobErr);

    if (jobData) {
      const activeCustomer = (custData || []).find(c => c.id === jobData.customer_id);
      setJob({ ...jobData, customers: activeCustomer });
      setStatus(jobData.status || "Lead");
      setQuotedPrice(jobData.quoted_price || 0);
      setMaterialCost(jobData.material_cost || 0);
      setTimeLogs(jobData.time_logs || []);
      setCustomerId(jobData.customer_id || "");
      setScheduledDate(jobData.scheduled_date || "");
      setScheduledTime(jobData.scheduled_time || "");
      setAssignedTo(jobData.assigned_to || "Unassigned");
      setMaterialsNeeded(jobData.materials_needed || "");
      setSiteNotes(jobData.site_notes || "");
      setPhotoUrls(jobData.photo_urls || []);
    }

    setLoading(false);
  };

  const totalLaborCost = timeLogs.reduce((acc, item) => {
    const hrs = Number(item.hours) || 0;
    const rate = item.rate !== undefined ? Number(item.rate) : 40;
    return acc + (hrs * rate);
  }, 0);

  const totalLaborHours = timeLogs.reduce((acc, item) => acc + (Number(item.hours) || 0), 0);
  const totalJobCost = Number(materialCost) + totalLaborCost;
  const netProfit = Number(quotedPrice) - totalJobCost;
  const marginPercent = quotedPrice > 0 ? ((netProfit / quotedPrice) * 100).toFixed(1) : "0.0";

  const addTimeLog = () => {
    if (!workerName || !workerHours) return;
    const activeMember = teamMembers.find(m => m.name === workerName);
    const activeRate = activeMember ? activeMember.hourly_rate : 40;

    const updated = [...timeLogs, { 
      worker_name: workerName, 
      hours: parseFloat(workerHours), 
      rate: activeRate 
    }];

    setTimeLogs(updated);
    setWorkerHours("");
  };

  const removeTimeLog = (index) => {
    setTimeLogs(timeLogs.filter((_, i) => i !== index));
  };

  const saveJob = async () => {
    setSaving(true);
    const { error } = await supabase.from('jobs').update({
      customer_id: customerId || null,
      status,
      quoted_price: Number(quotedPrice),
      material_cost: Number(materialCost),
      time_logs: timeLogs,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      assigned_to: assignedTo,
      materials_needed: materialsNeeded,
      site_notes: siteNotes,
      photo_urls: photoUrls
    }).eq('id', id);

    setSaving(false);

    if (error) {
      alert("Error saving job: " + error.message);
      return;
    }
    navigate('/jobs');
  };

  const deleteJob = async () => {
    if (!window.confirm("Are you sure you want to delete this job? This cannot be undone.")) return;
    setSaving(true);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      alert("Error deleting job: " + error.message);
      setSaving(false);
    } else {
      navigate('/jobs');
    }
  };

  const pushToWave = async () => {
    setSyncingWave(true);
    try {
      const res = await fetch('/api/waveSync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          quotedPrice,
          notes: siteNotes || job.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        const { error } = await supabase.from('jobs').update({
          synced_to_wave: true,
          status: "Job Complete"
        }).eq('id', id);

        if (error) {
          alert("Wave synced, but failed to update status: " + error.message);
        } else {
          alert("Invoice successfully created in Wave & Job Saved!");
          setJob(prev => ({ ...prev, synced_to_wave: true, status: "Job Complete" }));
        }
      } else {
        alert("Wave Error: " + (data.error || "Failed to push to Wave"));
      }
    } catch (e) {
      alert("Wave sync error: " + e.message);
    }
    setSyncingWave(false);
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-main)' }}>Loading job details...</div>;
  if (!job) return <div style={{ padding: 20, color: 'var(--text-main)' }}>Job not found.</div>;

  const activeCustomer = customers.find(c => c.id === customerId);
  const propertyAddress = activeCustomer?.address || job.customers?.address || job.address;
  
  // Street View: scale=2 HD, fov=100 balanced frame, pitch=10 upward tilt for roofs
  const streetViewUrl = propertyAddress
    ? `https://maps.googleapis.com/maps/api/streetview?size=640x320&scale=2&location=${encodeURIComponent(propertyAddress)}&fov=100&pitch=10&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  // Satellite Overhead View: zoom=19 for close driveway inspection, scale=2 HD
  const satelliteUrl = propertyAddress
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(propertyAddress)}&zoom=19&size=640x320&scale=2&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  const activeHeaderImg = headerView === 'satellite' ? satelliteUrl : streetViewUrl;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 📷 HD Property Header with View Switcher */}
      {propertyAddress ? (
        <div style={{ marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border-color)', position: 'relative', height: 280, background: 'var(--bg-card)' }}>
          <img 
            src={activeHeaderImg} 
            alt="Property Header" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          
          <div style={{ position: 'absolute', bottom: 8, left: 12, background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 'bold' }}>
            📍 {propertyAddress}
          </div>

          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, background: 'rgba(0,0,0,0.75)', padding: 4, borderRadius: 8 }}>
            <button
              onClick={() => setHeaderView('street')}
              style={{
                background: headerView === 'street' ? 'var(--primary)' : 'transparent',
                color: headerView === 'street' ? 'var(--primary-text)' : '#fff',
                border: 'none',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🏠 Street View
            </button>
            <button
              onClick={() => setHeaderView('satellite')}
              style={{
                background: headerView === 'satellite' ? 'var(--primary)' : 'transparent',
                color: headerView === 'satellite' ? 'var(--primary-text)' : '#fff',
                border: 'none',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🛰️ Satellite Driveway
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 18, borderRadius: 10, padding: 14, border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13 }}>
          ⚠️ No address linked to this job yet. Select a customer below to load Street View.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: 20 }}>🛠️ {job.title}</h2>
        <button 
          onClick={deleteJob} 
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
        >
          🗑️ Delete Job
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>ASSIGNED CUSTOMER</p>
        <select 
          value={customerId} 
          onChange={e => setCustomerId(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }}
        >
          <option value="">-- No Customer Assigned --</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.address || 'No address'})</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB STATUS</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {["Lead", "Estimate Approved", "Scheduled", "In Progress", "Job Complete"].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                background: status === s ? 'var(--primary)' : 'var(--bg-input)',
                color: status === s ? 'var(--primary-text)' : 'var(--text-main)',
                border: '1.5px solid var(--border-color)',
                fontWeight: 'bold',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-main)' }}>📷 Site Photos & Notes</h3>
        
        <div style={{ marginBottom: 15 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Site Notes / Scope Memo</label>
          <textarea 
            rows="3" 
            value={siteNotes} 
            onChange={e => setSiteNotes(e.target.value)} 
            placeholder="No site notes provided..." 
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} 
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Job Photos ({photoUrls.length})</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {photoUrls.map((url, index) => (
              <img 
                key={index} 
                src={url} 
                alt={`site photo ${index + 1}`} 
                onClick={() => window.open(url, '_blank')} 
                style={{ width: 85, height: 85, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border-color)', cursor: 'pointer' }} 
              />
            ))}
            {photoUrls.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No photos uploaded for this job.</p>}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-main)' }}>📅 Scheduling & Material Prep</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, width: '100%', boxSizing: 'border-box' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Scheduled Date</label>
            <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', colorScheme: 'dark' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Scheduled Time</label>
            <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box', colorScheme: 'dark' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Assigned Crew</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
              <option value="Unassigned">⚠️ Unassigned</option>
              <option value="Both">Both Crew</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Materials Needed</label>
            <input placeholder="e.g. 100 Gal Sealer, 2 Bags Hot Pour" value={materialsNeeded} onChange={e => setMaterialsNeeded(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)' }}>⏱️ Job Labor Log</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Snapshotted Rates Per Log</span>
        </div>
        
        {timeLogs.map((log, i) => {
          const logRate = log.rate !== undefined ? log.rate : 40;
          const logCost = (log.hours * logRate).toFixed(2);
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 6, marginBottom: 8, fontSize: 14, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <span style={{ color: 'var(--text-main)' }}>
                👤 {log.worker_name} ({log.hours} hrs @ ${logRate}/hr)
              </span>
              <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                ${logCost} 
                <button onClick={() => removeTimeLog(i)} style={{ color: '#ef4444', background: 'none', border: 'none', marginLeft: 10, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </span>
            </div>
          );
        })}
        {timeLogs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No time logged yet.</p>}
        
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-color)', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
          <select 
            value={workerName} 
            onChange={e => setWorkerName(e.target.value)}
            style={{ flex: '1 1 130px', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }}
          >
            {teamMembers.map(m => (
              <option key={m.id} value={m.name}>{m.name} (${m.hourly_rate}/hr)</option>
            ))}
          </select>
          <input type="number" placeholder="Hours" value={workerHours} onChange={e => setWorkerHours(e.target.value)} style={{ flex: '1 1 70px', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} />
          <button onClick={addTimeLog} style={{ flex: '1 1 100px', padding: '10px 16px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', minHeight: 42, fontSize: 14 }}>+ Add</button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-main)' }}>💰 Cost & Revenue</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, width: '100%', boxSizing: 'border-box' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quoted Price ($)</label>
            <input type="number" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Material Costs ($)</label>
            <input type="number" value={materialCost} onChange={e => setMaterialCost(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {status === "Job Complete" && (
        <div style={{ background: 'var(--bg-card)', border: '2px solid var(--success)', padding: 18, borderRadius: 8, marginBottom: 20, boxSizing: 'border-box' }}>
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>✓ Job Completion Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LABOR ({totalLaborHours} hrs)</div>
              <strong style={{ color: 'var(--text-main)', fontSize: 15 }}>${totalLaborCost.toFixed(2)}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MATERIALS</div>
              <strong style={{ color: 'var(--text-main)', fontSize: 15 }}>${materialCost}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL COST</div>
              <strong style={{ color: 'var(--text-main)', fontSize: 15 }}>${totalJobCost.toFixed(2)}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NET PROFIT</div>
              <strong style={{ color: 'var(--success)', fontSize: 15 }}>${netProfit.toFixed(2)} ({marginPercent}%)</strong>
            </div>
          </div>

          <button onClick={pushToWave} disabled={syncingWave || job.synced_to_wave} style={{ marginTop: 15, width: '100%', padding: 12, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15, minHeight: 46 }}>
            {job.synced_to_wave ? "Invoiced in Wave ✓" : syncingWave ? "Sending to Wave..." : "Push Invoice to Wave"}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 30 }}>
        <button onClick={() => navigate('/jobs')} style={{ padding: '10px 18px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        <button onClick={saveJob} disabled={saving} style={{ padding: '10px 18px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          {saving ? "Saving..." : "Save Job Details"}
        </button>
      </div>
    </div>
  );
}
