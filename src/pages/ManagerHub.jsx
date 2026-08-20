import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Helper to find the Monday of a given date (for grouping)
const getWeekKey = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // If Sunday (0), go back 6 days to Monday. Otherwise, go back (day - 1) days.
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

export default function ManagerHub() {
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'archive' | 'payroll'
  
  // Data States
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState({});
  const [timesheets, setTimesheets] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Job Modal State
  const [editingJob, setEditingJob] = useState(null);
  const [editCustomerForm, setEditCustomerForm] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  // Broken out address fields for the modal
  const [editStreet, setEditStreet] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('MA');
  const [editZip, setEditZip] = useState('');

  // Manual Shift State
  const [manualWorker, setManualWorker] = useState('Jason');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualInTime, setManualInTime] = useState('08:00');
  const [manualOutTime, setManualOutTime] = useState('16:30');
  const [submittingManual, setSubmittingManual] = useState(false);

  // NEW: State for collapsible weekly shift history
  const [expandedWeeks, setExpandedWeeks] = useState({});

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
    if (timeData) {
      setTimesheets(timeData);
      // Auto-expand the most recent week by default
      if (timeData.length > 0) {
        const mostRecentWeek = getWeekKey(timeData[0].clock_in);
        setExpandedWeeks({ [mostRecentWeek]: true });
      }
    }

    setLoading(false);
  };

  // Group timesheets by Week (Monday - Sunday)
  const groupedShifts = timesheets.reduce((acc, shift) => {
    const weekKey = getWeekKey(shift.clock_in);
    if (!acc[weekKey]) acc[weekKey] = [];
    acc[weekKey].push(shift);
    return acc;
  }, {});

  // Sort weeks descending (newest week first)
  const sortedWeeks = Object.keys(groupedShifts).sort((a, b) => new Date(b) - new Date(a));

  const toggleWeek = (week) => {
    setExpandedWeeks(prev => ({ ...prev, [week]: !prev[week] }));
  };

  // Derived Job Lists for Dispatch vs Archive
  const activeJobs = jobs.filter(j => j.status !== 'Paid');
  const archivedJobs = jobs.filter(j => j.status === 'Paid');

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

  // 🎯 Auto-formats phone number in the edit modal
  const handleEditPhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '');
    let formatted = input;
    if (input.length > 0) {
      if (input.length <= 3) {
        formatted = `(${input}`;
      } else if (input.length <= 6) {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
      } else {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`;
      }
    }
    setEditCustomerForm({ ...editCustomerForm, phone: formatted });
  };

  // Save Full Job & Customer Edit
  const handleSaveJobEdit = async (e) => {
    e.preventDefault();
    setSavingJob(true);

    const fullAddress = [editStreet, editUnit, editCity, editState ? `${editState} ${editZip}`.trim() : editZip]
      .filter(Boolean)
      .join(', ');

    const { error: jobError } = await supabase
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
        job_stage: editingJob.status 
      })
      .eq('id', editingJob.id);

    let custError = null;
    if (editingJob.customer_id && editCustomerForm) {
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editCustomerForm.first_name,
          last_name: editCustomerForm.last_name,
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          address: fullAddress,
          sms_opt_in: editCustomerForm.sms_opt_in
        })
        .eq('id', editingJob.customer_id);
      custError = error;
    }

    if (jobError || custError) {
      alert("Error saving details.");
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

  const displayedJobs = activeTab === 'jobs' ? activeJobs : archivedJobs;

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      
      {/* MANAGER HUB HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        <div style={{ flex: '1 1 250px' }}>
          <h2 style={{ color: 'var(--text-accent)', margin: '0 0 4px 0', fontSize: 22 }}>💼 Manager Control Center</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Schedule jobs, assign crews, edit leads, and manage payroll.</p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
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
            📋 Job Dispatch ({activeJobs.length})
          </button>
          <button 
            onClick={() => setActiveTab('archive')}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'archive' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'archive' ? 'var(--primary-text)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            🗄️ Archive ({archivedJobs.length})
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

      {/* TAB 1 & 2: JOB DISPATCH OR ARCHIVE */}
      {(activeTab === 'jobs' || activeTab === 'archive') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {displayedJobs.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', padding: 30, borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
              {activeTab === 'jobs' ? 'No active jobs right now.' : 'No paid jobs in the archive yet.'}
            </div>
          ) : (
            displayedJobs.map(job => {
              const cust = customers[job.customer_id];
              const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;

              return (
                <div 
                  key={job.id} 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '2px solid var(--border-color)', 
                    borderRadius: 8, 
                    padding: 16,
                    opacity: activeTab === 'archive' ? 0.85 : 1 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-main)' }}>🛠️ {job.title}</h3>
                      {custName && (
                        <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 'bold', marginTop: 3 }}>
                          👤 {custName} 
                          {cust?.phone ? ` • 📞 ${cust.phone}` : ''}
                          {cust?.sms_opt_in !== undefined && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: cust.sms_opt_in ? 'var(--success)' : 'var(--text-muted)' }}>
                              {cust.sms_opt_in ? '✅ SMS: Yes' : '🔕 SMS: No'}
                            </span>
                          )}
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
                        Status: {job.status || 'Lead'}
                      </span>
                    </div>
                  </div>

                  {/* RESPONSIVE DISPATCH CONTROLS */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 120px' }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>ASSIGN CREW</label>
                      <select 
                        value={job.assigned_to || 'Unassigned'} 
                        onChange={(e) => handleAssignChange(job.id, e.target.value)}
                        style={{ width: '100%', padding: 8, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, fontWeight: 'bold' }}
                      >
                        <option value="Unassigned">⚠️ Unassigned</option>
                        <option value="Jason">Jason</option>
                        <option value="Edwin">Edwin</option>
                        <option value="Both">Both (Jason & Edwin)</option>
                      </select>
                    </div>

                    <div style={{ flex: '1 1 120px' }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SCHEDULE DATE</label>
                      <input 
                        type="date" 
                        value={job.scheduled_date || ''} 
                        onChange={(e) => handleScheduleChange(job.id, 'scheduled_date', e.target.value)}
                        style={{ width: '100%', padding: 7, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ flex: '1 1 120px' }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SCHEDULE TIME</label>
                      <input 
                        type="time" 
                        value={job.scheduled_time || ''} 
                        onChange={(e) => handleScheduleChange(job.id, 'scheduled_time', e.target.value)}
                        style={{ width: '100%', padding: 7, borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 6, flex: '1 1 auto', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => {
                          setEditingJob(job);
                          const customerInfo = customers[job.customer_id];
                          setEditCustomerForm(customerInfo || { first_name: '', last_name: '', phone: '', email: '', address: '', sms_opt_in: true });
                          
                          const addressToParse = customerInfo?.address || '';
                          if (addressToParse) {
                            const parts = addressToParse.split(',').map(p => p.trim());
                            if (parts.length === 1) {
                                setEditStreet(parts[0]);
                                setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
                            } else if (parts.length === 3) {
                                setEditStreet(parts[0]);
                                setEditCity(parts[1]);
                                const sz = parts[2].split(' ');
                                setEditState(sz[0] || 'MA');
                                setEditZip(sz[1] || '');
                                setEditUnit('');
                            } else if (parts.length >= 4) {
                                setEditStreet(parts[0]);
                                setEditUnit(parts[1]);
                                setEditCity(parts[2]);
                                const sz = parts[3].split(' ');
                                setEditState(sz[0] || 'MA');
                                setEditZip(sz[1] || '');
                            } else {
                                setEditStreet(addressToParse);
                                setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
                            }
                          } else {
                            setEditStreet(''); setEditUnit(''); setEditCity(''); setEditState('MA'); setEditZip('');
                          }
                        }} 
                        style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '8px 14px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteJob(job.id, job.title)} 
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: PAYROLL & TIMECARDS */}
      {activeTab === 'payroll' && (
        <div>
          {activeShifts.length > 0 && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '2px solid var(--success)', padding: 14, borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)', fontSize: 15 }}>🟢 Currently Clocked In ({activeShifts.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeShifts.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>👤 {s.worker_name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        Clocked in at {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button onClick={() => handleForceClockOut(s)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                      🛑 Force Clock Out
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 15, marginBottom: 20 }}>
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
            <form onSubmit={handleAddManualShift} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>WORKER</label>
                <select value={manualWorker} onChange={e => setManualWorker(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13 }}>
                  <option value="Jason">Jason</option>
                  <option value="Edwin">Edwin</option>
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>DATE</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required style={{ width: '100%', padding: 7, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>CLOCK IN</label>
                <input type="time" value={manualInTime} onChange={e => setManualInTime(e.target.value)} required style={{ width: '100%', padding: 7, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>CLOCK OUT</label>
                <input type="time" value={manualOutTime} onChange={e => setManualOutTime(e.target.value)} required style={{ width: '100%', padding: 7, borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={submittingManual} style={{ flex: '1 1 100px', padding: '9px 14px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}>
                Add
              </button>
            </form>
          </div>

          {/* 🎯 NEW: GROUPED SHIFT HISTORY */}
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: 15 }}>📋 Shift History (Grouped by Week)</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedWeeks.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No shifts recorded yet.</div>
              ) : (
                sortedWeeks.map(weekKey => {
                  const shifts = groupedShifts[weekKey];
                  const weekTotal = shifts.reduce((sum, s) => sum + (parseFloat(s.total_hours) || 0), 0);
                  const isExpanded = expandedWeeks[weekKey];

                  // Safely parse the YYYY-MM-DD back into local dates for the label
                  const [year, month, day] = weekKey.split('-');
                  const localMonday = new Date(year, month - 1, day);
                  const localSunday = new Date(year, month - 1, parseInt(day) + 6);
                  
                  const labelStr = `${localMonday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${localSunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

                  return (
                    <div key={weekKey} style={{ border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
                      {/* Accordion Header */}
                      <div 
                        onClick={() => toggleWeek(weekKey)}
                        style={{ background: 'var(--bg-input)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
                          <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>Week of {labelStr}</strong>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--primary)' }}>
                          {weekTotal.toFixed(2)} hrs
                        </div>
                      </div>

                      {/* Accordion Content (The Table) */}
                      {isExpanded && (
                        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-accent)', textAlign: 'left', background: 'rgba(0,0,0,0.1)' }}>
                                <th style={{ padding: '8px 12px', minWidth: '90px' }}>Worker</th>
                                <th style={{ padding: '8px 12px', minWidth: '90px' }}>Date</th>
                                <th style={{ padding: '8px 12px', minWidth: '80px' }}>In</th>
                                <th style={{ padding: '8px 12px', minWidth: '80px' }}>Out</th>
                                <th style={{ padding: '8px 12px', minWidth: '80px' }}>Hours</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shifts.map((t, idx) => (
                                <tr key={t.id} style={{ borderBottom: idx === shifts.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>👤 {t.worker_name}</td>
                                  <td style={{ padding: '10px 12px' }}>{new Date(t.clock_in).toLocaleDateString()}</td>
                                  <td style={{ padding: '10px 12px' }}>{new Date(t.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td style={{ padding: '10px 12px' }}>{t.clock_out ? new Date(t.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '🟢 Active'}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-accent)' }}>{t.total_hours ? `${t.total_hours} hrs` : '--'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteTimesheet(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {editingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, width: '100%', maxWidth: 520, padding: 20, color: 'var(--text-main)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--primary)' }}>✏️ Edit Job Details</h3>
              <button onClick={() => setEditingJob(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* JOB FIELDS */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>JOB TITLE</label>
                <input value={editingJob.title} onChange={e => setEditingJob({ ...editingJob, title: e.target.value })} required style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>

              {/* CUSTOMER INFO FIELDS */}
              {editCustomerForm && (
                <div style={{ marginTop: 6, padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-accent)' }}>👤 EDIT CUSTOMER DETAILS</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>FIRST NAME</label>
                      <input value={editCustomerForm.first_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, first_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>LAST NAME</label>
                      <input value={editCustomerForm.last_name || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, last_name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>PHONE</label>
                      <input value={editCustomerForm.phone || ''} onChange={handleEditPhoneChange} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>EMAIL</label>
                      <input value={editCustomerForm.email || ''} onChange={e => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  {/* BROKEN OUT ADDRESS FIELDS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 4 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STREET ADDRESS</label>
                      <input value={editStreet} onChange={e => setEditStreet(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>UNIT / APT</label>
                      <input value={editUnit} onChange={e => setEditUnit(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginTop: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>CITY</label>
                      <input value={editCity} onChange={e => setEditCity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATE</label>
                      <input value={editState} onChange={e => setEditState(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ZIP CODE</label>
                      <input value={editZip} onChange={e => setEditZip(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SMS OPT-IN</label>
                    <select 
                      value={editCustomerForm.sms_opt_in ? 'true' : 'false'} 
                      onChange={e => setEditCustomerForm({ ...editCustomerForm, sms_opt_in: e.target.value === 'true' })} 
                      style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>QUOTED PRICE ($)</label>
                  <input type="number" value={editingJob.quoted_price || ''} onChange={e => setEditingJob({ ...editingJob, quoted_price: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>ASSIGNED CREW</label>
                  <select value={editingJob.assigned_to || 'Unassigned'} onChange={e => setEditingJob({ ...editingJob, assigned_to: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                    <option value="Unassigned">⚠️ Unassigned</option>
                    <option value="Jason">Jason</option>
                    <option value="Edwin">Edwin</option>
                    <option value="Both">Both (Jason & Edwin)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SCHEDULE DATE</label>
                  <input type="date" value={editingJob.scheduled_date || ''} onChange={e => setEditingJob({ ...editingJob, scheduled_date: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SCHEDULE TIME</label>
                  <input type="time" value={editingJob.scheduled_time || ''} onChange={e => setEditingJob({ ...editingJob, scheduled_time: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>STATUS</label>
                <select value={editingJob.status || 'Lead'} onChange={e => setEditingJob({ ...editingJob, status: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                  <option value="Lead">Lead</option>
                  <option value="Estimate Sent">Estimate Sent</option>
                  <option value="Estimate Approved">Estimate Approved</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="En Route">En Route</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Job Complete">Job Complete</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>MATERIALS / TOOLS NEEDED</label>
                <textarea 
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                  value={editingJob.materials_needed || ''} 
                  onChange={e => {
                    setEditingJob({ ...editingJob, materials_needed: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }} 
                  placeholder="e.g. 2x4s, Sealant, Pressure Washer" 
                  style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: '60px', resize: 'vertical' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>SITE & PROJECT NOTES</label>
                <textarea 
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                  value={editingJob.site_notes || ''} 
                  onChange={e => {
                    setEditingJob({ ...editingJob, site_notes: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }} 
                  style={{ width: '100%', padding: 10, borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: '120px', resize: 'vertical' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingJob(null)} style={{ flex: 1, padding: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={savingJob} style={{ flex: 1.5, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
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
