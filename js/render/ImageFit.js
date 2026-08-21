/**
 * ImageFit.js
 * 이미지를 캔버스에 cover(꽉 채우고 넘치는 부분 자르기) 또는
 * contain(전체가 보이도록 배경색으로 여백 채우기) 방식으로 배치하는 계산.
 */
const ImageFit = {
  /**
   * @returns {{sx,sy,sw,sh,dx,dy,dw,dh}} drawImage에 바로 넘길 수 있는 좌표 세트
   */
  computeFitRect(srcW, srcH, dstW, dstH, mode) {
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;

    if (mode === 'contain') {
      // 전체 이미지가 보이도록 축소, 캔버스 안에 레터박스
      let dw = dstW;
      let dh = dstW / srcAspect;
      if (dh > dstH) {
        dh = dstH;
        dw = dstH * srcAspect;
      }
      const dx = (dstW - dw) / 2;
      const dy = (dstH - dh) / 2;
      return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx, dy, dw, dh };
    }

    // cover(기본값): 캔버스를 꽉 채우고 넘치는 부분은 원본에서 잘라낸다
    let sw = srcW;
    let sh = srcH;
    if (srcAspect > dstAspect) {
      // 원본이 더 넓음 -> 좌우를 자른다
      sw = srcH * dstAspect;
    } else {
      // 원본이 더 좁음(세로로 김) -> 위아래를 자른다
      sh = srcW / dstAspect;
    }
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    return { sx, sy, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
  },

  /**
   * 배경색을 먼저 채운 뒤(contain에서 여백이 생기므로) 이미지를 그린다.
   */
  draw(ctx, imgEl, canvasW, canvasH, mode, backgroundColor) {
    ctx.fillStyle = backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    if (!imgEl) return;
    const srcW = imgEl.naturalWidth || imgEl.width;
    const srcH = imgEl.naturalHeight || imgEl.height;
    if (!srcW || !srcH) return;
    const r = this.computeFitRect(srcW, srcH, canvasW, canvasH, mode);
    ctx.drawImage(imgEl, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  },
};
