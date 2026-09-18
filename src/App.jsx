import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout & Components
import Layout from './components/Layout';
import Login from './components/Login';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import AllJobs from './pages/AllJobs';
import JobDetail from './pages/JobDetail';
import ManagerHub from './pages/ManagerHub';
import PublicBooking from './pages/PublicBooking';
import DesignSandbox from './pages/DesignSandbox';
import CommunicationHub from './pages/CommunicationHub';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/book" element={<PublicBooking />} />
        <Route path="/login" element={<Login />} />

        {/* Protected App Routes wrapped in the main Layout */}
        <Route path="/" element={<Layout />}>
          {/* Dashboard is the default landing page */}
          <Route index element={<Dashboard />} />
          
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          
          <Route path="jobs" element={<AllJobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          
          <Route path="manager" element={<ManagerHub />} />
          <Route path="sandbox" element={<DesignSandbox />} />
          
          {/* New Communication Hub */}
          <Route path="inbox" element={<CommunicationHub />} />
        </Route>

        {/* Fallback for unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
