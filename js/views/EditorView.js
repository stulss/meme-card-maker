/**
 * EditorView.js
 * 편집 패널의 DOM 입력 요소를 읽고 쓰는 뷰. 상태를 직접 소유하지 않고,
 * change 콜백을 통해 컨트롤러에 위임한다 (컨트롤러가 CardStateModel을 소유).
 */
class EditorView {
  constructor(root) {
    this.root = root;
    this.el = {
      imageInput: qs('#image-input', root),
      fitMode: qs('#fit-mode', root),
      ratioButtons: qsa('.ratio-btn', root),
      textContent: qs('#text-content', root),
      posX: qs('#pos-x', root),
      posY: qs('#pos-y', root),
      boxW: qs('#box-w', root),
      boxH: qs('#box-h', root),
      maxFontSize: qs('#max-font-size', root),
      textColor: qs('#text-color', root),
      bgColor: qs('#bg-color', root),
      alignButtons: qsa('.align-btn', root),
      quickFillSelect: qs('#quick-fill-select', root),
      shrinkHint: qs('#shrink-hint', root),
      canvas: qs('#preview-canvas', root),
      canvasWrap: qs('#preview-canvas-wrap', root),
      downloadPngBtn: qs('#download-png-btn', root),
      downloadJpgBtn: qs('#download-jpg-btn', root),
    };
  }

  /** cardState 값을 폼 입력에 반영한다 (템플릿 불러오기 등, 되먹임 렌더 아님) */
  syncFormFromState(cardState) {
    this.el.fitMode.value = cardState.imageFitMode;
    this.el.textContent.value = cardState.text.content;
    this.el.posX.value = Math.round(cardState.text.xRatio * 100);
    this.el.posY.value = Math.round(cardState.text.yRatio * 100);
    this.el.boxW.value = Math.round(cardState.text.wRatio * 100);
    this.el.boxH.value = Math.round(cardState.text.hRatio * 100);
    this.el.maxFontSize.value = Math.round(cardState.text.maxFontSizeRatio * 100);
    this.el.textColor.value = cardState.text.color;
    this.el.bgColor.value = cardState.backgroundColor;

    this.el.ratioButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.ratio === cardState.ratio);
      btn.setAttribute('aria-pressed', String(btn.dataset.ratio === cardState.ratio));
    });
    this.el.alignButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.align === cardState.text.align);
      btn.setAttribute('aria-pressed', String(btn.dataset.align === cardState.text.align));
    });

    const wrap = this.el.canvasWrap;
    if (wrap) {
      wrap.style.setProperty(
        '--ratio-w',
        String(CardRenderer.RATIO_PRESETS[cardState.ratio].w)
      );
      wrap.style.setProperty(
        '--ratio-h',
        String(CardRenderer.RATIO_PRESETS[cardState.ratio].h)
      );
    }
  }

  setShrinkHint(visible) {
    if (!this.el.shrinkHint) return;
    this.el.shrinkHint.hidden = !visible;
  }

  populateQuickFill(textCases) {
    if (!this.el.quickFillSelect) return;
    const select = this.el.quickFillSelect;
    select.innerHTML = '<option value="">-- 검사 문구 빠른 입력 --</option>';
    textCases.forEach((tc) => {
      const opt = document.createElement('option');
      opt.value = tc.id;
      opt.textContent = tc.label;
      select.appendChild(opt);
    });
  }
}
