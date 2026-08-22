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
    this.view.populatePhraseCategories(PhraseTemplates.categories());
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

    if (el.autoImageBtn) {
      el.autoImageBtn.addEventListener('click', () => this._onAutoGenerateImage());
    }
    if (el.autoPhraseBtn) {
      el.autoPhraseBtn.addEventListener('click', () => this._onAutoGeneratePhrase());
    }
    if (el.aiImageBtn) {
      el.aiImageBtn.addEventListener('click', () => this._onAiGenerateImage());
      el.aiPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._onAiGenerateImage();
      });
    }
  }

  _showAiHint(text, isError) {
    const el = this.view.el.aiImageHint;
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', !!isError);
    el.hidden = !text;
  }

  /**
   * 생성형 AI로 배경 이미지를 만든다.
   * 실패해도 앱은 그대로 동작하며, 사용자에게 이유를 알려준다.
   */
  async _onAiGenerateImage() {
    const el = this.view.el;
    const prompt = (el.aiPromptInput.value || '').trim();
    if (!prompt) {
      this._showAiHint('원하는 배경 분위기를 입력해 주세요. (예: 노을 지는 해변)', true);
      return;
    }

    el.aiImageBtn.disabled = true;
    this._showAiHint('AI가 이미지를 만드는 중입니다... (몇 초 걸릴 수 있어요)', false);

    const provider = el.aiProviderSelect ? el.aiProviderSelect.value : 'auto';

    try {
      const dataUrl = await AiImageClient.generate(prompt, this.cardState.ratio, 'background', provider);
      this.cardState.imageDataUrl = dataUrl;
      this.imageElCache = await loadImageFromDataUrl(dataUrl);
      this.scheduleRender();
      this._showAiHint('AI 배경을 적용했습니다. 마음에 안 들면 다시 눌러보세요.', false);
    } catch (err) {
      if (err.code === 'NO_API_KEY') {
        this._showAiHint('OpenAI 키가 없습니다. 옆의 선택을 "무료 AI"로 바꿔보세요.', true);
      } else if (err.code === 'RATE_LIMITED') {
        this._showAiHint('오늘 AI 생성 한도를 모두 사용했습니다. 🎨 버튼을 이용해 주세요.', true);
      } else if (err.code === 'CONTENT_POLICY') {
        this._showAiHint(err.message, true);
      } else {
        this._showAiHint(`AI 생성에 실패했습니다: ${err.message}`, true);
      }
    } finally {
      el.aiImageBtn.disabled = false;
    }
  }

  /**
   * 이미지를 직접 업로드하지 않아도 되도록, 현재 화면비에 맞는 해상도로
   * 절차적 배경 이미지를 즉석에서 생성해 cardState.imageDataUrl에 넣는다.
   * 업로드된 이미지와 동일한 파이프라인(ImageFit → CardRenderer)을 그대로 탄다.
   */
  async _onAutoGenerateImage() {
    const preset = CardRenderer.RATIO_PRESETS[this.cardState.ratio] || CardRenderer.RATIO_PRESETS['1:1'];
    const dataUrl = AutoImageGenerator.generate(preset.w, preset.h);
    this.cardState.imageDataUrl = dataUrl;
    this.imageElCache = await loadImageFromDataUrl(dataUrl);
    this.scheduleRender();
  }

  /** 카테고리 선택에 맞춰(또는 전체 중) 문구를 무작위로 골라 채운다. */
  _onAutoGeneratePhrase() {
    const category = this.view.el.phraseCategorySelect ? this.view.el.phraseCategorySelect.value : '';
    const phrase = PhraseTemplates.random(category);
    this.cardState.text.content = phrase;
    this.view.el.textContent.value = phrase;
    this.scheduleRender();
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

  /**
   * 템플릿 불러오기 등 외부에서 cardState 전체를 교체할 때 사용.
   *
   * 이미지 로드 실패를 여기서 처리하는 이유: 저장된 템플릿의 imageDataUrl은
   * "data:image/로 시작하는 문자열"까지만 검증되므로 base64가 깨져 있어도
   * 저장은 통과한다. 그대로 두면 불러오기 전체가 예외로 중단되어 화면에
   * 아무 반응이 없다. 이미지만 버리고 나머지 설정(문구·색·배치)은 복원한다.
   *
   * @returns {Promise<{imageFailed: boolean}>}
   */
  async loadCardState(newState) {
    this.cardState = cloneCardState(newState);

    let imageFailed = false;
    if (this.cardState.imageDataUrl) {
      try {
        this.imageElCache = await loadImageFromDataUrl(this.cardState.imageDataUrl);
      } catch (err) {
        console.warn('[EditorController] 템플릿 이미지를 불러오지 못했습니다:', err);
        this.cardState.imageDataUrl = null;
        this.imageElCache = null;
        imageFailed = true;
      }
    } else {
      this.imageElCache = null;
    }

    this.view.syncFormFromState(this.cardState);
    this.scheduleRender();
    return { imageFailed };
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
