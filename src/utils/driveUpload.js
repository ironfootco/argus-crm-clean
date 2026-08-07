import { createMarketingGraphic } from './combinePhotos';

export async function processAndUploadMarketingGraphic(job) {
  if (!job.before_photo_url || !job.after_photo_url) {
    alert("⚠️ Drive Upload Skipped: Both Before and After photos are required on this job record.");
    return;
  }

  try {
    const graphicBase64 = await createMarketingGraphic(job.before_photo_url, job.after_photo_url, job.title);
    const safeTitle = (job.title || 'Job').replace(/[^a-zA-Z0-9]/g, '_');
    
    const res = await fetch('/api/uploadToDrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: graphicBase64,
        fileName: `Argus_Marketing_${safeTitle}_${Date.now()}.jpg`
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(`❌ Google Drive Upload Failed:\n${data.error || 'Unknown Server Error'}`);
    } else {
      alert("🎉 Success! Side-by-Side Marketing Photo uploaded to Google Drive!");
    }
  } catch (err) {
    alert(`❌ Marketing Graphic Error:\n${err.message}`);
  }
}
