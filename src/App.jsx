import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// Layout & Pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AllJobs from './pages/AllJobs';
import JobDetails from './pages/JobDetails';
import PublicBooking from './pages/PublicBooking'; // The new public booking form

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for login/logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#121212', color: '#d4af37' }}>
        Loading Argus...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* ========================================= */}
        {/* 🔓 PUBLIC ROUTES (No Login Required)      */}
        {/* ========================================= */}
        <Route path="/book" element={<PublicBooking />} />

        {/* ========================================= */}
        {/* 🔒 PROTECTED ROUTES (Requires Login)      */}
        {/* ========================================= */}
        <Route path="/*" element={
          !session ? (
            // Login Screen (If not authenticated)
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '100vh', 
              backgroundColor: 'var(--bg-main, #121212)',
              padding: '20px'
            }}>
              <div style={{ 
                maxWidth: '400px', 
                width: '100%', 
                padding: '30px', 
                backgroundColor: 'var(--bg-card, #1e1e1e)', 
                borderRadius: '12px',
                border: '2px solid var(--primary, #d4af37)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}>
                <h2 style={{ color: 'var(--primary, #d4af37)', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Argus CRM
                </h2>
                <Auth
                  supabaseClient={supabase}
                  appearance={{ theme: ThemeSupa }}
                  theme="dark"
                  providers={[]}
                />
              </div>
            </div>
          ) : (
            // Main App Layout (If authenticated)
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/jobs" element={<AllJobs />} />
                <Route path="/jobs/:id" element={<JobDetails />} />
                
                {/* Catch-all redirects back to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </Router>
  );
}
