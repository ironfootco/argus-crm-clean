import { createMarketingGraphic } from './combinePhotos';

export async function processAndUploadMarketingGraphic(job) {
  if (!job.before_photo_url || !job.after_photo_url) {
    console.log("Drive upload skipped: missing before or after photo.");
    return;
  }

  try {
    const graphicBase64 = await createMarketingGraphic(job.before_photo_url, job.after_photo_url, job.title);
    const safeTitle = (job.title || 'Job').replace(/[^a-zA-Z0-9]/g, '_');
    
    await fetch('/api/uploadToDrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: graphicBase64,
        fileName: `Argus_Marketing_${safeTitle}_${Date.now()}.jpg`
      })
    });
    console.log("Successfully stitched and uploaded to Google Drive!");
  } catch (err) {
    console.warn("Marketing Drive sync error:", err);
  }
}
