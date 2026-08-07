// Draws full uncropped image centered inside target box with zero cropping
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

  // 1. Draw ambient background fill (stretched & darkened)
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.drawImage(img, dx, dy, dWidth, dHeight);
  ctx.restore();

  // 2. Draw subtle drop shadow behind the main uncropped image
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  // 3. Render 100% complete uncropped foreground photo
  ctx.drawImage(img, renderX, renderY, renderWidth, renderHeight);
  ctx.restore();

  // 4. Subtle border around the full photo frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(renderX, renderY, renderWidth, renderHeight);
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

  // Full HD Resolution (1920x1080)
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  const BANNER_HEIGHT = 110;
  const PHOTO_HEIGHT = CANVAS_HEIGHT - BANNER_HEIGHT; // 970px
  const HALF_WIDTH = (CANVAS_WIDTH - 6) / 2; // 957px each side

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Dark Canvas Backdrop
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 1. Render Before Image (Left Side - Zero Cropping)
  drawImageContain(ctx, beforeImg, 0, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 2. Render After Image (Right Side - Zero Cropping)
  drawImageContain(ctx, afterImg, HALF_WIDTH + 6, 0, HALF_WIDTH, PHOTO_HEIGHT);

  // 3. Center Divider Seam
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(HALF_WIDTH, 0, 6, PHOTO_HEIGHT);

  // Badge Configuration (Grey background, bold white text)
  const badgeWidth = 200;
  const badgeHeight = 58;
  const badgeY = 28;
  const badgeRadius = 8;

  // 4. BEFORE Badge
  const badgeXBefore = 28;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)'; // Dark slate grey
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(badgeXBefore, badgeY, badgeWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px "Arial Black", "Impact", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BEFORE', badgeXBefore + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // 5. AFTER Badge
  const badgeXAfter = HALF_WIDTH + 34;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';

  ctx.beginPath();
  ctx.roundRect(badgeXAfter, badgeY, badgeWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText('AFTER', badgeXAfter + (badgeWidth / 2), badgeY + (badgeHeight / 2));

  // 6. Bottom Marketing Banner
  ctx.fillStyle = '#070a10';
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
