"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

// Scituate Trailer Coordinates
const SHOP_LAT = 42.196051;
const SHOP_LNG = -70.746801;
const GEOFENCE_RADIUS_FEET = 500;

// Calculates distance between two GPS coordinates in feet
const getDistanceInFeet = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const distanceMiles = R * c;
  return distanceMiles * 5280; // Convert to feet
};

export default function CrewPortal() {
  const [workerName, setWorkerName] = useState('Edwin'); // Swap to auth later
  const [activeShift, setActiveShift] = useState(null);
  const [assignedJobs, setAssignedJobs] = useState([]);
  
  // Geofence States
  const [distance, setDistance] = useState(null);
  const [isAtShop, setIsAtShop] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveShift();
    fetchAssignedJobs();
    startLocationTracking();
  }, [workerName]);

  const fetchActiveShift = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*')
      .eq('worker_name', workerName)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);
      
    if (data && data.length > 0) {
      setActiveShift(data[0]);
    } else {
      setActiveShift(null);
    }
  };

  const fetchAssignedJobs = async () => {
    // Get jobs assigned to this worker (or 'Both') that aren't paid out yet
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Paid')
      .or(`assigned_to.eq.${workerName},assigned_to.eq.Both`)
      .order('scheduled_date', { ascending: true, nullsFirst: true });
      
    if (data) setAssignedJobs(data);
    setLoading(false);
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setLocationError("GPS is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distFeet = getDistanceInFeet(latitude, longitude, SHOP_LAT, SHOP_LNG);
        setDistance(Math.round(distFeet));
        setIsAtShop(distFeet <= GEOFENCE_RADIUS_FEET);
        setLocationError(null);
      },
      (error) => {
        setLocationError("Please allow location access to clock in.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  };

  const handleClockIn = async () => {
    if (!isAtShop) return alert("You must be at the shop to clock in.");
    
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('timesheets').insert([{
      worker_name: workerName,
      clock_in: now
    }]).select();

    if (!error && data) {
      setActiveShift(data[0]);
    }
  };

  const handleClockOut = async () => {
    if (!isAtShop) return alert("You must return to the shop to clock out.");
    if (!activeShift) return;

    const clockInTime = new Date(activeShift.clock_in);
    const clockOutTime = new Date();
    const hours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    await supabase
      .from('timesheets')
      .update({ clock_out: clockOutTime.toISOString(), total_hours: hours })
      .eq('id', activeShift.id);

    setActiveShift(null);
  };

  const handleJobStatusUpdate = async (jobId, newStatus) => {
    // Updates the master job status for the customer/manager to see
    await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
    
    alert(`Status updated to: ${newStatus}`);
    fetchAssignedJobs(); // Refresh the list
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-main)', textAlign: 'center' }}>Loading GPS...</div>;

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', color: 'var(--text-main)', padding: 16 }}>
      
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ color: 'var(--text-accent)', margin: '0 0 8px 0' }}>👷‍♂️ Crew Portal</h2>
        
        {/* GPS STATUS INDICATOR */}
        <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 20, background: isAtShop ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${isAtShop ? 'var(--success)' : '#ef4444'}` }}>
          {locationError ? (
            <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 'bold' }}>⚠️ {locationError}</span>
          ) : (
            <span style={{ color: isAtShop ? 'var(--success)' : '#ef4444', fontSize: 13, fontWeight: 'bold' }}>
              📍 {isAtShop ? 'At the Shop - Ready' : `Too Far from Shop (${distance} ft)`}
            </span>
          )}
        </div>
      </div>

      {/* PAYROLL CLOCK LAYER */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20, textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Payroll Clock</h3>
        
        {!activeShift ? (
          <button 
            onClick={handleClockIn}
            disabled={!isAtShop}
            style={{ width: '100%', padding: 16, borderRadius: 8, background: isAtShop ? 'var(--success)' : '#4b5563', color: '#fff', border: 'none', fontSize: 18, fontWeight: 'bold', cursor: isAtShop ? 'pointer' : 'not-allowed', opacity: isAtShop ? 1 : 0.5 }}
          >
            🟢 Clock In For The Day
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
              Clocked in since {new Date(activeShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button 
              onClick={handleClockOut}
              disabled={!isAtShop}
              style={{ width: '100%', padding: 16, borderRadius: 8, background: isAtShop ? '#ef4444' : '#4b5563', color: '#fff', border: 'none', fontSize: 18, fontWeight: 'bold', cursor: isAtShop ? 'pointer' : 'not-allowed', opacity: isAtShop ? 1 : 0.5 }}
            >
              🛑 Clock Out & Go Home
            </button>
          </div>
        )}
      </div>

      {/* JOB STATUS LAYER (Only shows when clocked in) */}
      {activeShift && (
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--primary)' }}>Today's Jobs</h3>
          
          {assignedJobs.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
              No active jobs assigned to you today.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {assignedJobs.map(job => (
                <div key={job.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 16, color: 'var(--text-main)' }}>🛠️ {job.title}</h4>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Current Status: {job.status || 'Scheduled'}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => handleJobStatusUpdate(job.id, 'En Route')} style={{ padding: 10, borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                      🚚 On the Way
                    </button>
                    <button onClick={() => handleJobStatusUpdate(job.id, 'In Progress')} style={{ padding: 10, borderRadius: 6, background: 'var(--success)', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                      🛠️ Start Job
                    </button>
                    <button onClick={() => handleJobStatusUpdate(job.id, 'Paused')} style={{ padding: 10, borderRadius: 6, background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                      ⏸️ Pause (Break)
                    </button>
                    <button onClick={() => handleJobStatusUpdate(job.id, 'Job Complete')} style={{ padding: 10, borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                      ✅ Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
