import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ManagerHub() {
  const [activeTab, setActiveTab] = useState('unassigned');
  const [jobs, setJobs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [dispatchState, setDispatchState] = useState({});
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: team } = await supabase.from('team_members').select('*').order('name');
    if (team) setTeamMembers(team);

    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });

    if (jobData) {
      const merged = jobData.map(j => ({ ...j, customers: custMap[j.customer_id] }));
      setJobs(merged);

      // Pre-fill dispatch state form values
      const initialForm = {};
      merged.forEach(j => {
        initialForm[j.id] = {
          assignedTo: j.assigned_to && j.assigned_to !== 'Unassigned' ? j.assigned_to : (team && team[0] ? team[0].name : 'Jason'),
          scheduledDate: j.scheduled_date || new Date().toISOString().split('T')[0],
          scheduledTime: j.scheduled_time || ''
        };
      });
      setDispatchState(initialForm);
    }

    setLoading(false);
  };

  const handleInputChange = (jobId, field, value) => {
    setDispatchState(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value
      }
    }));
  };

  const handleConfirmDispatch = async (jobId) => {
    const form = dispatchState[jobId];
    if (!form || !form.assignedTo) {
      alert("Please select a crew member to assign.");
      return;
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        assigned_to: form.assignedTo,
        scheduled_date: form.scheduledDate,
        scheduled_time: form.scheduledTime || null,
        status: 'Scheduled',
        job_stage: 'Scheduled'
      })
      .eq('id', jobId);

    if (error) {
      alert("Error dispatching job: " + error.message);
    } else {
      fetchData();
    }
  };

  const unassignedJobs = jobs.filter(j => !j.assigned_to || j.assigned_to === 'Unassigned' || j.status === 'Lead');
  const dispatchedJobs = jobs.filter(j => j.assigned_to && j.assigned_to !== 'Unassigned' && j.status !== 'Lead' && j.status !== 'Job Complete');

  if (loading) return <div style={{ color: 'var(--text-main)', padding: 20 }}>Loading dispatch queue...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>💼</span>
        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 20 }}>Manager Dispatch Hub</h2>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('unassigned')}
          style={{
            padding: '12px 10px',
            borderRadius: 8,
            border: '1.5px solid var(--border-color)',
            background: activeTab === 'unassigned' ? '#854d0e' : 'var(--bg-card)',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          ⚠️ Unassigned ({unassignedJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('dispatched')}
          style={{
            padding: '12px 10px',
            borderRadius: 8,
            border: '1.5px solid var(--border-color)',
            background: activeTab === 'dispatched' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'dispatched' ? 'var(--primary-text)' : 'var(--text-main)',
            fontWeight: 'bold',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          🚚 Dispatched ({dispatchedJobs.length})
        </button>
      </div>

      <h3 style={{ color: 'var(--text-main)', fontSize: 16, marginBottom: 15 }}>
        {activeTab === 'unassigned' ? 'Unassigned Queue' : 'Active Dispatched Jobs'}
      </h3>

      {/* Job Cards Queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(activeTab === 'unassigned' ? unassignedJobs : dispatchedJobs).map(job => {
          const cust = job.customers;
          const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'No Customer';
          const form = dispatchState[job.id] || {};

          return (
            <div
              key={job.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 10,
                border: '1.5px solid var(--border-color)',
                padding: 16,
                boxSizing: 'border-box'
              }}
            >
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 'bold', color: 'var(--text-main)' }}>
                    🛠️ {job.title}
                    <span 
                      onClick={() => navigate(`/jobs/${job.id}`)} 
                      style={{ fontSize: 12, color: 'var(--primary)', marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      View Details →
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    👤 {custName} {cust?.address || job.address ? `• 📍 ${cust?.address || job.address}` : ''}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 'bold', marginTop: 4 }}>
                    Quote: ${job.quoted_price?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-color)', opacity: 0.4, margin: '14px 0' }} />

              {/* Clean Structured Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      ASSIGN TO CREW
                    </label>
                    <select
                      value={form.assignedTo || ''}
                      onChange={e => handleInputChange(job.id, 'assignedTo', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 8px',
                        borderRadius: 6,
                        border: '1.5px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: 14,
                        boxSizing: 'border-box'
                      }}
                    >
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      DISPATCH DATE
                    </label>
                    <input
                      type="date"
                      value={form.scheduledDate || ''}
                      onChange={e => handleInputChange(job.id, 'scheduledDate', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 8px',
                        borderRadius: 6,
                        border: '1.5px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: 14,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    TIME (OPTIONAL)
                  </label>
                  <input
                    type="time"
                    value={form.scheduledTime || ''}
                    onChange={e => handleInputChange(job.id, 'scheduledTime', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 8px',
                      borderRadius: 6,
                      border: '1.5px solid var(--border-color)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  onClick={() => handleConfirmDispatch(job.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    minHeight: 46,
                    background: '#854d0e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    fontSize: 15,
                    cursor: 'pointer',
                    marginTop: 4
                  }}
                >
                  Confirm Dispatch
                </button>
              </div>
            </div>
          );
        })}

        {(activeTab === 'unassigned' ? unassignedJobs : dispatchedJobs).length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            {activeTab === 'unassigned' ? 'No unassigned jobs in the queue.' : 'No active dispatched jobs.'}
          </p>
        )}
      </div>
    </div>
  );
}
