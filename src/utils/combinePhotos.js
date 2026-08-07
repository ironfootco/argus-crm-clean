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

  // Full HD Widescreen Output (1920x1080)
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  const BANNER_HEIGHT = 100;
  const PHOTO_HEIGHT = CANVAS_HEIGHT - BANNER_HEIGHT; // 980px
  const HALF_WIDTH = (CANVAS_WIDTH - 6) / 2; // 957px each side with 6px gap

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

  // Badge Styling Parameters (Larger, Dark Slate Grey with Subtle Border)
  const badgeWidth = 220;
  const badgeHeight = 64;
  const badgeY = 32;
  const badgeRadius = 10;

  // 4. BEFORE Badge (Left Side)
  const badgeXBefore = 32;

  ctx.fillStyle = 'rgba(30, 41, 59, 0.88)'; // Dark slate grey backdrop
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; // Subtle highlight border
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(badgeXBefore, badgeY, badgeWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px "Arial Black", "Impact", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BEFORE', badgeXBefore + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // 5. AFTER Badge (Right Side)
  const badgeXAfter = HALF_WIDTH + 38;

  ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
  ctx.beginPath();
  ctx.roundRect(badgeXAfter, badgeY, badgeWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText('AFTER', badgeXAfter + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // 6. Bottom Marketing Banner
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, PHOTO_HEIGHT, CANVAS_WIDTH, BANNER_HEIGHT);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PHOTO_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH, PHOTO_HEIGHT);
  ctx.stroke();

  // Bottom Tagline & Brand Logo Typography
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const brandX = 40;
  const brandY = PHOTO_HEIGHT + (BANNER_HEIGHT / 2);
  const brandText = 'IRON FOOT COMPANY';

  // Heavy Industrial Brand Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px "Arial Black", "Impact", system-ui, sans-serif';
  ctx.fillText(brandText, brandX, brandY);

  // Measure brand text width to calculate dynamic spacing
  const brandWidth = ctx.measureText(brandText).width;

  // Job Title Subtext
  if (jobTitle) {
    ctx.fillStyle = '#eab308'; // Signature yellow accent
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText(`•  ${jobTitle}`, brandX + brandWidth + 24, brandY);
  }

  // High Quality JPG Output (0.92 compression)
  return canvas.toDataURL('image/jpeg', 0.92);
}
