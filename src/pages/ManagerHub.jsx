import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ManagerHub() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .order('clock_in', { ascending: false });

    if (error) console.error("Error fetching timesheets:", error.message);
    if (data) setTimesheets(data);
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>💼 Manager Hub & Payroll</h2>

      {/* Payroll Timesheets */}
      <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '2px solid var(--border-color)', marginBottom: 25 }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-main)' }}>⏱️ Daily Shift Clock Timesheets</h3>
        
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading payroll records...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14, color: 'var(--text-main)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Worker</th>
                  <th style={{ padding: '10px 8px' }}>Date</th>
                  <th style={{ padding: '10px 8px' }}>Clock In</th>
                  <th style={{ padding: '10px 8px' }}>Clock Out</th>
                  <th style={{ padding: '10px 8px' }}>Total Shift Hours</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map(ts => (
                  <tr key={ts.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>👤 {ts.worker_name}</td>
                    <td style={{ padding: '12px 8px' }}>{ts.shift_date}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--success)', fontWeight: 'bold' }}>
                      {new Date(ts.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 8px', color: ts.clock_out ? 'var(--text-accent)' : 'var(--warning)', fontWeight: 'bold' }}>
                      {ts.clock_out ? new Date(ts.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '🟢 Active Shift'}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                      {ts.total_hours ? `${ts.total_hours} hrs` : '--'}
                    </td>
                  </tr>
                ))}
                {timesheets.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: 15, textAlign: 'center', color: 'var(--text-muted)' }}>No worker shift hours logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
