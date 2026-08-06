import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
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
    <>
      <style>{`
        :root, [data-theme="dark"] {
          --bg-main: #121316;
          --bg-card: #1c1e24;
          --bg-input: #121316;
          --border-color: #374151;
          --primary: #eab308;
          --primary-text: #000000;
          --success: #10b981;
          --warning: #f97316;
          --text-main: #ffffff;
          --text-muted: #9ca3af;
          --text-accent: #fde047;
        }

        [data-theme="light"] {
          --bg-main: #f8fafc;
          --bg-card: #ffffff;
          --bg-input: #ffffff;
          --border-color: #0f172a;
          --primary: #0284c7;
          --primary-text: #ffffff;
          --success: #059669;
          --warning: #d97706;
          --text-main: #0f172a;
          --text-muted: #334155;
          --text-accent: #0284c7;
        }

        html, body {
          margin: 0;
          padding: 0;
          background-color: var(--bg-main) !important;
          color: var(--text-main) !important;
          font-family: system-ui, -apple-system, sans-serif;
          min-height: 100vh;
        }

        input::placeholder {
          color: var(--text-muted);
          opacity: 0.8;
        }

        button, input, select {
          font-family: inherit;
        }
      `}</style>

      <div style={{ maxWidth: 850, margin: '0 auto', padding: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: '2px solid var(--border-color)', paddingBottom: 15 }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Argus CRM</h2>
          </div>
          
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={{ background: location.pathname === '/' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              ⚡ Active Jobs
            </button>
            <button onClick={() => navigate('/jobs')} style={{ background: location.pathname === '/jobs' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/jobs' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              📋 All Jobs
            </button>
            <button onClick={() => navigate('/customers')} style={{ background: location.pathname.startsWith('/customers') ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname.startsWith('/customers') ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              👥 Customers
            </button>
            <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              {theme === 'dark' ? '☀️ Sunlight Mode' : '⚡ High-Vis Mode'}
            </button>
          </div>
        </header>

        {children}
      </div>
    </>
  );
}

function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  // Fetch ONLY active jobs (excluding Job Complete)
  const fetchActiveJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Job Complete')
      .order('created_at', { ascending: false });

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
      fetchActiveJobs();
    }
  };

  return (
    <div>
      {/* New Job Quick Form */}
      <form onSubmit={createJob} style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, display: 'flex', gap: 10, border: '2px solid var(--border-color)' }}>
        <input
          placeholder="New Job Title (e.g. 124 Main St Sealcoating)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 2, padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }}
        />
        <input
          type="number"
          placeholder="Quoted Price ($)"
          value={quotedPrice}
          onChange={e => setQuotedPrice(e.target.value)}
          style={{ flex: 1, padding: 12, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 14 }}
        />
        <button type="submit" disabled={loading} style={{ padding: '12px 20px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}>
          {loading ? "Creating..." : "+ Create Job"}
        </button>
      </form>

      {/* Active Jobs Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ color: 'var(--text-main)', margin: 0 }}>⚡ Active Jobs ({jobs.length})</h3>
        <button 
          onClick={() => navigate('/jobs')} 
          style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}
        >
          View All / Search Jobs →
        </button>
      </div>

      {/* Active Jobs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {jobs.map(job => (
          <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--border-color)' }}>
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
        {jobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active jobs! Add a new job above or check "All Jobs".</p>}
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
          <Route path="/jobs" element={<AllJobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/sandbox" element={<DesignSandbox />} />
        </Routes>
      </Layout>
    </Router>
  );
}
