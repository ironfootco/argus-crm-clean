import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DesignSandbox() {
  const navigate = useNavigate();
  const [activeTheme, setActiveTheme] = useState('industrial');

  const applyTheme = (theme) => {
    setActiveTheme(theme);
    const root = document.documentElement;

    if (theme === 'industrial') {
      // Dark Asphalt & Safety Yellow (Tactical / Field Default)
      root.style.setProperty('--bg-main', '#121316');
      root.style.setProperty('--bg-card', '#1c1e24');
      root.style.setProperty('--bg-input', '#121316');
      root.style.setProperty('--border-color', '#374151');
      root.style.setProperty('--primary', '#eab308'); // High-Vis Yellow
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--warning', '#f97316');
      root.style.setProperty('--text-main', '#ffffff');
      root.style.setProperty('--text-muted', '#9ca3af');
      root.style.setProperty('--text-accent', '#fde047');
    } else if (theme === 'sunlight') {
      // Direct Sunlight Glare Mode (Light High-Contrast)
      root.style.setProperty('--bg-main', '#f8fafc');
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--bg-input', '#ffffff');
      root.style.setProperty('--border-color', '#0f172a');
      root.style.setProperty('--primary', '#0284c7');
      root.style.setProperty('--success', '#059669');
      root.style.setProperty('--warning', '#d97706');
      root.style.setProperty('--text-main', '#0f172a');
      root.style.setProperty('--text-muted', '#334155');
      root.style.setProperty('--text-accent', '#0284c7');
    } else if (theme === 'slate') {
      // Modern Slate & Blue
      root.style.setProperty('--bg-main', '#0f172a');
      root.style.setProperty('--bg-card', '#1e293b');
      root.style.setProperty('--bg-input', '#0f172a');
      root.style.setProperty('--border-color', '#334155');
      root.style.setProperty('--primary', '#2563eb');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--warning', '#f59e0b');
      root.style.setProperty('--text-main', '#f8fafc');
      root.style.setProperty('--text-muted', '#94a3b8');
      root.style.setProperty('--text-accent', '#60a5fa');
    } else if (theme === 'emerald') {
      // Emerald Asphalt
      root.style.setProperty('--bg-main', '#111827');
      root.style.setProperty('--bg-card', '#1f2937');
      root.style.setProperty('--bg-input', '#111827');
      root.style.setProperty('--border-color', '#374151');
      root.style.setProperty('--primary', '#059669');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--warning', '#f59e0b');
      root.style.setProperty('--text-main', '#ffffff');
      root.style.setProperty('--text-muted', '#9ca3af');
      root.style.setProperty('--text-accent', '#34d399');
    } else if (theme === 'midnight') {
      // Midnight Amber
      root.style.setProperty('--bg-main', '#0a0a0c');
      root.style.setProperty('--bg-card', '#16161a');
      root.style.setProperty('--bg-input', '#0a0a0c');
      root.style.setProperty('--border-color', '#242429');
      root.style.setProperty('--primary', '#d97706');
      root.style.setProperty('--success', '#10b981');
      root.style.setProperty('--warning', '#f59e0b');
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

      <header style={{ marginBottom: 25, borderBottom: '2px solid var(--border-color, #334155)', paddingBottom: 15 }}>
        <h2 style={{ color: 'var(--text-main, #f8fafc)', margin: '0 0 5px 0' }}>🎨 Design & Color Sandbox</h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14, margin: 0 }}>Test color themes and component styles live. Changes won't affect stored data.</p>
      </header>

      {/* Theme Preset Switcher */}
      <div style={{ background: 'var(--bg-card, #1e293b)', padding: 18, borderRadius: 8, marginBottom: 30, border: '2px solid var(--border-color, #334155)' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 'bold', color: 'var(--text-muted, #94a3b8)' }}>SELECT PALETTE PRESET</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={() => applyTheme('industrial')} 
            style={{ padding: '10px 16px', borderRadius: 6, border: activeTheme === 'industrial' ? '2px solid #fde047' : '1px solid #374151', background: '#eab308', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ⚡ Industrial High-Vis (Yellow)
          </button>
          <button 
            onClick={() => applyTheme('sunlight')} 
            style={{ padding: '10px 16px', borderRadius: 6, border: activeTheme === 'sunlight' ? '2px solid #0284c7' : '1px solid #0f172a', background: '#ffffff', color: '#0f172a', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ☀️ Direct Sunlight (Bright)
          </button>
          <button 
            onClick={() => applyTheme('slate')} 
            style={{ padding: '10px 16px', borderRadius: 6, border: activeTheme === 'slate' ? '2px solid #60a5fa' : 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Modern Slate & Blue
          </button>
          <button 
            onClick={() => applyTheme('emerald')} 
            style={{ padding: '10px 16px', borderRadius: 6, border: activeTheme === 'emerald' ? '2px solid #34d399' : 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Emerald Asphalt
          </button>
          <button 
            onClick={() => applyTheme('midnight')} 
            style={{ padding: '10px 16px', borderRadius: 6, border: activeTheme === 'midnight' ? '2px solid #fbbf24' : 'none', background: '#d97706', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Midnight Amber
          </button>
        </div>
      </div>

      {/* Component Sandbox Showcase */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        
        {/* Buttons & Badges */}
        <div style={{ background: 'var(--bg-card, #1e293b)', padding: 20, borderRadius: 8, border: '2px solid var(--border-color, #334155)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16, color: 'var(--text-main)' }}>Buttons & Field Badges</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ minHeight: 48, padding: 12, background: 'var(--primary)', color: activeTheme === 'industrial' ? '#000' : '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
              Primary Action Button
            </button>
            <button style={{ minHeight: 48, padding: 12, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
              Success / Save Details
            </button>
            <button style={{ minHeight: 44, padding: 10, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer' }}>
              Secondary / Cancel Button
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', background: 'var(--primary)', color: activeTheme === 'industrial' ? '#000' : '#fff', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>Lead</span>
              <span style={{ padding: '6px 12px', background: 'var(--warning)', color: '#000', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>In Progress</span>
              <span style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>Complete</span>
            </div>
          </div>
        </div>

        {/* Inputs & Form Fields */}
        <div style={{ background: 'var(--bg-card, #1e293b)', padding: 20, borderRadius: 8, border: '2px solid var(--border-color, #334155)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16, color: 'var(--text-main)' }}>Field Inputs & Selects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>SAMPLE INPUT FIELD</label>
              <input placeholder="Enter job site address..." style={{ width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CUSTOMER DROPDOWN</label>
              <select style={{ width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', boxSizing: 'border-box' }}>
                <option>Iron Foot Co. (225 First Parish Rd)</option>
                <option>Sample Customer 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sample Customer Card */}
        <div style={{ gridColumn: 'span 2', background: 'var(--bg-card, #1e293b)', padding: 18, borderRadius: 8, border: '2px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: 18, color: 'var(--text-main, #ffffff)', display: 'block' }}>Iron Foot Co. (Sample Client)</strong>
            <span style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)', marginTop: 4, display: 'block' }}>📍 225 First Parish Rd, Scituate, MA</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 14 }}>
            <div style={{ color: 'var(--text-accent, #60a5fa)', fontWeight: 'bold', marginBottom: 4 }}>📞 (781) 724-6829</div>
            <div style={{ color: 'var(--text-muted, #94a3b8)' }}>✉️ jfoote56@gmail.com</div>
          </div>
        </div>

        {/* Sample Job Financial Summary Box */}
        <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', border: '2px solid var(--success)', padding: 18, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 12px 0', color: 'var(--success, #10b981)', fontSize: 16 }}>✓ Job Completion & Net Margin Preview</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LABOR</div>
              <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>$240</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MATERIALS</div>
              <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>$200</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL COST</div>
              <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>$440</strong>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NET PROFIT</div>
              <strong style={{ fontSize: 16, color: 'var(--success)' }}>$260 (37.1%)</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
