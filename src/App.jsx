import React, { useState } from 'react';
import SmsChat from './components/SmsChat';
import Customers from './pages/Customers';
import Dialer from './components/Dialer';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'customers' | 'dialer'
  const [selectedPhone, setSelectedPhone] = useState('7819744972');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const navButtonStyle = (tabName) => ({
    padding: '10px 18px',
    background: activeTab === tabName ? 'var(--primary, #3b82f6)' : 'transparent',
    color: activeTab === tabName ? '#ffffff' : 'var(--text-muted, #aaa)',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-main, #121212)', color: 'var(--text-main, #ffffff)' }}>
      
      {/* TOP NAVIGATION BAR */}
      <header style={{ padding: '10px 20px', background: 'var(--bg-card, #1e1e1e)', borderBottom: '1px solid var(--border-color, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: 18, color: '#3b82f6' }}>Argus CRM</div>
        
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setActiveTab('chat')} style={navButtonStyle('chat')}>
            💬 Messages
          </button>
          <button onClick={() => setActiveTab('customers')} style={navButtonStyle('customers')}>
            👥 Contacts
          </button>
          <button onClick={() => setActiveTab('dialer')} style={navButtonStyle('dialer')}>
            📞 Dialer
          </button>
        </nav>
      </header>

      {/* ACTIVE TAB MAIN CONTENT */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'chat' && (
          <SmsChat 
            customerId={selectedCustomerId} 
            customerPhone={selectedPhone} 
          />
        )}

        {activeTab === 'customers' && (
          <Customers />
        )}

        {activeTab === 'dialer' && (
          <Dialer />
        )}
      </main>

    </div>
  );
}
