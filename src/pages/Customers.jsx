import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_name', { ascending: true });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const handleImportFromWave = async () => {
    setImporting(true);
    setSyncStatus('Fetching customer directory from Wave...');

    try {
      const res = await fetch('/api/syncWaveCustomers');
      const result = await res.json();

      if (!result.success) {
        alert("Wave Import Error: " + result.error);
        setImporting(false);
        setSyncStatus('');
        return;
      }

      const waveCusts = result.customers || [];
      setSyncStatus(`Syncing ${waveCusts.length} customers into database...`);

      let importedCount = 0;

      for (const cust of waveCusts) {
        // Simple deduplication check by email or name
        let existing = null;
        if (cust.email) {
          const { data } = await supabase.from('customers').select('id').eq('email', cust.email).maybeSingle();
          existing = data;
        }

        if (!existing && cust.first_name && cust.last_name) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('first_name', cust.first_name)
            .eq('last_name', cust.last_name)
            .maybeSingle();
          existing = data;
        }

        if (!existing) {
          await supabase.from('customers').insert([cust]);
          importedCount++;
        }
      }

      setSyncStatus(`✅ Wave Import Complete! Added ${importedCount} new customer accounts.`);
      await fetchCustomers();

      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      alert("Network Error during import: " + err.message);
    }

    setImporting(false);
  };

  const filteredCustomers = customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    return fullName.includes(term) || email.includes(term) || phone.includes(term);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-main)' }}>👥 Customer Directory</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {customers.length} total client profiles
          </span>
        </div>

        <button
          onClick={handleImportFromWave}
          disabled={importing}
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-text)',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {importing ? "🔄 Syncing Wave Directory..." : "📥 Import Wave Customers"}
        </button>
      </div>

      {syncStatus && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-card)',
          color: 'var(--text-accent)',
          borderRadius: 8,
          border: '1.5px solid var(--border-color)',
          fontWeight: 'bold',
          fontSize: 14,
          textAlign: 'center'
        }}>
          {syncStatus}
        </div>
      )}

      {/* Search Filter */}
      <input
        type="text"
        placeholder="🔍 Search customers by name, phone, or email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 8,
          border: '1.5px solid var(--border-color)',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          fontSize: 15,
          boxSizing: 'border-box'
        }}
      />

      {loading ? (
        <div style={{ color: 'var(--text-main)', padding: 10 }}>Loading customer database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredCustomers.map(c => {
            const formattedPhone = formatPhoneNumber(c.phone);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                style={{
                  background: 'var(--bg-card)',
                  padding: 16,
                  borderRadius: 10,
                  border: '1.5px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: 10
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 'bold', color: 'var(--text-main)' }}>
                    👤 {c.first_name} {c.last_name}
                  </div>
                  {c.address && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      📍 {c.address}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 13, borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {formattedPhone ? (
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>📞 {formattedPhone}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No phone</span>
                  )}
                  {c.email ? (
                    <span style={{ color: 'var(--text-muted)' }}>✉️ {c.email}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No email</span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div style={{ color: 'var(--text-muted)', padding: 10 }}>No matching customers found.</div>
          )}
        </div>
      )}
    </div>
  );
}
