import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DesignSandbox() {
  const navigate = useNavigate();
  const [activeTheme, setActiveTheme] = useState('slate');

  const applyTheme = (theme) => {
    setActiveTheme(theme);
    const root = document.documentElement;

    if (theme === 'slate') {
      root.style.setProperty('--bg-main', '#0f172a');
      root.style.setProperty('--bg-card', '#1e293b');
      root.style.setProperty('--bg-input', '#0f172a');
      root.style.setProperty('--border-color', '#334155');
      root.style.setProperty('--primary', '#2563eb');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--text-main', '#f8fafc');
      root.style.setProperty('--text-muted', '#94a3b8');
      root.style.setProperty('--text-accent', '#60a5fa');
    } else if (theme === 'emerald') {
      root.style.setProperty('--bg-main', '#111827');
      root.style.setProperty('--bg-card', '#1f2937');
      root.style.setProperty('--bg-input', '#111827');
      root.style.setProperty('--border-color', '#374151');
      root.style.setProperty('--primary', '#059669');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--text-main', '#ffffff');
      root.style.setProperty('--text-muted', '#9ca3af');
      root.style.setProperty('--text-accent', '#34d399');
    } else if (theme === 'midnight') {
      root.style.setProperty('--bg-main', '#0a0a0c');
      root.style.setProperty('--bg-card', '#16161a');
      root.style.setProperty('--bg-input', '#0a0a0c');
      root.style.setProperty('--border-color', '#242429');
      root.style.setProperty('--primary', '#d97706');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--text-main', '#fffffe');
      root.style.setProperty('--text-muted', '#94a1b2');
      root.style.setProperty('--text-accent', '#fbbf24');
    }
  };

  return (
    <div style={{ maxWidth: 850, margin: '20px auto', padding: 20 }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ background: 'none', border: 'none', color: 'var(--text-accent, #60a5fa)', cursor: 'pointer', marginBottom: 15, fontWeight: 'bold' }}
      >
        ← Back to Dashboard
      </button>

      <header style={{ marginBottom: 25, borderBottom: '1px solid var(--border-color, #334155)', paddingBottom: 15 }}>
        <h2>🎨 Design & Color Sandbox</h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14 }}>Test color themes and component styles live. Changes won't affect stored data.</p>
      </header>

      {/* Theme Preset Switcher */}
      <div style={{ background: 'var(--bg-card, #1e293b)', padding: 15, borderRadius: 8, marginBottom: 30, border: '1px solid var(--border-color, #334155)' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted, #94a3b8)' }}>SELECT COLOR PRESET</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={() => applyTheme('slate')} 
            style={{ padding: '8px 16px', borderRadius: 6, border: activeTheme === 'slate' ? '2px solid #60a5fa' : 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Modern Slate & Blue
          </button>
          <button 
            onClick={() => applyTheme('emerald')} 
            style={{ padding: '8px 16px', borderRadius: 6, border: activeTheme === 'emerald' ? '2px solid #34d399' : 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Emerald Asphalt
          </button>
          <button 
            onClick={() => applyTheme('midnight')} 
            style={{ padding: '8px 16px', borderRadius: 6, border: activeTheme === 'midnight' ? '2px solid #fbbf24' : 'none', background: '#d97706', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Midnight Amber
          </button>
        </div>
      </div>

      {/* Component Sandbox Showcase */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        
        {/* Buttons & Badges */}
        <div style={{ background: 'var(--bg-card, #1e293b)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color, #334155)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>Buttons & Badges</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ padding: 10, background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Primary Action Button</button>
            <button style={{ padding: 10, background: 'var(--success, #10b981)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Success / Save Button</button>
            <button style={{ padding: 10, background: 'var(--border-color, #334155)', color: 'var(--text-main, #f8fafc)', border: 'none', borderRadius: 6 }}>Secondary / Cancel Button</button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <span style={{ padding: '4px 10px', background: 'var(--primary, #2563eb)', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>Lead</span>
              <span style={{ padding: '4px 10px', background: 'var(--success, #10b981)', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>Complete</span>
              <span style={{ padding: '4px 10px', background: 'var(--warning, #f59e0b)', borderRadius: 20, fontSize: 12, fontWeight: 'bold', color: '#000' }}>In Progress</span>
            </div>
          </div>
        </div>

        {/* Inputs & Form Fields */}
        <div style={{ background: 'var(--bg-card, #1e293b)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color, #334155)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>Inputs & Selects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Sample Text Input" style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-input, #0f172a)', color: 'var(--text-main, #f8fafc)' }} />
            <select style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-input, #0f172a)', color: 'var(--text-main, #f8fafc)' }}>
              <option>Sample Dropdown Option 1</option>
              <option>Sample Dropdown Option 2</option>
            </select>
          </div>
        </div>

        {/* Sample Customer Card */}
        <div style={{ gridColumn: 'span 2', background: 'var(--bg-card, #1e293b)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: 17, color: 'var(--text-main, #f8fafc)', display: 'block' }}>Jason Foote (Sample Customer)</strong>
            <span style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>📍 225 First Parish Rd, Scituate, MA</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }}>
            <div style={{ color: 'var(--text-accent, #60a5fa)', fontWeight: 'bold' }}>📞 (781) 724-6829</div>
            <div style={{ color: 'var(--text-muted, #94a3b8)' }}>✉️ jfoote56@gmail.com</div>
          </div>
        </div>

        {/* Sample Job Summary Box */}
        <div style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success, #10b981)', padding: 16, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--success, #10b981)' }}>✓ Financial Summary Box Preview</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>LABOR</div>
              <strong>$240</strong>
            </div>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>MATERIALS</div>
              <strong>$200</strong>
            </div>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>TOTAL COST</div>
              <strong>$440</strong>
            </div>
            <div style={{ background: 'var(--bg-card, #1e293b)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>NET PROFIT</div>
              <strong style={{ color: 'var(--success, #10b981)' }}>$60 (12.0%)</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
