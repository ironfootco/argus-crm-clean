import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AllJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, customers(*)')
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching jobs:", error.message);
    if (data) setJobs(data);
    setLoading(false);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${month}/${day}/${year}`;
  };

  const filteredJobs = jobs.filter(job => {
    const titleMatch = (job.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const custName = job.customers ? `${job.customers.first_name || ''} ${job.customers.last_name || ''}`.toLowerCase() : '';
    const nameMatch = custName.includes(searchTerm.toLowerCase());
    const addrMatch = (job.customers?.address || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSearch = titleMatch || nameMatch || addrMatch;

    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Active') return matchesSearch && job.status !== 'Job Complete';
    if (statusFilter === 'Complete') return matchesSearch && job.status === 'Job Complete';
    if (statusFilter === 'Unscheduled') return matchesSearch && !job.scheduled_date && job.status !== 'Job Complete';
    
    return matchesSearch;
  });

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 20 }}>📋 Master Job Directory</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {filteredJobs.length} Jobs</span>
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input 
          placeholder="🔍 Search title, customer name, or address..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ flex: '1 1 220px', padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {["All", "Active", "Complete", "Unscheduled"].map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: statusFilter === tab ? 'var(--primary)' : 'var(--bg-card)',
                color: statusFilter === tab ? 'var(--primary-text)' : 'var(--text-main)',
                border: '1.5px solid var(--border-color)',
                fontWeight: 'bold',
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Job Snapshot List */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading job directory...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map(job => {
            const isComplete = job.status === 'Job Complete';
            const cust = job.customers;
            const custName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;
            const address = cust?.address || null;
            const timeLogs = job.time_logs || [];
            const totalLaborHours = timeLogs.reduce((acc, item) => acc + (Number(item.hours) || 0), 0);

            return (
              <div 
                key={job.id} 
                onClick={() => navigate(`/jobs/${job.id}`)}
                style={{ 
                  background: 'var(--bg-card)', 
                  padding: 16, 
                  borderRadius: 8, 
                  border: isComplete ? '1.5px solid var(--border-color)' : '2px solid var(--border-color)', 
                  cursor: 'pointer',
                  opacity: isComplete ? 0.9 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 17, color: 'var(--text-main)', display: 'block' }}>
                      🛠️ {job.title}
                    </strong>

                    {/* Customer Info */}
                    {custName && (
                      <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 'bold', marginTop: 4 }}>
                        👤 {custName} {cust?.phone ? `• 📞 ${cust.phone}` : ''}
                      </div>
                    )}

                    {/* Address */}
                    {address && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        📍 {address}
                      </div>
                    )}

                    {/* Job Details & Schedule */}
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isComplete ? (
                        <>
                          <span>📅 Scheduled: <strong>{formatDate(job.scheduled_date) || 'N/A'} {job.scheduled_time ? formatTime(job.scheduled_time) : ''}</strong></span>
                          <span>✅ Date Finished: <strong>{formatDate(job.updated_at)}</strong></span>
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>⏱️ Total Labor Time: {totalLaborHours.toFixed(1)} hrs</span>
                        </>
                      ) : (
                        <>
                          <span>Assigned: <strong>{job.assigned_to || 'Unassigned'}</strong></span>
                          {job.scheduled_date ? (
                            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                              📅 {formatDate(job.scheduled_date)} {job.scheduled_time ? `⏰ ${formatTime(job.scheduled_time)}` : ''}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--warning)', fontWeight: 'bold', background: 'rgba(249, 115, 22, 0.15)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--warning)' }}>
                              ⚠️ Unscheduled
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>
                      ${job.quoted_price?.toLocaleString()}
                    </div>
                    <span style={{ 
                      fontSize: 11, 
                      padding: '3px 8px', 
                      borderRadius: 12, 
                      background: isComplete ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)', 
                      color: isComplete ? 'var(--success)' : 'var(--text-accent)', 
                      fontWeight: 'bold', 
                      border: '1px solid var(--border-color)', 
                      marginTop: 4, 
                      display: 'inline-block' 
                    }}>
                      {job.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredJobs.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No jobs found matching "{searchTerm}".</p>
          )}
        </div>
      )}
    </div>
  );
}
