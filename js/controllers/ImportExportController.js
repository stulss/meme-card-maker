/**
 * ImportExportController.js
 * 카드 5(가져오기/내보내기) 요구사항. 순서가 중요하다:
 * 1) JSON.parse 실패 -> 즉시 거부, 저장소 그대로 유지
 * 2) 스키마 검사 -> 유효/무효 항목 분리
 * 3) 유효 항목이 0개면 거부
 * 4) 유효 항목만 새 ID로 append (기존 목록 교체 없음 -> 손상 파일이 절대
 *    기존 템플릿을 파괴할 수 없다)
 */
class ImportExportController {
  constructor(view, templateController) {
    this.view = view;
    this.templateController = templateController;
    this._bindEvents();
  }

  _bindEvents() {
    this.view.el.exportBtn.addEventListener('click', () => this._exportJson());
    this.view.el.importInput.addEventListener('change', (e) => this._importJson(e));
  }

  _exportJson() {
    const templates = TemplateStore.getAll();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates,
    };
    downloadText(JSON.stringify(payload, null, 2), 'meme-templates.json', 'application/json');
    this.view.showResult(`템플릿 ${templates.length}개를 내보냈습니다.`, false);
  }

  async _importJson(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록

    let text;
    try {
      text = await file.text();
    } catch (err) {
      this.view.showResult('파일을 읽지 못했습니다.', true);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      // 1) JSON 문법 오류 -> 즉시 거부, 기존 템플릿 그대로 유지
      this.view.showResult('JSON 문법이 올바르지 않습니다. 파일을 다시 확인해 주세요.', true);
      return;
    }

    // 2)+3) 스키마 검사
    const { ok, validItems, invalidItems, reason } = validateImportPayload(parsed);
    if (!ok) {
      this.view.showResult(
        `가져오기를 거부했습니다: ${reason} (기존 템플릿은 그대로 유지됩니다.)`,
        true
      );
      return;
    }

    // 4) 유효 항목만 append (교체 아님)
    const result = TemplateStore.appendImported(validItems);
    if (!result.ok) {
      this.view.showResult(result.error, true);
      return;
    }

    const skipped = invalidItems.length;
    const summary =
      skipped > 0
        ? `${result.added}개 가져옴, ${skipped}개는 형식이 맞지 않아 건너뜀.`
        : `${result.added}개를 모두 가져왔습니다.`;
    this.view.showResult(summary, false);
    this.templateController.refresh();
  }
}
