export async function createMarketingGraphic(beforeBase64, afterBase64, jobTitle = 'Completed Project') {
  return new Promise((resolve) => {
    const imgBefore = new Image();
    const imgAfter = new Image();
    let loadedCount = 0;

    const onImgLoad = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      const canvas = document.createElement('canvas');
      const widthPerImg = 960;
      const height = 1080;
      canvas.width = widthPerImg * 2;
      canvas.height = height;

      const ctx = canvas.getContext('2d');

      // 1. Draw Before & After Images side-by-side
      ctx.drawImage(imgBefore, 0, 0, widthPerImg, height);
      ctx.drawImage(imgAfter, widthPerImg, 0, widthPerImg, height);

      // 2. Vertical Center Divider Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(widthPerImg, 0);
      ctx.lineTo(widthPerImg, height);
      ctx.stroke();

      // 3. Draw "BEFORE" & "AFTER" Text Badges
      const drawBadge = (text, x, y, bgColor) => {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, 160, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + 80, y + 34);
      };

      drawBadge('BEFORE', 20, 20, 'rgba(239, 68, 68, 0.9)');
      drawBadge('AFTER', widthPerImg + 20, 20, 'rgba(16, 185, 129, 0.9)');

      // 4. Bottom Branding Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(0, height - 80, canvas.width, 80);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🛡️ Argus CRM  •  ${jobTitle}`, 30, height - 30);

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };

    imgBefore.onload = onImgLoad;
    imgAfter.onload = onImgLoad;
    imgBefore.src = beforeBase64;
    imgAfter.src = afterBase64;
  });
}
