import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, fileName } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 payload.' });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!folderId || !clientEmail || !privateKey) {
    return res.status(500).json({ 
      error: `Missing environment variables on Vercel.` 
    });
  }

  privateKey = privateKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const stream = Readable.from(buffer);

    const driveResponse = await drive.files.create({
      requestBody: {
        name: fileName || `Argus_Marketing_${Date.now()}.jpg`,
        parents: [folderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: stream,
      },
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: 'id, webViewLink',
    });

    return res.status(200).json({
      success: true,
      fileId: driveResponse.data.id,
      link: driveResponse.data.webViewLink,
    });
  } catch (err) {
    console.error('Google Drive Upload Error:', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
}
