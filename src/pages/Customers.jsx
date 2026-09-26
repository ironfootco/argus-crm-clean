import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [workerPhone, setWorkerPhone] = useState(null);

  const currentUser = localStorage.getItem('argus_user') || 'Jason';

  useEffect(() => {
    fetchCustomers();
    fetchWorkerPhone();
  }, []);

  const fetchWorkerPhone = async () => {
    try {
      const { data } = await supabase
        .from('team_members')
        .select('phone')
        .eq('name', currentUser)
        .single();
      if (data?.phone) setWorkerPhone(String(data.phone));
    } catch (e) {
      console.error("Worker phone fetch error:", e);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('first_name', { ascending: true });
      if (!error && data) setCustomers(data);
    } catch (e) {
      console.error("Customers fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = String(phoneStr).replace(/\D/g, '');
    const core = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
    if (core.length === 10) {
      return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6, 10)}`;
    }
    return String(phoneStr);
  };

  const handleCallCustomer = async (phone) => {
    if (!phone) return alert("No phone number saved for this contact.");
    if (!workerPhone) return alert(`We could not find a phone number for ${currentUser}.`);

    const cCore = String(phone).replace(/\D/g, '').slice(-10);
    const wCore = String(workerPhone).replace(/\D/g, '').slice(-10);

    if (cCore.length !== 10) return alert("Invalid customer phone number.");

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: `+1${cCore}`,
          workerNumber: `+1${wCore}`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initiate call");
      }

      alert(`📞 Calling ${currentUser}'s cell now! Answer to connect.`);
    } catch (err) {
      alert("Call Error: " + err.message);
    }
  };

  const filtered = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const q = search.toLowerCase();
    return fullName.includes(q) || phone.includes(q) || email.includes(q);
  });

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', color: 'var(--text-main, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Contacts ({customers.length})</h2>
        <input
          type="text"
          placeholder="🔍 Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color, #444)', background: 'var(--bg-input, #2a2a2a)', color: '#fff', fontSize: 14, width: 240 }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 20, color: 'var(--text-muted, #aaa)' }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--text-muted, #aaa)', textAlign: 'center' }}>No contacts found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => {
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed Contact';
            const displayPhone = formatPhone(c.phone);

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  background: 'var(--bg-card, #1e1e1e)',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>{fullName}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted, #aaa)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {displayPhone && <span>📱 {displayPhone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                  {c.address && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginTop: 4 }}>📍 {c.address}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {c.phone && (
                    <button
                      onClick={() => handleCallCustomer(c.phone)}
                      style={{
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      📞 Call
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
