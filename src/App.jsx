import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
import ManagerHub from './pages/ManagerHub';
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
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: '2px solid var(--border-color)', paddingBottom: 15, flexWrap: 'wrap', gap: 10 }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Argus CRM</h2>
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/')} style={{ background: location.pathname === '/' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              ⚡ Field Today
            </button>
            <button onClick={() => navigate('/jobs')} style={{ background: location.pathname === '/jobs' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/jobs' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              📋 All Jobs
            </button>
            <button onClick={() => navigate('/customers')} style={{ background: location.pathname.startsWith('/customers') ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname.startsWith('/customers') ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              👥 Customers
            </button>
            <button onClick={() => navigate('/manager')} style={{ background: location.pathname === '/manager' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/manager' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              💼 Manager
            </button>
            <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
              {theme === 'dark' ? '☀️ Sunlight' : '⚡ High-Vis'}
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
  const [activeWorker, setActiveWorker] = useState('Jason');
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveJobs();
    checkShiftStatus();
  }, [activeWorker]);

  const fetchActiveJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Job Complete')
      .order('created_at', { ascending: false });

    if (data) setJobs(data);
  };

  const checkShiftStatus = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*')
      .eq('worker_name', activeWorker)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveShift(data[0]);
    } else {
      setActiveShift(null);
    }
  };

  // Shift Clock In / Clock Out
  const toggleShiftClock = async () => {
    setLoadingShift(true);

    if (activeShift) {
      // Clock Out
      const clockInTime = new Date(activeShift.clock_in);
      const clockOutTime = new Date();
      const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

      await supabase
        .from('timesheets')
        .update({ clock_out: clockOutTime.toISOString(), total_hours: hours })
        .eq('id', activeShift.id);

      setActiveShift(null);
    } else {
      // Clock In
      const { data } = await supabase
        .from('timesheets')
        .insert([{ worker_name: activeWorker, clock_in: new Date().toISOString() }])
        .select()
        .single();

      if (data) setActiveShift(data);
    }

    setLoadingShift(false);
  };

  // Update Job Stage Action Buttons
  const updateJobStage = async (jobId, stage, isPaused = false) => {
    const updateData = { job_stage: stage, is_paused: isPaused };
    if (stage === 'Job Complete') {
      updateData.status = 'Job Complete';
    }

    await supabase.from('jobs').update(updateData).eq('id', jobId);
    fetchActiveJobs();
  };

  return (
    <div>
      {/* 1-Tap Payroll Shift Clock Card */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 20, border: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: 4 }}>PAYROLL SHIFT CLOCK</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={activeWorker} onChange={e => setActiveWorker(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: 'bold' }}>
              <option value="Jason">👤 Jason</option>
              <option value="Edwin">👤 Edwin</option>
            </select>
            {activeShift && (
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 'bold' }}>
                🟢 Clocked in since {new Date(activeShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={toggleShiftClock} 
          disabled={loadingShift}
          style={{ minHeight: 48, padding: '10px 20px', background: activeShift ? '#ef4444' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
        >
          {loadingShift ? "Saving..." : activeShift ? "🛑 Clock Out Shift" : "🟢 Clock In Shift"}
        </button>
      </div>

      {/* Truck Loadout & Material Prep */}
      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, marginBottom: 25, border: '2px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-accent)', fontSize: 15 }}>🚛 Today's Truck & Material Loadout</h4>
        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
          {jobs.map(j => j.materials_needed).filter(Boolean).join(' • ') || "No materials specified on active jobs. Add material lists in job details."}
        </div>
      </div>

      {/* Active Field Jobs Schedule */}
      <h3 style={{ color: 'var(--text-main)', marginBottom: 15 }}>⚡ Active Field Schedule ({jobs.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {jobs.map(job => {
          const stage = job.job_stage || 'Scheduled';
          return (
            <div key={job.id} style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 8, border: '2px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.id}`)}>
                <div>
                  <strong style={{ fontSize: 18, color: 'var(--text-main)' }}>🛠️ {job.title}</strong>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Assigned: <span style={{ color: 'var(--text-accent)', fontWeight: 'bold' }}>{job.assigned_to || 'Both'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--success)' }}>${job.quoted_price?.toLocaleString()}</div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-accent)', fontWeight: 'bold', border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block' }}>
                    Stage: {stage} {job.is_paused ? '(Paused)' : ''}
                  </span>
                </div>
              </div>

              {/* Stage Progress Action Buttons */}
              <div style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {stage === 'Scheduled' || stage === 'Lead' ? (
                  <button onClick={() => updateJobStage(job.id, 'En Route')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                    🚗 On My Way
                  </button>
                ) : null}

                {stage === 'En Route' ? (
                  <button onClick={() => updateJobStage(job.id, 'On Site / In Progress')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                    📍 Arrived On Site
                  </button>
                ) : null}

                {stage === 'On Site / In Progress' ? (
                  <>
                    <button onClick={() => updateJobStage(job.id, 'On Site / In Progress', !job.is_paused)} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--warning)', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      {job.is_paused ? "▶️ Resume Work" : "⏸️ Pause Work"}
                    </button>
                    <button onClick={() => updateJobStage(job.id, 'Job Complete')} style={{ flex: 1, minHeight: 44, padding: 10, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                      ✅ Job Finished
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active field jobs on schedule.</p>}
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
          <Route path="/manager" element={<ManagerHub />} />
          <Route path="/sandbox" element={<DesignSandbox />} />
        </Routes>
      </Layout>
    </Router>
  );
}
