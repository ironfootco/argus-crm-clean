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

  // Set uniform height for crisp high-resolution output
  const PHOTO_HEIGHT = 1200;
  const SEAM_WIDTH = 6;
  const BANNER_HEIGHT = 120;

  // Calculate dynamic widths based on exact photo aspect ratios
  const beforeWidth = Math.round(PHOTO_HEIGHT * (beforeImg.width / beforeImg.height));
  const afterWidth = Math.round(PHOTO_HEIGHT * (afterImg.width / afterImg.height));

  const CANVAS_WIDTH = beforeWidth + afterWidth + SEAM_WIDTH;
  const CANVAS_HEIGHT = PHOTO_HEIGHT + BANNER_HEIGHT;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // 1. Draw Before Photo (Left - 100% Uncropped)
  ctx.drawImage(beforeImg, 0, 0, beforeWidth, PHOTO_HEIGHT);

  // 2. Draw After Photo (Right - 100% Uncropped, Flush Next To Before)
  ctx.drawImage(afterImg, beforeWidth + SEAM_WIDTH, 0, afterWidth, PHOTO_HEIGHT);

  // 3. Center Seam Divider Line
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(beforeWidth, 0, SEAM_WIDTH, PHOTO_HEIGHT);

  // Helper for Badges
  const drawBadge = (x, y, text) => {
    const badgeWidth = 200;
    const badgeHeight = 58;
    const badgeRadius = 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(x, y, badgeWidth, badgeHeight, badgeRadius);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px "Arial Black", "Impact", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + (badgeWidth / 2), y + (badgeHeight / 2));
  };

  // 4. Pin BEFORE and AFTER Badges to Image Top-Left Corners
  drawBadge(24, 24, 'BEFORE');
  drawBadge(beforeWidth + SEAM_WIDTH + 24, 24, 'AFTER');

  // 5. Bottom Marketing Banner (Spans Full Dynamic Width)
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, PHOTO_HEIGHT, CANVAS_WIDTH, BANNER_HEIGHT);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PHOTO_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH, PHOTO_HEIGHT);
  ctx.stroke();

  // Branding Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const brandX = 40;
  const brandY = PHOTO_HEIGHT + (BANNER_HEIGHT / 2);
  const brandText = 'IRON FOOT COMPANY';

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px "Arial Black", "Impact", system-ui, sans-serif';
  ctx.fillText(brandText, brandX, brandY);

  const brandWidth = ctx.measureText(brandText).width;

  if (jobTitle) {
    ctx.fillStyle = '#eab308'; // Signature yellow
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText(`•  ${jobTitle}`, brandX + brandWidth + 24, brandY);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
