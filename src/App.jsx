import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

// Layout & Modals
import Layout from './components/Layout';
import NewLeadModal from './components/NewLeadModal';
import Login from './components/Login';

// Pages
import PublicBooking from './pages/PublicBooking';
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
import ManagerHub from './pages/ManagerHub';
import DesignSandbox from './pages/DesignSandbox';

function PrivacyPolicy() {
  return (
    <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 10, border: '2px solid var(--border-color)', color: 'var(--text-main)', maxWidth: 750, margin: '20px auto' }}>
      <h2 style={{ color: 'var(--text-accent)', marginTop: 0 }}>Privacy Policy & SMS Terms</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Last Updated: August 2026</p>
      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>1. Information Collection & Use</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>We collect customer names, phone numbers, email addresses, and physical property addresses solely for the purpose of scheduling, estimating, and performing handyman, repairs, and property management services.</p>
      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>2. Mobile Information Safeguard (A2P Compliance)</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18, background: 'var(--bg-input)', padding: 12, borderRadius: 6, borderLeft: '4px solid var(--primary)' }}><strong>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.</strong> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>3. SMS Communication & Frequency</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>By booking a service or requesting a quote, you consent to receive operational SMS notifications (such as crew 'En Route' alerts, job completion updates, and appointment reminders). Message frequency varies based on active service jobs. Standard message and data rates may apply.</p>
      <strong style={{ color: 'var(--text-main)', fontSize: 15, display: 'block', marginBottom: 6 }}>4. Opt-Out & Assistance</strong>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>You can cancel the SMS service at any time by texting <strong>STOP</strong>. After sending <strong>STOP</strong>, we will send an SMS confirmation that you have been unsubscribed. For help, reply <strong>HELP</strong> or contact our office directly.</p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingAuth(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoadingAuth(false); });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => await supabase.auth.signOut();

  if (loadingAuth) return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Authenticating Argus...</div>;

  const userEmail = session?.user?.email?.toLowerCase() || '';
  const activeWorker = userEmail.includes('edwin') ? 'Edwin' : 'Jason';

  return (
    <Router>
      <Routes>
        <Route path="/book" element={<PublicBooking />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        
        <Route path="/*" element={
          !session ? <Login /> : (
            <Layout onOpenLeadModal={() => setIsLeadModalOpen(true)} activeWorker={activeWorker} onLogout={handleLogout}>
              <NewLeadModal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} onLeadCreated={() => setRefreshTrigger(prev => prev + 1)} />
              <Routes>
                <Route path="/" element={<Dashboard refreshTrigger={refreshTrigger} activeWorker={activeWorker} />} />
                <Route path="/jobs" element={<AllJobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/customers" element={<Customers activeWorker={activeWorker} />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/manager" element={activeWorker === 'Edwin' ? <Navigate to="/" replace /> : <ManagerHub />} />
                <Route path="/sandbox" element={<DesignSandbox />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </Router>
  );
}
