/**
 * CardRenderer.js
 * 카드 2(화면과 파일의 일치)의 핵심: 미리보기와 export가 "같은 canvas"를 쓰도록
 * 강제하는 단일 렌더 함수. 별도의 export 전용 canvas는 존재하지 않는다.
 *
 * canvas의 내부 픽셀 해상도(width/height 속성)가 곧 export 해상도이며,
 * CSS(max-width 등)는 화면에 보여주는 크기만 조정할 뿐 내부 버퍼는 건드리지 않는다.
 * devicePixelRatio는 의도적으로 draw 좌표 계산에 사용하지 않는다 - 그러면
 * 화면에 보이는 것과 실제로 저장되는 파일의 좌표가 어긋날 수 있기 때문이다.
 */
const CardRenderer = {
  RATIO_PRESETS: {
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 },
    '9:16': { w: 1080, h: 1920 },
  },

  _fontsReadyPromise: null,

  /** document.fonts.ready + 번들 폰트 명시적 로드를 한 번만 기다리는 캐시된 promise */
  ensureFontsReady() {
    if (this._fontsReadyPromise) return this._fontsReadyPromise;
    this._fontsReadyPromise = (async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      try {
        await document.fonts.load('16px Pretendard');
        await document.fonts.ready;
      } catch (e) {
        // 폰트 로드 실패해도 렌더는 계속 진행 (fallback sans-serif로 표시됨)
      }
    })();
    return this._fontsReadyPromise;
  },

  /**
   * 캔버스를 현재 카드 상태로 렌더링한다. 미리보기 호출과 다운로드 직전 호출이
   * 완전히 동일한 함수를 거치므로 "화면 == 파일"이 구조적으로 보장된다.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object} cardState - CardStateModel 인스턴스
   * @param {HTMLImageElement|null} imgEl - 이미 로드된 <img> (없으면 배경색만)
   * @returns {Promise<{didClip:boolean, didShrink:boolean, finalFontSizePx:number}>}
   */
  async renderCard(canvas, cardState, imgEl) {
    await this.ensureFontsReady();

    const preset = this.RATIO_PRESETS[cardState.ratio] || this.RATIO_PRESETS['1:1'];
    if (canvas.width !== preset.w || canvas.height !== preset.h) {
      canvas.width = preset.w;
      canvas.height = preset.h;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ImageFit.draw(ctx, imgEl, canvas.width, canvas.height, cardState.imageFitMode, cardState.backgroundColor);

    const text = cardState.text;
    const box = {
      x: text.xRatio * canvas.width,
      y: text.yRatio * canvas.height,
      w: text.wRatio * canvas.width,
      h: text.hRatio * canvas.height,
    };
    const maxFontSizePx = Math.max(10, text.maxFontSizeRatio * canvas.height);

    const result = TextLayout.fitAndDraw(ctx, text, box, {
      maxFontSizePx,
      minFontSizePx: 10,
      lineHeightRatio: 1.25,
    });

    return result;
  },

  /** 현재 canvas 내용을 그대로 Blob으로 추출 (export). 화면과 동일한 bitmap. */
  exportBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))),
        mimeType || 'image/png',
        quality
      );
    });
  },
};
