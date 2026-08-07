// Helper to draw images centered and cropped (object-fit: cover)
function drawImageCover(ctx, img, dx, dy, dWidth, dHeight) {
  const imgRatio = img.width / img.height;
  const targetRatio = dWidth / dHeight;
  let sx, sy, sWidth, sHeight;

  if (imgRatio > targetRatio) {
    sHeight = img.height;
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = img.width;
    sHeight = img.width / targetRatio;
    sx = 0;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

// Load image promise wrapper
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function createMarketingGraphic(beforeUrl, afterUrl, jobTitle = '') {
  const [beforeImg, afterImg] = await Promise.all([
    loadImage(beforeUrl),
    loadImage(afterUrl)
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Crisp High-Res Output (1920x1080 HD Widescreen)
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  const BANNER_HEIGHT = 100;
  const PHOTO_HEIGHT = CANVAS_HEIGHT - BANNER_HEIGHT; // 980px
  const HALF_WIDTH = (CANVAS_WIDTH - 6) / 2; // 957px each with 6px center gap

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 1. Render Before Image (Left Panel)
  drawImageCover(ctx, beforeImg, 0, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 2. Render After Image (Right Panel)
  drawImageCover(ctx, afterImg, HALF_WIDTH + 6, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 3. Center Seam Divider
  ctx.fillStyle = '#334155';
  ctx.fillRect(HALF_WIDTH, 0, 6, PHOTO_HEIGHT);

  // 4. BEFORE Badge (Red Tag)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(30, 30, 160, 50, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BEFORE', 30 + 80, 30 + 25);

  // 5. AFTER Badge (Green Tag)
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(HALF_WIDTH + 36, 30, 160, 50, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText('AFTER', HALF_WIDTH + 36 + 80, 30 + 25);

  // 6. Bottom Marketing Banner
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, PHOTO_HEIGHT, CANVAS_WIDTH, BANNER_HEIGHT);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PHOTO_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH, PHOTO_HEIGHT);
  ctx.stroke();

  // Bottom Tagline Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // Brand Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillText('🛡️ Argus CRM', 40, PHOTO_HEIGHT + (BANNER_HEIGHT / 2));

  // Separator & Job Description
  ctx.fillStyle = '#eab308';
  const cleanTitle = jobTitle ? ` • ${jobTitle}` : '';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText(cleanTitle, 280, PHOTO_HEIGHT + (BANNER_HEIGHT / 2));

  // High Quality Compression (0.92)
  return canvas.toDataURL('image/jpeg', 0.92);
}
