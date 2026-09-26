import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [calling, setCalling] = useState(false);
  const [workerPhone, setWorkerPhone] = useState(null);

  const currentUser = localStorage.getItem('argus_user') || 'Jason';

  useEffect(() => {
    fetchWorkerPhone();
    fetchCustomers();
  }, []);

  const fetchWorkerPhone = async () => {
    try {
      const { data } = await supabase.from('team_members').select('phone').eq('name', currentUser).single();
      if (data?.phone) setWorkerPhone(String(data.phone));
    } catch (e) {
      console.error("Error fetching worker phone:", e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase.from('customers').select('id, first_name, last_name, phone').order('first_name');
      if (data) setCustomers(data);
    } catch (e) {
      console.error("Error fetching customers:", e);
    }
  };

  const formatDisplayPhone = (str) => {
    const digits = String(str || '').replace(/\D/g, '');
    const core = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
    if (core.length === 10) {
      return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6, 10)}`;
    }
    return str;
  };

  const handleKeyPress = (digit) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleSelectContact = (c) => {
    setSelectedContact(c);
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    setSearchQuery(fullName);
    if (c.phone) {
      setPhoneNumber(formatDisplayPhone(c.phone));
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
    setSelectedContact(null);
    setSearchQuery('');
  };

  const handleInitiateCall = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    const coreTarget = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;

    if (coreTarget.length !== 10) {
      return alert("Please enter a valid 10-digit phone number.");
    }

    if (!workerPhone) {
      return alert(`Could not find cell phone number for team member ${currentUser}.`);
    }

    const workerCore = workerPhone.replace(/\D/g, '').slice(-10);

    setCalling(true);
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: `+1${coreTarget}`,
          workerNumber: `+1${workerCore}`
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initiate call");
      }

      alert(`📞 Calling ${currentUser}'s cell now! Answer to connect to ${formatDisplayPhone(coreTarget)}.`);
    } catch (err) {
      alert("Call Error: " + err.message);
    } finally {
      setCalling(false);
    }
  };

  const filteredCustomers = searchQuery.trim()
    ? customers.filter(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
    : [];

  return (
    <div style={{ maxWidth: 420, margin: '20px auto', padding: 24, background: 'var(--bg-card, #1e1e1e)', borderRadius: 16, border: '1px solid var(--border-color, #333)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: 'var(--text-main, #fff)' }}>
      <h2 style={{ textAlign: 'center', marginTop: 0, marginBottom: 20 }}>Dialer</h2>

      {/* CONTACT SEARCH AUTO-COMPLETE */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Search existing contacts..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value) setSelectedContact(null);
          }}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a2a)', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
        />

        {searchQuery.trim() && !selectedContact && filteredCustomers.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card, #252525)', border: '1px solid var(--border-color, #444)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            {filteredCustomers.map(c => (
              <div
                key={c.id}
                onClick={() => handleSelectContact(c)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #333)', fontSize: 14 }}
              >
                <span style={{ fontWeight: 'bold' }}>{c.first_name} {c.last_name}</span>
                <span style={{ color: 'var(--text-muted, #aaa)', marginLeft: 8 }}>{formatDisplayPhone(c.phone)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PHONE NUMBER DISPLAY */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input, #2a2a2a)', border: '1.5px solid var(--border-color, #444)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter number..."
          style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 1, outline: 'none' }}
        />
        {phoneNumber && (
          <button onClick={handleBackspace} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>
            ⌫
          </button>
        )}
      </div>

      {/* NUMPAD GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { num: '1', sub: '' }, { num: '2', sub: 'ABC' }, { num: '3', sub: 'DEF' },
          { num: '4', sub: 'GHI' }, { num: '5', sub: 'JKL' }, { num: '6', sub: 'MNO' },
          { num: '7', sub: 'PRS' }, { num: '8', sub: 'TUV' }, { num: '9', sub: 'WXY' },
          { num: '*', sub: '' }, { num: '0', sub: '+' }, { num: '#', sub: '' }
        ].map(item => (
          <button
            key={item.num}
            onClick={() => handleKeyPress(item.num)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 12, background: 'var(--bg-input, #2a2a2a)', border: '1px solid var(--border-color, #383838)', color: '#fff', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
          >
            <span style={{ fontSize: 22, fontWeight: 'bold' }}>{item.num}</span>
            {item.sub && <span style={{ fontSize: 9, color: 'var(--text-muted, #aaa)' }}>{item.sub}</span>}
          </button>
        ))}
      </div>

      {/* CALL & CLEAR BUTTONS */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleClear}
          style={{ flex: 1, padding: '14px', background: 'var(--bg-input, #333)', color: 'var(--text-main, #fff)', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', fontSize: 15 }}
        >
          Clear
        </button>
        <button
          onClick={handleInitiateCall}
          disabled={calling || !phoneNumber.trim()}
          style={{ flex: 2, padding: '14px', background: 'var(--success, #22c55e)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: (calling || !phoneNumber.trim()) ? 'not-allowed' : 'pointer', opacity: (calling || !phoneNumber.trim()) ? 0.6 : 1, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          📞 {calling ? 'Connecting...' : 'Call'}
        </button>
      </div>
    </div>
  );
}
