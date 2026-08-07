import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function ManagerHub() {
  const [jobs, setJobs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unassigned');
  
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [assignWorker, setAssignWorker] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [dispatchTime, setDispatchTime] = useState('');
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (jobErr) console.error("Error fetching jobs:", jobErr);

    if (jobData) {
      const merged = jobData.map(j => ({ ...j, customers: custMap[j.customer_id] }));
      setJobs(merged);
    }

    const { data: teamData } = await supabase
      .from('team_members')
      .select('*')
      .order('name');

    if (teamData) {
      setTeamMembers(teamData);
      if (teamData.length > 0) setAssignWorker(teamData[0].name);
    }
    setLoading(false);
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedJobId || !assignWorker || !dispatchDate) {
      alert("Please select a job, worker, and dispatch date.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('jobs')
      .update({
        assigned_to: assignWorker,
        scheduled_date: dispatchDate,
        scheduled_time: dispatchTime || null,
        status: 'Scheduled',
        job_stage: 'Scheduled'
      })
      .eq('id', selectedJobId);

    setSaving(false);

    if (error) {
      alert("Error dispatching job: " + error.message);
    } else {
      setSelectedJobId(null);
      setDispatchDate('');
      setDispatchTime('');
      fetchData();
    }
  };

  const unassignedJobs = jobs.filter(j => 
    j.status !== 'Job Complete' && 
    (!j.assigned_to || j.assigned_to === 'Unassigned')
  );

  const dispatchedJobs = jobs.filter(j => 
    j.status !== 'Job Complete' && 
    j.assigned_to && 
    j.assigned_to !== 'Unassigned'
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: 20 }}>💼 Manager Dispatch Hub</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => setActiveTab('unassigned')} 
            style={{ 
              padding: '8px 14px', 
              borderRadius: 6, 
              border: '1.5px solid var(--border-color)', 
              background: activeTab === 'unassigned' ? 'var(--primary)' : 'var(--bg-card)', 
              color: activeTab === 'unassigned' ? 'var(--primary-text)' : 'var(--text-main)', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            ⚠️ Unassigned ({unassignedJobs.length})
          </button>
          <button 
            onClick={() => setActiveTab('dispatched')} 
            style={{ 
              padding: '8px 14px', 
              borderRadius: 6, 
              border: '1.5px solid var(--border-color)', 
              background: activeTab === 'dispatched' ? 'var(--primary)' : 'var(--bg-card)', 
              color: activeTab === 'dispatched' ? 'var(--primary-text)' : 'var(--text-main)', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            🚚 Dispatched / Scheduled ({dispatchedJobs.length})
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading dispatch hub...</p>
      ) : activeTab === 'unassigned' ? (
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: 16, marginBottom: 12 }}>Unassigned Queue</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {unassignedJobs.map(job => (
              <div key={job.id} style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div 
                    onClick={() => navigate(`/jobs/${job.id}`)} 
                    style={{ cursor: 'pointer', flex: 1 }}
                    title="Click to view full scope, site notes, & photos"
                  >
                    <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>
                      🛠️ {job.title} <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 'normal' }}>View Details →</span>
                    </strong>
                    {job.customers && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        👤 {job.customers.first_name} {job.customers.last_name} • 📍 {job.customers.address || job.address || 'No address'}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 'bold', marginTop: 4 }}>
                      Quote: ${job.quoted_price?.toLocaleString() || 0}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedJobId(selectedJobId === job.id ? null : job.id);
                    }}
                    style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {selectedJobId === job.id ? "Cancel" : "⚡ Dispatch Job"}
                  </button>
                </div>

                {selectedJobId === job.id && (
                  <form onSubmit={handleDispatch} style={{ marginTop: 15, paddingTop: 12, borderTop: '1px dashed var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>ASSIGN TO CREW</label>
                      <select value={assignWorker} onChange={e => setAssignWorker(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                        <option value="Both">Both Crews</option>
                        {teamMembers.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>DISPATCH DATE</label>
                      <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', colorScheme: 'dark' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>TIME (OPTIONAL)</label>
                      <input type="time" value={dispatchTime} onChange={e => setDispatchTime(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', colorScheme: 'dark' }} />
                    </div>

                    <button type="submit" disabled={saving} style={{ padding: '9px 12px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 36 }}>
                      {saving ? "Saving..." : "Confirm Dispatch"}
                    </button>
                  </form>
                )}
              </div>
            ))}

            {unassignedJobs.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No unassigned jobs in queue.</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h3 style={{ color: 'var(--text-main)', fontSize: 16, marginBottom: 12 }}>Dispatched & Scheduled Field Jobs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dispatchedJobs.map(job => (
              <div 
                key={job.id} 
                onClick={() => navigate(`/jobs/${job.id}`)}
                style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1.5px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                  {job.customers && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                      👤 {job.customers.first_name} {job.customers.last_name} • 📍 {job.customers.address || job.address || 'No address'}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 'bold', marginTop: 4 }}>
                    👤 Assigned: {job.assigned_to} • 📅 Scheduled: {job.scheduled_date || 'No Date'} {job.scheduled_time || ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>${job.quoted_price?.toLocaleString() || 0}</div>
                  <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border-color)', color: 'var(--text-main)', marginTop: 4, display: 'inline-block' }}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}

            {dispatchedJobs.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No dispatched jobs found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
