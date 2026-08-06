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
    }
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
        // Save status, costs, and wave flag all at once
        const { error } = await supabase.from('jobs').update({
          synced_to_wave: true,
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

  if (loading) return <div style={{ padding: 20 }}>Loading job details...</div>;
  if (!job) return <div style={{ padding: 20 }}>Job not found.</div>;

  return (
    <div style={{ maxWidth: 700, margin: '20px auto', padding: 20, background: '#1f2937', borderRadius: 12, color: '#fff' }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginBottom: 15 }}>← Back to Dashboard</button>
      
      <h2>🛠️ {job.title}</h2>
      
      {/* Pipeline Selection */}
      <div style={{ background: '#374151', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#9ca3af' }}>JOB STATUS</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {["Lead", "Estimate Approved", "Scheduled", "In Progress", "Job Complete"].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                background: status === s ? '#2563eb' : '#4b5563',
                color: '#fff',
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
      <div style={{ background: '#374151', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>⏱️ Employee Time Tracking ($40/hr)</h3>
        {timeLogs.map((log, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#1f2937', padding: '8px 12px', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
            <span>{log.worker_name} ({log.hours} hrs)</span>
            <span>${(log.hours * 40).toFixed(2)} <button onClick={() => removeTimeLog(i)} style={{ color: '#ef4444', background: 'none', border: 'none', marginLeft: 10, cursor: 'pointer' }}>✕</button></span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input placeholder="Worker Name" value={workerName} onChange={e => setWorkerName(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #4b5563', background: '#1f2937', color: '#fff', flex: 1 }} />
          <input type="number" placeholder="Hours" value={workerHours} onChange={e => setWorkerHours(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #4b5563', background: '#1f2937', color: '#fff', width: 80 }} />
          <button onClick={addTimeLog} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>+ Add</button>
        </div>
      </div>

      {/* Job Costs */}
      <div style={{ background: '#374151', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>💰 Cost & Revenue</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: '#9ca3af' }}>Quoted Price ($)</label>
            <input type="number" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #4b5563', background: '#1f2937', color: '#fff' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#9ca3af' }}>Material Costs ($)</label>
            <input type="number" value={materialCost} onChange={e => setMaterialCost(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #4b5563', background: '#1f2937', color: '#fff' }} />
          </div>
        </div>
      </div>

      {/* Job Completion Performance Summary */}
      {status === "Job Complete" && (
        <div style={{ background: '#064e3b', border: '1px solid #10b981', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#34d399' }}>✓ Job Completion Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
            <div style={{ background: '#1f2937', padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>LABOR</div>
              <strong>${totalLaborCost}</strong>
            </div>
            <div style={{ background: '#1f2937', padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>MATERIALS</div>
              <strong>${materialCost}</strong>
            </div>
            <div style={{ background: '#1f2937', padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>TOTAL COST</div>
              <strong>${totalJobCost}</strong>
            </div>
            <div style={{ background: '#1f2937', padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#34d399' }}>NET PROFIT</div>
              <strong style={{ color: '#34d399' }}>${netProfit} ({marginPercent}%)</strong>
            </div>
          </div>

          <button onClick={pushToWave} disabled={syncingWave || job.synced_to_wave} style={{ marginTop: 15, width: '100%', padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
            {job.synced_to_wave ? "Invoiced in Wave ✓" : syncingWave ? "Sending to Wave..." : "Push Invoice to Wave"}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#4b5563', color: '#fff', border: 'none', borderRadius: 6 }}>Cancel</button>
        <button onClick={saveJob} disabled={saving} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
          {saving ? "Saving..." : "Save Job Details"}
        </button>
      </div>
    </div>
  );
}
