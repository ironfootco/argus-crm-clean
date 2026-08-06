import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import DesignSandbox from './pages/DesignSandbox';

function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (error) console.error("Fetch Error:", error.message);
    if (data) setJobs(data);
  };

  const createJob = async (e) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);

    const { data, error } = await supabase.from('jobs').insert([{
      title,
      quoted_price: parseFloat(quotedPrice) || 0,
      status: 'Lead'
    }]).select();

    setLoading(false);

    if (error) {
      alert("Database Error: " + error.message);
      return;
    }

    if (data) {
      setTitle('');
      setQuotedPrice('');
      fetchJobs();
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, borderBottom: '1px solid var(--border-color, #374151)', paddingBottom: 15 }}>
        <h2>🛡️ Argus CRM</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/customers')} style={{ background: 'var(--bg-card, #1f2937)', color: 'var(--text-main, #fff)', border: '1px solid var(--border-color, #374151)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
            👥 Customers
          </button>
          <button onClick={() => navigate('/sandbox')} style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
            🎨 Design Sandbox
          </button>
        </div>
      </header>

      {/* New Job Quick Form */}
      <form onSubmit={createJob} style={{ background: 'var(--bg-card, #1f2937)', padding: 15, borderRadius: 8, marginBottom: 25, display: 'flex', gap: 10, border: '1px solid var(--border-color, #374151)' }}>
        <input
          placeholder="New Job Title (e.g. 124 Main St Sealcoating)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 2, padding: 10, borderRadius: 6, border: '1px solid var(--border-color, #374151)', background: 'var(--bg-input, #111827)', color: 'var(--text-main, #fff)' }}
        />
        <input
          type="number"
          placeholder="Quoted Price ($)"
          value={quotedPrice}
          onChange={e => setQuotedPrice(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid var(--border-color, #374151)', background: 'var(--bg-input, #111827)', color: 'var(--text-main, #fff)' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? "Creating..." : "+ Create Job"}
        </button>
      </form>

      {/* Active Jobs List */}
      <h3>Active Jobs</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobs.map(job => (
          <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} style={{ background: 'var(--bg-card, #1f2937)', padding: 15, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color, #374151)' }}>
            <div>
              <strong style={{ fontSize: 16 }}>🛠️ {job.title}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 4 }}>Status: {job.status}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--success, #34d399)' }}>${job.quoted_price?.toLocaleString()}</div>
              {job.synced_to_wave && <span style={{ fontSize: 10, color: 'var(--text-accent, #60a5fa)' }}>Wave Synced ✓</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p style={{ color: 'var(--text-muted, #9ca3af)' }}>No jobs found. Create your first job above!</p>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/sandbox" element={<DesignSandbox />} />
      </Routes>
    </Router>
  );
}
