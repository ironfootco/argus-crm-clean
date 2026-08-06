import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AllJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const statuses = ["All", "Lead", "Estimate Approved", "Scheduled", "In Progress", "Job Complete"];

  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching jobs:", error.message);
    if (data) setJobs(data);
    setLoading(false);
  };

  // Filter and search logic
  const filteredJobs = jobs.filter(job => {
    const matchesStatus = filterStatus === 'All' || job.status === filterStatus;
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>📋 All Jobs Directory</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 'bold' }}>
          Showing {filteredJobs.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Search & Status Filters */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        {/* Search Input */}
        <input
          placeholder="🔍 Search jobs by title..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box', marginBottom: 15 }}
        />

        {/* Status Pill Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                background: filterStatus === status ? 'var(--primary)' : 'var(--bg-input)',
                color: filterStatus === status ? 'var(--primary-text)' : 'var(--text-main)',
                border: '1.5px solid var(--border-color)',
                fontWeight: 'bold',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading jobs...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map(job => (
            <div
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--border-color)' }}
            >
              <div>
                <strong style={{ fontSize: 17, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Status: {job.status || 'Lead'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
                {job.synced_to_wave && <span style={{ fontSize: 11, color: 'var(--text-accent)', fontWeight: 'bold' }}>Wave Synced ✓</span>}
              </div>
            </div>
          ))}
          {filteredJobs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>No jobs matching your filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
