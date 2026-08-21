/**
 * ImportExportView.js
 * 가져오기/내보내기 패널 + 공개 정보 안내 문구(카드 5 통과 기준의 일부).
 */
class ImportExportView {
  constructor(root) {
    this.root = root;
    this.el = {
      exportBtn: qs('#export-json-btn', root),
      importInput: qs('#import-json-input', root),
      resultMessage: qs('#import-export-message', root),
    };
  }

  showResult(text, isError) {
    const el = this.el.resultMessage;
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', !!isError);
    el.hidden = !text;
  }
}
