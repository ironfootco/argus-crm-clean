import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ManagerHub() {
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'payroll'
  
  // Data States
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState({});
  const [timesheets, setTimesheets] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Job Modal State
  const [editingJob, setEditingJob] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  // Manual Shift State
  const [manualWorker, setManualWorker] = useState('Jason');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualInTime, setManualInTime] = useState('08:00');
  const [manualOutTime, setManualOutTime] = useState('16:30');
  const [submittingManual, setSubmittingManual] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Customers
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));
    setCustomers(custMap);

    // 2. Fetch Jobs
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .order('scheduled_date', { ascending: true, nullsFirst: true });
    if (jobData) setJobs(jobData);

    // 3. Fetch Team Members
    const { data: teamData } = await supabase.from('team_members').select('*').order('name');
    if (teamData) setTeamMembers(teamData);

    // 4. Fetch Timesheets
    const { data: timeData } = await supabase.from('timesheets').select('*').order('clock_in', { ascending: false });
    if (timeData) setTimesheets(timeData);

    setLoading(false);
  };

  // Quick Assign
  const handleAssignChange = async (jobId, assignedTo) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, assigned_to: assignedTo } : j));
    await supabase.from('jobs').update({ assigned_to: assignedTo }).eq('id', jobId);
  };

  // Quick Schedule Date & Time
  const handleScheduleChange = async (jobId, field, value) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, [field]: value } : j));
    await supabase.from('jobs').update({ [field]: value }).eq('id', jobId);
  };

  // Delete Job
  const handleDeleteJob = async (jobId, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    setJobs(jobs.filter(j => j.id !== jobId));
    await supabase.from('jobs').delete().eq('id', jobId);
  };

  // Save Full Job Edit
  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);

    const { error } = await supabase
      .from('jobs')
      .update({
        title: editingJob.title,
        service_type: editingJob.service_type,
        quoted_price: parseFloat(editingJob.quoted_price) || 0,
        assigned_to: editingJob.assigned_to,
        scheduled_date: editingJob.scheduled_date || null,
        scheduled_time: editingJob.scheduled_time || null,
        materials_needed: editingJob.materials_needed || '',
        site_notes: editingJob.site_notes || '',
        status: editingJob.status,
        job_stage: editingJob.job_stage
      })
      .eq('id', editingJob.id);

    if (error) {
      alert("Error saving job: " + error.message);
    } else {
      fetchData();
      setEditingJob(null);
    }
    setSavingJob(false);
  };

  const handleForceClockOut = async (shift) => {
    const clockInTime = new Date(shift.clock_in);
    const clockOutTime = new Date();
    const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    await supabase
      .from('timesheets')
      .update({ clock_out: clockOutTime.toISOString(), total_hours: hours })
      .eq('id', shift.id);

    fetchData();
  };

  const handleDeleteTimesheet = async (id) => {
    if (!window.confirm("Delete this timesheet entry?")) return;
    await supabase.from('timesheets').delete().eq('id', id);
    fetchData();
  };

  const handleAddManualShift = async (e) => {
    e.preventDefault();
    setSubmittingManual(true);

    try {
      const clockIn = new Date(`${manualDate}T${manualInTime}:00`);
      const clockOut = new Date(`${manualDate}T${manualOutTime}:00`);
      const hours = parseFloat(((clockOut - clockIn) / (1000 * 60 * 60)).toFixed(2));

      if (hours <= 0) {
        alert("Clock-out time must be after clock-in time.");
        setSubmittingManual(false);
        return;
      }

      await supabase.from('timesheets').insert([{
        worker_name: manualWorker,
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        total_hours: hours
      }]);

      fetchData();
      alert("Shift added!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  const getWorkerPayroll = (workerName) => {
    const workerShifts = timesheets.filter(t => t.worker_name === workerName && t.total_hours);
    const totalHours = workerShifts.reduce((acc, t) => acc + (parseFloat(t.total_hours) || 0), 0);
    const member = teamMembers.find(m => m.name === workerName);
    const rate = member ? member.hourly_rate || 40 : 40;
    const grossPay = totalHours * rate;

    return { totalHours: totalHours.toFixed(2), rate, grossPay: grossPay.toFixed(2) };
  };

  const activeShifts = timesheets.filter(t => !t.clock_out);

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Manager Hub...</div>;
  }

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      
      {/* MANAGER HUB HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--text-accent)', margin: '0 0 4px 0', fontSize: 22 }}>💼 Manager Control Center</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Schedule jobs, assign crews, edit leads, and manage payroll.</p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('jobs')}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'jobs' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'jobs' ? 'var(--primary-text)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            📋 Job Dispatch ({jobs.length})
          </button>
          <button 
            onClick={() => setActiveTab('payroll')}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'payroll' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'payroll' ? 'var(--primary-text)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            💰 Payroll & Timecards
          </button>
        </div>
      </div>

      {/* TAB 1: JOB DISPATCH, ASSIGN, SCHEDULE & EDIT */}
      {activeTab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jobs.map(job => {
            const cust = customers[job.customer_id];
            const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;

            return (
              <div 
                key={job.id} 
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '2px solid var(--border-color)', 
                  borderRadius: 8, 
                  padding: 16 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-main)' }}>🛠️ {job.title}</h3>
                    {custName && (
                      <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 'bold', marginTop: 3 }}>
                        👤 {custName} {cust?.phone ? `• 📞 ${cust.phone}` : ''}
                      </div>
                    )}
                    {cust?.address && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        📍 {cust.address}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--success)' }}>
                      ${job.quoted_price?.toLocaleString()}
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', display: 'inline-block', marginTop: 4 }}>
                      Stage: {job.job_stage || job.status || 'Lead'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>ASSIGN CREW</label>
                    <select 
                      value={job.assigned_to || 'Unassigned'} 
                      onChange={(e) => handleAssignChange(job.id, e.target.value)}
                      style={{ width: '100%', padding: 6, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, fontWeight: 'bold' }}
                    >
                      <option value="Unassigned">⚠️ Unassigned</option>
                      <option value="Jason">Jason</option>
                      <option value="Edwin">Edwin</option>
                      <option value="Both">Both (Jason & Edwin)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>SCHEDULE DATE</label>
                    <input 
                      type="date" 
                      value={job.scheduled_date || ''} 
                      onChange={(e) => handleScheduleChange(job.id, 'scheduled_date', e.target.value)}
                      style={{ width: '100%', padding: 5, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>SCHEDULE TIME</label>
                    <input 
                      type="time" 
                      value={job.scheduled_time || ''} 
                      onChange={(e) => handleScheduleChange(job.id, 'scheduled_time', e.target.value)}
                      style={{ width: '100%', padding: 5, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button 
                      onClick={() => setEditingJob(job)} 
                      style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '7px 12px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteJob(job.id, job.title)} 
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '7px 10px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: PAYROLL & TIMECARDS */}
      {activeTab === 'payroll' && (
        <div>
          {activeShifts.length > 0 && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '2px solid var(--success)', padding: 14, borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)', fontSize: 15 }}>🟢 Currently Clocked In ({activeShifts.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeShifts.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>👤 {s.worker_name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        Clocked in at {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button onClick={() => handleForceClockOut(s)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                      🛑 Force Clock Out
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
            {['Jason', 'Edwin'].map(worker => {
              const stats = getWorkerPayroll(worker);
              return (
                <div key={worker} style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: 17 }}>👤 {worker}</h3>
                    <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      ${stats.rate}/hr
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg-input)', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold' }}>HOURS</div>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2 }}>{stats.totalHours} hrs</div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold' }}>GROSS PAY</div>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--success)', marginTop: 2 }}>${stats.grossPay}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)', fontSize: 14 }}>➕ Add Manual Shift Entry</h4>
            <form onSubmit={handleAddManualShift} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>WORKER</label>
                <select value={manualWorker} onChange={e => setManualWorker(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                  <option value="Jason">Jason</option>
                  <option value="Edwin">Edwin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>DATE</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required style={{ width: '100%', padding: 5, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>CLOCK IN</label>
                <input type="time" value={manualInTime} onChange={e => setManualInTime(e.target.value)} required style={{ width: '100%', padding: 5, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 2 }}>CLOCK OUT</label>
                <input type="time" value={manualOutTime} onChange={e => setManualOutTime(e.target.value)} required style={{ width: '100%', padding: 5, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={submittingManual} style={{ padding: '7px 14px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>
                Add
              </button>
            </form>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: 15 }}>📋 Shift History ({timesheets.length})</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-accent)', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Worker</th>
                    <th style={{ padding: '6px' }}>Date</th>
                    <th style={{ padding: '6px' }}>In</th>
                    <th style={{ padding: '6px' }}>Out</th>
                    <th style={{ padding: '6px' }}>Hours</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>👤 {t.worker_name}</td>
                      <td style={{ padding: '8px' }}>{new Date(t.clock_in).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }}>{new Date(t.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '8px' }}>{t.clock_out ? new Date(t.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '🟢 Active'}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--text-accent)' }}>{t.total_hours ? `${t.total_hours} hrs` : '--'}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteTimesheet(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {editingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>✏️ Edit Job Details</h3>
              <button onClick={() => setEditingJob(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB TITLE</label>
                <input value={editingJob.title} onChange={e => setEditingJob({ ...editingJob, title: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>QUOTED PRICE ($)</label>
                  <input type="number" value={editingJob.quoted_price || ''} onChange={e => setEditingJob({ ...editingJob, quoted_price: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ASSIGNED CREW</label>
                  <select value={editingJob.assigned_to || 'Unassigned'} onChange={e => setEditingJob({ ...editingJob, assigned_to: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
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
                  <input type="date" value={editingJob.scheduled_date || ''} onChange={e => setEditingJob({ ...editingJob, scheduled_date: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SCHEDULE TIME</label>
                  <input type="time" value={editingJob.scheduled_time || ''} onChange={e => setEditingJob({ ...editingJob, scheduled_time: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS</label>
                  <select value={editingJob.status || 'Lead'} onChange={e => setEditingJob({ ...editingJob, status: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                    <option value="Lead">Lead</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Job Complete">Job Complete</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STAGE</label>
                  <select value={editingJob.job_stage || 'Scheduled'} onChange={e => setEditingJob({ ...editingJob, job_stage: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
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
                <input value={editingJob.materials_needed || ''} onChange={e => setEditingJob({ ...editingJob, materials_needed: e.target.value })} placeholder="e.g. 2x4s, Sealant, Pressure Washer" style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE & PROJECT NOTES</label>
                <textarea rows="3" value={editingJob.site_notes || ''} onChange={e => setEditingJob({ ...editingJob, site_notes: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingJob(null)} style={{ flex: 1, padding: 10, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
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
