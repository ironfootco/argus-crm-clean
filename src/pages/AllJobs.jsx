import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AllJobs() {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'

  useEffect(() => {
    fetchJobsAndCustomers();
  }, []);

  const fetchJobsAndCustomers = async () => {
    setLoading(true);

    // Fetch Customers for name/phone mapping
    const { data: custData } = await supabase.from('customers').select('*');
    if (custData) {
      const custMap = Object.fromEntries(custData.map(c => [c.id, c]));
      setCustomers(custMap);
    }

    // Fetch Jobs
    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      alert("Error fetching jobs: " + error.message);
    } else {
      setJobs(jobData || []);
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Jobs...</div>;
  }

  // Filter Jobs
  const activeJobs = jobs.filter(j => j.status !== 'Paid');
  const archivedJobs = jobs.filter(j => j.status === 'Paid');
  const displayedJobs = activeTab === 'active' ? activeJobs : archivedJobs;

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', color: 'var(--text-main)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        <div>
          <h2 style={{ color: 'var(--text-accent)', margin: '0 0 4px 0', fontSize: 22 }}>📋 All Jobs</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Track and manage your entire project pipeline.</p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'active' ? 'var(--primary-text)' : 'var(--text-muted)',
              fontWeight: 'bold', cursor: 'pointer', fontSize: 13
            }}
          >
            🔥 Active Jobs ({activeJobs.length})
          </button>
          <button 
            onClick={() => setActiveTab('archive')}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: activeTab === 'archive' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'archive' ? 'var(--primary-text)' : 'var(--text-muted)',
              fontWeight: 'bold', cursor: 'pointer', fontSize: 13
            }}
          >
            🗄️ Archive ({archivedJobs.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayedJobs.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', padding: 30, borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
            {activeTab === 'active' ? 'No active jobs right now.' : 'No paid jobs in the archive yet.'}
          </div>
        ) : (
          displayedJobs.map(job => {
            const cust = customers[job.customer_id];
            
            return (
              <Link 
                to={`/job-details/${job.id}`} 
                key={job.id} 
                style={{ 
                  display: 'block', textDecoration: 'none', background: 'var(--bg-card)', 
                  border: '2px solid var(--border-color)', borderRadius: 8, padding: 16,
                  opacity: activeTab === 'archive' ? 0.75 : 1, transition: '0.2s ease-in-out'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</h3>
                    {cust && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        👤 {cust.first_name} {cust.last_name} {cust.phone ? `• 📞 ${cust.phone}` : ''}
                      </div>
                    )}
                    {job.scheduled_date && (
                      <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 6, fontWeight: 'bold' }}>
                        📅 Scheduled: {new Date(job.scheduled_date).toLocaleDateString()} {job.scheduled_time ? `at ${job.scheduled_time}` : ''}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--success)', marginBottom: 6 }}>
                      ${job.quoted_price?.toLocaleString() || '0'}
                    </div>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                      {job.status || 'Lead'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

    </div>
  );
}
