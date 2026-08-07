const handleSaveNotes = async () => {
    setSavingNotes(true);

    // Save to Supabase CRM first
    const { error } = await supabase
      .from('jobs')
      .update({ site_notes: siteNotes })
      .eq('id', id);

    if (error) {
      alert("Error saving notes: " + error.message);
      setSavingNotes(false);
      return;
    }

    setJob(prev => ({ ...prev, site_notes: siteNotes }));

    // Sync to Wave Memo with Customer Name & Email matching
    try {
      const waveRes = await fetch('/api/waveSync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          notes: siteNotes,
          customerName: customer ? `${customer.first_name} ${customer.last_name}` : "",
          customerEmail: customer?.email || "",
          quotedPrice: job.quoted_price || 0
        })
      });
      
      const waveData = await waveRes.json();
      
      if (!waveData.success) {
        alert("Wave Sync Failed: " + (waveData.error || "Unknown Error"));
        setSavingNotes(false);
        return;
      }
    } catch (err) {
      alert("Network Error hitting Wave API: " + err.message);
      setSavingNotes(false);
      return;
    }

    setSavingNotes(false);
    setNotesSavedAlert(true);
    setTimeout(() => setNotesSavedAlert(false), 3000);
  };
