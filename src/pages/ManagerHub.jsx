import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ManagerHub() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Team Member Form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRate, setNewMemberRate] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Team Members
    const { data: teamData } = await supabase
      .from('team_members')
      .select('*')
      .order('name');

    if (teamData) setTeamMembers(teamData);

    // 2. Fetch Unassigned / Unscheduled Jobs
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Job Complete')
      .or('assigned_to.eq.Unassigned,assigned_to.is.null')
      .order('created_at', { ascending: false });

    if (jobData) setUnassignedJobs(jobData);

    // 3. Fetch Timesheets for Payroll Overview
    const { data: timeData } = await supabase
      .from('timesheets')
      .select('*')
      .order('clock_in', { ascending: false })
      .limit(20);

    if (timeData) setTimesheets(timeData);

    setLoading(false);
  };

  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!newMemberName || !newMemberRate) return;
    setSavingMember(true);

    const { error } = await supabase.from('team_members').insert([{
      name: newMemberName.trim(),
      hourly_rate: parseFloat(newMemberRate) || 0
    }]);

    setSavingMember(false);

    if (error) {
      alert("Error adding team member: " + error.message);
      return;
    }

    setNewMemberName('');
    setNewMemberRate('');
    fetchData();
  };

  const handleUpdateRate = async (id, currentRate) => {
    const newRate = prompt("Enter new hourly rate ($):", currentRate);
    if (!newRate || isNaN(newRate)) return;

    const { error } = await supabase
      .from('team_members')
      .update({ hourly_rate: parseFloat(newRate) })
      .eq('id', id);

    if (error) {
      alert("Error updating rate: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleAssignJob = async (jobId, assignedTo, scheduledDate, scheduledTime) => {
    const { error } = await supabase.from('jobs').update({
      assigned_to: assignedTo,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null
    }).eq('id', jobId);

    if (error) {
      alert("Error dispatching job: " + error.message);
    } else {
      fetchData();
    }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-main)' }}>Loading Manager Hub...</div>;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ color: 'var(--text-main)', margin: '0 0 20px 0', fontSize: 20 }}>💼 Manager Hub</h2>

      {/* Team & Payroll Rates Control Card */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--text-main)' }}>👥 Team & Hourly Payroll Rates</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 15px 0' }}>
          Changing a rate updates all future job labor logs. Completed and existing job margins remain locked to their historical rate snapshots.
        </p>

        {/* Existing Team Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
          {teamMembers.map(member => (
            <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '12px 14px', borderRadius: 6, border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>👤 {member.name}</strong>
                <span style={{ marginLeft: 12, fontSize: 14, color: 'var(--success)', fontWeight: 'bold' }}>
                  ${member.hourly_rate?.toFixed(2)} / hr
                </span>
              </div>

              <button 
                onClick={() => handleUpdateRate(member.id, member.hourly_rate)}
                style={{ background: 'var(--bg-card)', color: 'var(--text-accent)', border: '1.5px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}
              >
                ✏️ Edit Pay Rate
              </button>
            </div>
          ))}
        </div>

        {/* Add New Team Member Form */}
        <form onSubmit={handleAddTeamMember} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
          <input 
            placeholder="New Worker Name" 
            value={newMemberName} 
            onChange={e => setNewMemberName(e.target.value)} 
            style={{ flex: '1 1 150px', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} 
          />
          <input 
            type="number" 
            placeholder="Rate ($/hr)" 
            value={newMemberRate} 
            onChange={e => setNewMemberRate(e.target.value)} 
            style={{ flex: '1 1 100px', padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box' }} 
          />
          <button 
            type="submit" 
            disabled={savingMember} 
            style={{ flex: '1 1 110px', padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, minHeight: 42 }}
          >
            {savingMember ? "Saving..." : "+ Add Worker"}
          </button>
        </form>
      </div>

      {/* Dispatch Panel: Unassigned Jobs */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--warning)' }}>⚠️ Dispatch Pending Leads / Unassigned Jobs ({unassignedJobs.length})</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {unassignedJobs.map(job => (
            <div key={job.id} style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${job.quoted_price?.toLocaleString()}</span>
              </div>

              {job.site_notes && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                  📝 Scope: {job.site_notes}
                </div>
              )}

              {/* Quick Dispatch Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Assign Crew</label>
                  <select 
                    defaultValue={job.assigned_to || "Unassigned"} 
                    id={`crew-${job.id}`}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13 }}
                  >
                    <option value="Unassigned">⚠️ Unassigned</option>
                    <option value="Both">Both Crew</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Date</label>
                  <input type="date" id={`date-${job.id}`} defaultValue={job.scheduled_date || ""} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, colorScheme: 'dark', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Time</label>
                  <input type="time" id={`time-${job.id}`} defaultValue={job.scheduled_time || ""} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, colorScheme: 'dark', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    onClick={() => {
                      const crew = document.getElementById(`crew-${job.id}`).value;
                      const date = document.getElementById(`date-${job.id}`).value;
                      const time = document.getElementById(`time-${job.id}`).value;
                      handleAssignJob(job.id, crew, date, time);
                    }}
                    style={{ width: '100%', padding: 9, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}
                  >
                    🚀 Dispatch
                  </button>
                </div>
              </div>
            </div>
          ))}

          {unassignedJobs.length === 0 && <p style={{ color: 'var(--text-muted)', margin: 0 }}>All jobs are assigned and dispatched!</p>}
        </div>
      </div>

      {/* Recent Timesheets Audit Log */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, border: '2px solid var(--border-color)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--text-main)' }}>⏱️ Recent Shift Clock History</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timesheets.map(ts => (
            <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }}>
              <span>👤 <strong>{ts.worker_name}</strong> - {new Date(ts.clock_in).toLocaleDateString()}</span>
              <span>
                {ts.clock_out ? (
                  <strong style={{ color: 'var(--success)' }}>{ts.total_hours} hrs</strong>
                ) : (
                  <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>🟢 Currently Clocked In</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
