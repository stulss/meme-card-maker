/**
 * EditorController.js
 * CardStateModel(현재 편집 상태)을 소유하고, EditorView 입력 이벤트를
 * 상태 변경 + 재렌더로 연결한다. 재렌더는 requestAnimationFrame으로
 * 배치해 슬라이더를 빠르게 드래그해도 매 픽셀마다 풀 해상도 렌더가
 * 큐잉되지 않게 한다.
 */
class EditorController {
  constructor(view) {
    this.view = view;
    this.cardState = createDefaultCardState();
    this.imageElCache = null; // 현재 로드된 <img> (cardState.imageDataUrl에 대응)
    this._renderQueued = false;
    this._lastResult = { didClip: false, didShrink: false };

    this.view.populateQuickFill(TEXT_CASES);
    this._bindEvents();
    this.view.syncFormFromState(this.cardState);

    // 최초 페인트는 requestAnimationFrame에 의존하지 않고 즉시 그린다.
    // rAF는 숨겨진/배경 탭에서는 브라우저가 아예 호출을 미루기 때문에,
    // 첫 화면이 빈 캔버스로 보이는 상황을 막기 위함이다. 이후 실시간
    // 편집 중 재렌더는 scheduleRender()의 rAF 배치를 그대로 사용한다.
    this._renderNow();
  }

  async _renderNow() {
    this._lastResult = await CardRenderer.renderCard(
      this.view.el.canvas,
      this.cardState,
      this.imageElCache
    );
    this.view.setShrinkHint(this._lastResult.didClip || this._lastResult.didShrink);
    if (this.onRender) this.onRender(this.cardState);
  }

  _bindEvents() {
    const el = this.view.el;

    el.imageInput.addEventListener('change', (e) => this._onImageSelected(e));

    el.fitMode.addEventListener('change', () => {
      this.cardState.imageFitMode = el.fitMode.value;
      this.scheduleRender();
    });

    el.ratioButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cardState.ratio = btn.dataset.ratio;
        this.view.syncFormFromState(this.cardState);
        this.scheduleRender();
      });
    });

    el.textContent.addEventListener('input', () => {
      this.cardState.text.content = el.textContent.value;
      this.scheduleRender();
    });

    el.posX.addEventListener('input', () => {
      this.cardState.text.xRatio = Number(el.posX.value) / 100;
      this.scheduleRender();
    });
    el.posY.addEventListener('input', () => {
      this.cardState.text.yRatio = Number(el.posY.value) / 100;
      this.scheduleRender();
    });
    el.boxW.addEventListener('input', () => {
      this.cardState.text.wRatio = Number(el.boxW.value) / 100;
      this.scheduleRender();
    });
    el.boxH.addEventListener('input', () => {
      this.cardState.text.hRatio = Number(el.boxH.value) / 100;
      this.scheduleRender();
    });
    el.maxFontSize.addEventListener('input', () => {
      this.cardState.text.maxFontSizeRatio = Number(el.maxFontSize.value) / 100;
      this.scheduleRender();
    });
    el.textColor.addEventListener('input', () => {
      this.cardState.text.color = el.textColor.value;
      this.scheduleRender();
    });
    el.bgColor.addEventListener('input', () => {
      this.cardState.backgroundColor = el.bgColor.value;
      this.scheduleRender();
    });

    el.alignButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cardState.text.align = btn.dataset.align;
        this.view.syncFormFromState(this.cardState);
        this.scheduleRender();
      });
    });

    if (el.quickFillSelect) {
      el.quickFillSelect.addEventListener('change', () => {
        const id = el.quickFillSelect.value;
        if (!id) return;
        const tc = TEXT_CASES.find((t) => t.id === id);
        if (tc) {
          this.cardState.text.content = tc.text;
          this.view.el.textContent.value = tc.text;
          this.scheduleRender();
        }
      });
    }

    el.downloadPngBtn.addEventListener('click', () => this.downloadImage('png'));
    el.downloadJpgBtn.addEventListener('click', () => this.downloadImage('jpg'));
  }

  async _onImageSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      alert('지원하지 않는 파일 형식입니다. PNG, JPEG 파일을 사용해 주세요.');
      e.target.value = '';
      return;
    }
    try {
      const { dataUrl } = await toDataUrlDownscaled(file, 1280, 0.85);
      this.cardState.imageDataUrl = dataUrl;
      this.imageElCache = await loadImageFromDataUrl(dataUrl);
      this.scheduleRender();
    } catch (err) {
      alert('이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
      console.error(err);
    }
  }

  /** 템플릿 불러오기 등 외부에서 cardState 전체를 교체할 때 사용 */
  async loadCardState(newState) {
    this.cardState = cloneCardState(newState);
    this.imageElCache = this.cardState.imageDataUrl
      ? await loadImageFromDataUrl(this.cardState.imageDataUrl)
      : null;
    this.view.syncFormFromState(this.cardState);
    this.scheduleRender();
  }

  scheduleRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this._renderNow();
    });
  }

  async downloadImage(format) {
    // 다운로드 직전에도 같은 renderCard를 한 번 더 호출해, 화면에 보이는
    // 마지막 상태와 저장되는 파일이 100% 같은 canvas bitmap이 되도록 한다.
    await CardRenderer.renderCard(this.view.el.canvas, this.cardState, this.imageElCache);
    const canvas = this.view.el.canvas;
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : undefined;
    try {
      const blob = await CardRenderer.exportBlob(canvas, mime, quality);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadBlob(blob, `meme-card-${stamp}.${format}`);
    } catch (err) {
      alert('다운로드에 실패했습니다. 다시 시도해 주세요.');
      console.error(err);
    }
  }
}
