/**
 * AutoImageGenerator.js
 * 사용자가 이미지를 직접 업로드하지 않아도 되도록, 절차적으로(도형+그라디언트)
 * 배경 이미지를 즉석에서 생성한다. 외부 이미지·AI 생성 API에 의존하지 않으므로
 * 서버·비용·저작권 문제가 없다. tools/generate-fixtures.html의 절차적 생성
 * 기법을 재사용하되, 매번 무작위 팔레트·도형으로 다른 결과를 만든다.
 */
const AutoImageGenerator = {
  PALETTES: [
    { top: [255, 179, 71], bottom: [255, 94, 148] }, // 선셋
    { top: [135, 206, 250], bottom: [255, 250, 205] }, // 맑은 하늘
    { top: [60, 60, 120], bottom: [20, 20, 40] }, // 밤하늘
    { top: [255, 200, 210], bottom: [200, 160, 255] }, // 파스텔
    { top: [80, 200, 180], bottom: [30, 90, 110] }, // 민트
    { top: [250, 230, 210], bottom: [90, 70, 100] }, // 웜그레이
    { top: [255, 240, 150], bottom: [255, 140, 90] }, // 여름
    { top: [40, 40, 60], bottom: [90, 30, 60] }, // 딥퍼플
  ],

  SHAPE_STYLES: ['circles', 'stripes', 'triangles'],

  _rand(min, max) {
    return min + Math.random() * (max - min);
  },

  _drawGradient(ctx, w, h, palette) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${palette.top.join(',')})`);
    grad.addColorStop(1, `rgb(${palette.bottom.join(',')})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  },

  _drawCircles(ctx, w, h) {
    const count = Math.floor(this._rand(15, 30));
    for (let i = 0; i < count; i++) {
      const r = this._rand(10, Math.min(w, h) * 0.12);
      const x = this._rand(0, w);
      const y = this._rand(0, h);
      ctx.fillStyle = `rgba(255,255,255,${this._rand(0.05, 0.22).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawStripes(ctx, w, h) {
    const count = Math.floor(this._rand(5, 9));
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < count; i++) {
      const x = (w / count) * i - w * 0.1;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + w * 0.08, 0);
      ctx.lineTo(x + w * 0.16, 0);
      ctx.lineTo(x + w * 0.08, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  _drawTriangles(ctx, w, h) {
    const count = Math.floor(this._rand(6, 10));
    for (let i = 0; i < count; i++) {
      const cx = this._rand(0, w);
      const cy = this._rand(0, h);
      const size = this._rand(30, Math.min(w, h) * 0.18);
      ctx.fillStyle = `rgba(255,255,255,${this._rand(0.05, 0.18).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy + size);
      ctx.lineTo(cx - size, cy + size);
      ctx.closePath();
      ctx.fill();
    }
  },

  /**
   * @param {number} w 캔버스 너비(px)
   * @param {number} h 캔버스 높이(px)
   * @returns {string} PNG dataURL
   */
  generate(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const palette = this.PALETTES[Math.floor(Math.random() * this.PALETTES.length)];
    const style = this.SHAPE_STYLES[Math.floor(Math.random() * this.SHAPE_STYLES.length)];

    this._drawGradient(ctx, w, h, palette);
    if (style === 'circles') this._drawCircles(ctx, w, h);
    else if (style === 'stripes') this._drawStripes(ctx, w, h);
    else this._drawTriangles(ctx, w, h);

    return canvas.toDataURL('image/png');
  },
};
