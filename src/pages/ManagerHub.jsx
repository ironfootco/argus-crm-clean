import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ManagerHub() {
  const [timesheets, setTimesheets] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Shift Entry Form State
  const [manualWorker, setManualWorker] = useState('Jason');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualInTime, setManualInTime] = useState('08:00');
  const [manualOutTime, setManualOutTime] = useState('16:30');
  const [submittingManual, setSubmittingManual] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch team members for hourly rates
    const { data: teamData } = await supabase
      .from('team_members')
      .select('*')
      .order('name');
    if (teamData) setTeamMembers(teamData);

    // Fetch all timesheets ordered by latest clock in
    const { data: timeData } = await supabase
      .from('timesheets')
      .select('*')
      .order('clock_in', { ascending: false });
    if (timeData) setTimesheets(timeData);

    setLoading(false);
  };

  // Force clock out a worker who forgot
  const handleForceClockOut = async (shift) => {
    const clockInTime = new Date(shift.clock_in);
    const clockOutTime = new Date();
    const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    await supabase
      .from('timesheets')
      .update({ clock_out: clockOutTime.toISOString(), total_hours: hours })
      .eq('id', shift.id);

    fetchData();
  };

  // Delete a timesheet record
  const handleDeleteTimesheet = async (id) => {
    if (!window.confirm("Are you sure you want to delete this timesheet entry?")) return;
    await supabase.from('timesheets').delete().eq('id', id);
    fetchData();
  };

  // Add a manual shift entry
  const handleAddManualShift = async (e) => {
    e.preventDefault();
    setSubmittingManual(true);

    try {
      const clockIn = new Date(`${manualDate}T${manualInTime}:00`);
      const clockOut = new Date(`${manualDate}T${manualOutTime}:00`);
      const hours = parseFloat(((clockOut - clockIn) / (1000 * 60 * 60)).toFixed(2));

      if (hours <= 0) {
        alert("Clock-out time must be after clock-in time.");
        setSubmittingManual(false);
        return;
      }

      await supabase.from('timesheets').insert([{
        worker_name: manualWorker,
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        total_hours: hours
      }]);

      fetchData();
      alert("Manual shift entry added successfully!");
    } catch (err) {
      alert("Error adding manual shift: " + err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  // Calculate payroll summary per worker
  const getWorkerPayroll = (workerName) => {
    const workerShifts = timesheets.filter(t => t.worker_name === workerName && t.total_hours);
    const totalHours = workerShifts.reduce((acc, t) => acc + (parseFloat(t.total_hours) || 0), 0);
    const member = teamMembers.find(m => m.name === workerName);
    const rate = member ? member.hourly_rate || 40 : 40;
    const grossPay = totalHours * rate;

    return { totalHours: totalHours.toFixed(2), rate, grossPay: grossPay.toFixed(2), shiftCount: workerShifts.length };
  };

  const activeShifts = timesheets.filter(t => !t.clock_out);

  if (loading) {
    return <div style={{ color: 'var(--text-main)', padding: 40, textAlign: 'center' }}>Loading Payroll & Timecards...</div>;
  }

  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text-accent)', margin: '0 0 6px 0', fontSize: 22 }}>💼 Manager Hub & Payroll</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Track crew shift clock-ins, review timesheets, and run payroll calculations.</p>
      </div>

      {/* LIVE ACTIVE SHIFTS BANNER */}
      {activeShifts.length > 0 && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '2px solid var(--success)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--success)', fontSize: 15 }}>🟢 Currently Clocked In ({activeShifts.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeShifts.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: 15 }}>👤 {s.worker_name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                    Clocked in at {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(s.clock_in).toLocaleDateString()})
                  </span>
                </div>
                <button onClick={() => handleForceClockOut(s)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                  🛑 Force Clock Out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYROLL SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 25 }}>
        {['Jason', 'Edwin'].map(worker => {
          const stats = getWorkerPayroll(worker);
          return (
            <div key={worker} style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: 18 }}>👤 {worker}</h3>
                <span style={{ fontSize: 12, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  Rate: ${stats.rate}/hr
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>TOTAL HOURS</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--text-main)', marginTop: 2 }}>{stats.totalHours} hrs</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold' }}>EST. GROSS PAY</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--success)', marginTop: 2 }}>${stats.grossPay}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MANUAL SHIFT ENTRY FORM */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 18, marginBottom: 25 }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-accent)', fontSize: 15 }}>➕ Add Manual Shift / Missed Clock-In</h4>
        <form onSubmit={handleAddManualShift} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>WORKER</label>
            <select value={manualWorker} onChange={e => setManualWorker(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <option value="Jason">Jason</option>
              <option value="Edwin">Edwin</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>DATE</label>
            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>CLOCK IN</label>
            <input type="time" value={manualInTime} onChange={e => setManualInTime(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>CLOCK OUT</label>
            <input type="time" value={manualOutTime} onChange={e => setManualOutTime(e.target.value)} required style={{ width: '100%', padding: 8, borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={submittingManual} style={{ padding: '9px 16px', background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
            {submittingManual ? "Saving..." : "Add Shift"}
          </button>
        </form>
      </div>

      {/* TIMECARD HISTORY TABLE */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 8, padding: 18 }}>
        <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: 16 }}>📋 Timesheet History ({timesheets.length})</h4>
        
        {timesheets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No shift records found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-accent)' }}>
                  <th style={{ padding: '8px 10px' }}>Worker</th>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Clock In</th>
                  <th style={{ padding: '8px 10px' }}>Clock Out</th>
                  <th style={{ padding: '8px 10px' }}>Total Hours</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map(t => {
                  const inDate = new Date(t.clock_in);
                  const outDate = t.clock_out ? new Date(t.clock_out) : null;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>👤 {t.worker_name}</td>
                      <td style={{ padding: '10px' }}>{inDate.toLocaleDateString()}</td>
                      <td style={{ padding: '10px' }}>{inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '10px' }}>
                        {outDate ? outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>🟢 Active</span>}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: 'var(--text-accent)' }}>
                        {t.total_hours ? `${t.total_hours} hrs` : '--'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteTimesheet(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
