import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function AllJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    setLoading(true);
    const { data: custData } = await supabase.from('customers').select('*');
    const custMap = Object.fromEntries((custData || []).map(c => [c.id, c]));

    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching all jobs:", error);

    if (jobData) {
      const merged = jobData.map(j => ({ ...j, customers: custMap[j.customer_id] }));
      setJobs(merged);
    }
    setLoading(false);
  };

  const filteredJobs = jobs.filter(j => {
    const titleMatch = (j.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const custName = j.customers ? `${j.customers.first_name || ''} ${j.customers.last_name || ''}`.toLowerCase() : '';
    const custMatch = custName.includes(searchTerm.toLowerCase());
    const workerMatch = (j.assigned_to || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSearch = titleMatch || custMatch || workerMatch;

    if (filterStatus === 'All') return matchesSearch;
    return matchesSearch && j.status === filterStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: 20 }}>📋 Master Job Directory ({jobs.length})</h2>
      </div>

      <input 
        type="text" 
        placeholder="🔍 Search jobs by title, customer, or assigned worker..." 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, marginBottom: 15, boxSizing: 'border-box' }} 
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', 'Lead', 'Scheduled', 'In Progress', 'Job Complete'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1.5px solid var(--border-color)',
              background: filterStatus === status ? 'var(--primary)' : 'var(--bg-card)',
              color: filterStatus === status ? 'var(--primary-text)' : 'var(--text-main)',
              fontWeight: 'bold',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading master job list...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map(job => (
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
                <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 4 }}>
                  Assigned: <strong>{job.assigned_to || 'Unassigned'}</strong> {job.scheduled_date ? `• Date: ${job.scheduled_date}` : ''}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: 16 }}>${job.quoted_price?.toLocaleString() || 0}</div>
                <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border-color)', color: 'var(--text-main)', marginTop: 4, display: 'inline-block' }}>
                  {job.status}
                </span>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No jobs found matching your filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
