// Draws full uncropped image centered inside target box and returns its exact coordinates
function drawImageContain(ctx, img, dx, dy, dWidth, dHeight) {
  const imgRatio = img.width / img.height;
  const targetRatio = dWidth / dHeight;

  let renderWidth, renderHeight;

  if (imgRatio > targetRatio) {
    renderWidth = dWidth;
    renderHeight = dWidth / imgRatio;
  } else {
    renderHeight = dHeight;
    renderWidth = dHeight * imgRatio;
  }

  const renderX = dx + (dWidth - renderWidth) / 2;
  const renderY = dy + (dHeight - renderHeight) / 2;

  // Solid dark slate panel (replaces the messy ghosting effect)
  ctx.fillStyle = '#111622';
  ctx.fillRect(dx, dy, dWidth, dHeight);

  // Soft drop shadow under the main photo
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  // Draw 100% complete uncropped foreground photo
  ctx.drawImage(img, renderX, renderY, renderWidth, renderHeight);
  ctx.restore();

  // Subtle border around the actual photo edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(renderX, renderY, renderWidth, renderHeight);

  return { renderX, renderY, renderWidth, renderHeight };
}

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

  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  const BANNER_HEIGHT = 110;
  const PHOTO_HEIGHT = CANVAS_HEIGHT - BANNER_HEIGHT; // 970px
  const HALF_WIDTH = (CANVAS_WIDTH - 4) / 2; // 958px

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Canvas dark base
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 1. Draw Before Image
  const beforeBounds = drawImageContain(ctx, beforeImg, 0, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 2. Draw After Image
  const afterBounds = drawImageContain(ctx, afterImg, HALF_WIDTH + 4, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 3. Center Seam
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(HALF_WIDTH, 0, 4, PHOTO_HEIGHT);

  // Helper to pin BEFORE/AFTER badges directly inside the actual photo corner
  const drawBadge = (bounds, text) => {
    const badgeWidth = 180;
    const badgeHeight = 52;
    const badgeX = bounds.renderX + 16;
    const badgeY = bounds.renderY + 16;
    const badgeRadius = 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)'; // Dark slate fill
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px "Arial Black", "Impact", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX + (badgeWidth / 2), badgeY + (badgeHeight / 2));
  };

  // 4. Pin Badges to Actual Photo Corners
  drawBadge(beforeBounds, 'BEFORE');
  drawBadge(afterBounds, 'AFTER');

  // 5. Bottom Marketing Banner
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, PHOTO_HEIGHT, CANVAS_WIDTH, BANNER_HEIGHT);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PHOTO_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH, PHOTO_HEIGHT);
  ctx.stroke();

  // Branding: IRON FOOT COMPANY
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const brandX = 40;
  const brandY = PHOTO_HEIGHT + (BANNER_HEIGHT / 2);
  const brandText = 'IRON FOOT COMPANY';

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px "Arial Black", "Impact", system-ui, sans-serif';
  ctx.fillText(brandText, brandX, brandY);

  const brandWidth = ctx.measureText(brandText).width;

  if (jobTitle) {
    ctx.fillStyle = '#eab308'; // Signature yellow
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText(`•  ${jobTitle}`, brandX + brandWidth + 24, brandY);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
