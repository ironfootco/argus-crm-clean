import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import DesignSandbox from './pages/DesignSandbox';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('argus_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('argus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: '2px solid var(--border-color)', paddingBottom: 15 }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Argus CRM</h2>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {location.pathname !== '/' && (
            <button onClick={() => navigate('/')} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              🛠️ Jobs
            </button>
          )}
          <button onClick={() => navigate('/customers')} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            👥 Customers
          </button>
          <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
            {theme === 'dark' ? '☀️ Sunlight' : '⚡ High-Vis'}
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}

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
    <div>
      {/* New Job Quick Form */}
      <form onSubmit={createJob} style={{ background: 'var(--bg-card)', padding: 15, borderRadius: 8, marginBottom: 25, display: 'flex', gap: 10, border: '2px solid var(--border-color)' }}>
        <input
          placeholder="New Job Title (e.g. 124 Main St Sealcoating)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 2, padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
        />
        <input
          type="number"
          placeholder="Quoted Price ($)"
          value={quotedPrice}
          onChange={e => setQuotedPrice(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? "Creating..." : "+ Create Job"}
        </button>
      </form>

      {/* Active Jobs List */}
      <h3 style={{ color: 'var(--text-main)' }}>Active Jobs</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobs.map(job => (
          <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} style={{ background: 'var(--bg-card)', padding: 15, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--border-color)' }}>
            <div>
              <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Status: {job.status}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
              {job.synced_to_wave && <span style={{ fontSize: 10, color: 'var(--text-accent)' }}>Wave Synced ✓</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No jobs found. Create your first job above!</p>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/sandbox" element={<DesignSandbox />} />
        </Routes>
      </Layout>
    </Router>
  );
}
