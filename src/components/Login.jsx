import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: 20
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
        borderRadius: 12,
        padding: 28,
        width: '100%',
        maxWidth: 380,
        color: 'var(--text-main)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 36 }}>🛡️</span>
          <h2 style={{ margin: '8px 0 0 0', color: 'var(--text-main)' }}>Argus CRM</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Authorized Field Access Only</span>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid #ef4444',
            padding: 10,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              EMAIL ADDRESS
            </label>
            <input 
              type="email" 
              required
              placeholder="you@ironfootcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 6,
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              PASSWORD
            </label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 6,
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: 12,
              background: 'var(--primary)',
              color: 'var(--primary-text)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 15,
              cursor: 'pointer'
            }}
          >
            {loading ? "Authenticating..." : "🔒 Log In to Argus"}
          </button>
        </form>
      </div>
    </div>
  );
}
