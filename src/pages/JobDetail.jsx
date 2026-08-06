import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) {
      setJob(data);
      setStatus(data.status || "Lead");
      setQuotedPrice(data.quoted_price || 0);
      setMaterialCost(data.material_cost || 0);
      setTimeLogs(data.time_logs || []);
      setCustomerId(data.customer_id || "");
    }

    const { data: custData } = await supabase.from('customers').select('*').order('last_name');
    if (custData) setCustomers(custData);

    setLoading(false);
  };

  // Cost Calculations
  const totalLaborHours = timeLogs.reduce((acc, item) => acc + (Number(item.hours) || 0), 0);
  const totalLaborCost = totalLaborHours * 40; // $40/hr standard rate
  const totalJobCost = Number(materialCost) + totalLaborCost;
  const netProfit = Number(quotedPrice) - totalJobCost;
  const marginPercent = quotedPrice > 0 ? ((netProfit / quotedPrice) * 100).toFixed(1) : "0.0";

  const addTimeLog = () => {
    if (!workerName || !workerHours) return;
    const updated = [...timeLogs, { worker_name: workerName, hours: parseFloat(workerHours) }];
    setTimeLogs(updated);
    setWorkerName("");
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
      time_logs: timeLogs
    }).eq('id', id);

    setSaving(false);

    if (error) {
      alert("Error saving job: " + error.message);
      return;
    }

    navigate('/');
  };

  const deleteJob = async () => {
    if (!window.confirm("Are you sure you want to delete this job? This cannot be undone.")) return;
    setSaving(true);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      alert("Error deleting job: " + error.message);
      setSaving(false);
    } else {
      navigate('/');
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
          notes: job.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        const { error } = await supabase.from('jobs').update({
          synced_to_wave: true,
          customer_id: customerId || null,
          status,
          quoted_price: Number(quotedPrice),
          material_cost: Number(materialCost),
          time_logs: timeLogs
        }).eq('id', id);

        if (error) {
          alert("Wave synced, but failed to update status: " + error.message);
        } else {
          alert("Invoice successfully created in Wave & Job Saved!");
          setJob(prev => ({ ...prev, synced_to_wave: true, status }));
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text-main)', margin: 0 }}>🛠️ {job.title}</h2>
        <button 
          onClick={deleteJob} 
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
        >
          🗑️ Delete Job
        </button>
      </div>

      {/* Assign Customer Dropdown */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>ASSIGNED CUSTOMER</p>
        <select 
          value={customerId} 
          onChange={e => setCustomerId(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }}
        >
          <option value="">-- No Customer Assigned --</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.address || 'No address'})</option>
          ))}
        </select>
      </div>

      {/* Pipeline Selection */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB STATUS</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {["Lead", "Estimate Approved", "Scheduled", "In Progress", "Job Complete"].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                background: status === s ? 'var(--primary)' : 'var(--bg-input)',
                color: status === s ? 'var(--primary-text)' : 'var(--text-main)',
                border: '1.5px solid var(--border-color)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Time Tracking */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-main)' }}>⏱️ Employee Time Tracking ($40/hr)</h3>
        {timeLogs.map((log, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 6, marginBottom: 8, fontSize: 14, border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-main)' }}>{log.worker_name} ({log.hours} hrs)</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>${(log.hours * 40).toFixed(2)} <button onClick={() => removeTimeLog(i)} style={{ color: '#ef4444', background: 'none', border: 'none', marginLeft: 10, cursor: 'pointer', fontWeight: 'bold' }}>✕</button></span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input placeholder="Worker Name" value={workerName} onChange={e => setWorkerName(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', flex: 1 }} />
          <input type="number" placeholder="Hours" value={workerHours} onChange={e => setWorkerHours(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', width: 90 }} />
          <button onClick={addTimeLog} style={{ padding: '10px 18px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>+ Add</button>
        </div>
      </div>

      {/* Job Costs */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-main)' }}>💰 Cost & Revenue</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

      {/* Job Completion Summary */}
      {status === "Job Complete" && (
        <div style={{ background: 'var(--bg-card)', border: '2px solid var(--success)', padding: 18, borderRadius: 8, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>✓ Job Completion Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LABOR</div>
              <strong style={{ color: 'var(--text-main)' }}>${totalLaborCost}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MATERIALS</div>
              <strong style={{ color: 'var(--text-main)' }}>${materialCost}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL COST</div>
              <strong style={{ color: 'var(--text-main)' }}>${totalJobCost}</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NET PROFIT</div>
              <strong style={{ color: 'var(--success)' }}>${netProfit} ({marginPercent}%)</strong>
            </div>
          </div>

          <button onClick={pushToWave} disabled={syncingWave || job.synced_to_wave} style={{ marginTop: 15, width: '100%', padding: 12, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}>
            {job.synced_to_wave ? "Invoiced in Wave ✓" : syncingWave ? "Sending to Wave..." : "Push Invoice to Wave"}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={() => navigate('/')} style={{ padding: '10px 18px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        <button onClick={saveJob} disabled={saving} style={{ padding: '10px 18px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          {saving ? "Saving..." : "Save Job Details"}
        </button>
      </div>
    </div>
  );
}
