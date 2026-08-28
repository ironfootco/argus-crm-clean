import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Layout({ children, onOpenLeadModal, activeWorker, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('argus_theme') || 'dark');
  const [pushStatus, setPushStatus] = useState('');
  
  // Check if this device has already opted in
  const [isPushActive, setIsPushActive] = useState(() => localStorage.getItem('push_active_v2') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('argus_theme', theme);
  }, [theme]);

  const toggleTheme = () => { setTheme(prev => (prev === 'dark' ? 'light' : 'dark')); };

  const handleSubscribeToPush = () => {
    setPushStatus("⏳ Initiating connection...");
    if (!window.OneSignalDeferred) { setPushStatus("❌ Error: OneSignal is blocked."); return; }
    
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        setPushStatus("⏳ Asking Android for permission...");
        await OneSignal.Notifications.requestPermission();
        setPushStatus("⏳ Telling OneSignal to save your phone...");
        await OneSignal.User.PushSubscription.optIn();
        
        if (OneSignal.User.PushSubscription.optedIn) {
          OneSignal.User.addTag("worker_name", activeWorker);
          setPushStatus(`✅ Success! Locked in as ${activeWorker}.`);
          
          // Hide the button permanently
          setIsPushActive(true);
          localStorage.setItem('push_active_v2', 'true');
          
          // Clear the success message after 4 seconds
          setTimeout(() => setPushStatus(''), 4000);
        } else {
          setPushStatus("⚠️ Denied: Android rejected the request.");
        }
      } catch (err) { setPushStatus("❌ System Error: " + err.message); }
    });
    setTimeout(() => { setPushStatus(prev => prev.includes("⏳") ? "❌ Timeout: Script frozen." : prev); }, 4000);
  };

  return (
    <>
      <style>{`
        :root, [data-theme="dark"] { --bg-main: #121316; --bg-card: #1c1e24; --bg-input: #121316; --border-color: #374151; --primary: #eab308; --primary-text: #000000; --success: #10b981; --warning: #f97316; --text-main: #ffffff; --text-muted: #9ca3af; --text-accent: #fde047; }
        [data-theme="light"] { --bg-main: #f8fafc; --bg-card: #ffffff; --bg-input: #ffffff; --border-color: #0f172a; --primary: #0284c7; --primary-text: #ffffff; --success: #059669; --warning: #d97706; --text-main: #0f172a; --text-muted: #334155; --text-accent: #0284c7; }
        html, body { margin: 0; padding: 0; background-color: var(--bg-main) !important; color: var(--text-main) !important; font-family: system-ui, -apple-system, sans-serif; min-height: 100dvh; }
        
        /* 🚫 NUCLEAR OPTION: KILL THE RED BELL */
        #onesignal-bell-container, 
        .onesignal-bell-launcher, 
        #onesignal-slidedown-container,
        .onesignal-bell-launcher-button { 
            display: none !important; 
            opacity: 0 !important; 
            visibility: hidden !important; 
            pointer-events: none !important; 
            z-index: -9999 !important;
        }

        .pac-container { background-color: #1c1e24 !important; border: 1.5px solid #374151 !important; border-radius: 8px !important; font-family: inherit !important; z-index: 10000 !important; }
        .pac-item { color: #ffffff !important; border-top: 1px solid #374151 !important; padding: 8px 12px !important; }
        .pac-item:hover, .pac-item-selected { background-color: #121316 !important; }
        .pac-item-query { color: #eab308 !important; }
        .pac-matched { color: #10b981 !important; }
        input::placeholder, textarea::placeholder { color: var(--text-muted); opacity: 0.8; }
        button, input, select, textarea { font-family: inherit; }
        .desktop-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px; flex-wrap: wrap; gap: 10px; }
        .mobile-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .desktop-nav-buttons { display: none !important; }
          .desktop-header { margin-bottom: 15px; padding-bottom: 10px; }
          .app-container { padding-bottom: 90px !important; }
          .mobile-bottom-nav { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-top: 2px solid var(--border-color); padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) 12px; justify-content: space-around; align-items: center; z-index: 9000; box-shadow: 0 -4px 12px rgba(0,0,0,0.3); }
          .mobile-nav-item { display: flex; flex-direction: column; align-items: center; background: none; border: none; color: var(--text-muted); font-size: 10px; font-weight: bold; gap: 3px; cursor: pointer; padding: 6px 8px; min-width: 55px; }
          .mobile-nav-item.active { color: var(--primary); }
          .mobile-lead-btn { background: var(--success) !important; color: #fff !important; border-radius: 50% !important; width: 48px; height: 48px; font-size: 20px !important; display: flex; align-items: center; justify-content: center; margin-top: -20px; border: 3px solid var(--bg-main) !important; box-shadow: 0 4px 10px rgba(0,0,0,0.4); }
        }
      `}</style>
      <div className="app-container" style={{ maxWidth: 850, margin: '0 auto', padding: 20 }}>
        <header className="desktop-header">
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Company Logo" style={{ height: 36, width: 'auto', background: '#ffffff', padding: '4px 6px', borderRadius: '6px' }} />
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)', letterSpacing: '0.5px' }}>Argus CRM</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-accent)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)' }}>👤 {activeWorker}</span>
            <button onClick={toggleTheme} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>{theme === 'dark' ? '☀️' : '⚡'}</button>
            
            {/* 🔵 Only show this button if they haven't opted in yet */}
            {!isPushActive && (
              <button onClick={handleSubscribeToPush} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>Enable Alerts</button>
            )}
            
            <button onClick={onLogout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>🔒 Logout</button>
          </div>
          {pushStatus && (
            <div style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', color: 'var(--text-accent)', fontSize: 13, fontWeight: 'bold', textAlign: 'center', borderRadius: 6, border: '1px dashed var(--border-color)' }}>{pushStatus}</div>
          )}
          <div className="desktop-nav-buttons" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: pushStatus ? 15 : 0 }}>
            <button onClick={onOpenLeadModal} style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>📌 + New Lead</button>
            <button onClick={() => navigate('/')} style={{ background: location.pathname === '/' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>⚡ My Dashboard</button>
            <button onClick={() => navigate('/jobs')} style={{ background: location.pathname === '/jobs' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/jobs' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>📋 All Jobs</button>
            <button onClick={() => navigate('/customers')} style={{ background: location.pathname.startsWith('/customers') ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname.startsWith('/customers') ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>👥 Customers</button>
            {activeWorker !== 'Edwin' && (
              <button onClick={() => navigate('/manager')} style={{ background: location.pathname === '/manager' ? 'var(--primary)' : 'var(--bg-card)', color: location.pathname === '/manager' ? 'var(--primary-text)' : 'var(--text-main)', border: '1.5px solid var(--border-color)', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>💼 Manager</button>
            )}
          </div>
        </header>
        {children}
        <nav className="mobile-bottom-nav">
          <button onClick={() => navigate('/')} className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}><span style={{ fontSize: 18 }}>⚡</span><span>Dashboard</span></button>
          <button onClick={() => navigate('/jobs')} className={`mobile-nav-item ${location.pathname === '/jobs' ? 'active' : ''}`}><span style={{ fontSize: 18 }}>📋</span><span>Jobs</span></button>
          <button onClick={onOpenLeadModal} className="mobile-nav-item mobile-lead-btn" title="Add New Lead">📌</button>
          <button onClick={() => navigate('/customers')} className={`mobile-nav-item ${location.pathname.startsWith('/customers') ? 'active' : ''}`}><span style={{ fontSize: 18 }}>👥</span><span>Customers</span></button>
          {activeWorker !== 'Edwin' && (
            <button onClick={() => navigate('/manager')} className={`mobile-nav-item ${location.pathname === '/manager' ? 'active' : ''}`}><span style={{ fontSize: 18 }}>💼</span><span>Manager</span></button>
          )}
        </nav>
      </div>
    </>
  );
}
