/**
 * TemplateController.js
 * TemplateStore(localStorage CRUD) <-> TemplateListView <-> EditorController 연결.
 * 카드 4(실제 템플릿 관리) 요구사항의 컨트롤러.
 */
class TemplateController {
  constructor(view, editorController) {
    this.view = view;
    this.editorController = editorController;
    this.activeTemplateId = null; // 현재 편집 중인 카드가 어느 템플릿에서 왔는지

    this._bindEvents();
    this.refresh();
  }

  _bindEvents() {
    this.view.el.saveNewBtn.addEventListener('click', () => this._saveNew());
    this.view.el.updateCurrentBtn.addEventListener('click', () => this._updateCurrent());
  }

  refresh() {
    const templates = TemplateStore.getAll();
    this.view.render(templates, this.activeTemplateId, {
      onLoad: (id) => this._load(id),
      onDelete: (id) => this._delete(id),
    });
    this.view.setUpdateButtonEnabled(!!this.activeTemplateId);
  }

  _saveNew() {
    const name = (this.view.el.nameInput.value || '').trim();
    if (!name) {
      this.view.showMessage('템플릿 이름을 입력해 주세요.', true);
      return;
    }
    const result = TemplateStore.create(name, this.editorController.cardState);
    if (!result.ok) {
      this.view.showMessage(result.error, true);
      return;
    }
    this.activeTemplateId = result.record.id;
    this.view.el.nameInput.value = '';
    this.view.showMessage(`"${name}" 템플릿을 저장했습니다.`, false);
    this.refresh();
  }

  _updateCurrent() {
    if (!this.activeTemplateId) return;
    const existing = TemplateStore.getById(this.activeTemplateId);
    const name = existing ? existing.name : (this.view.el.nameInput.value || '').trim();
    const result = TemplateStore.update(this.activeTemplateId, name, this.editorController.cardState);
    if (!result.ok) {
      this.view.showMessage(result.error, true);
      return;
    }
    this.view.showMessage(`"${name}" 템플릿을 수정했습니다.`, false);
    this.refresh();
  }

  async _load(id) {
    const record = TemplateStore.getById(id);
    if (!record) {
      this.view.showMessage('템플릿을 찾을 수 없습니다.', true);
      return;
    }
    const cardState = templateRecordToCardState(record);
    await this.editorController.loadCardState(cardState);
    this.activeTemplateId = id;
    this.view.showMessage(`"${record.name}" 템플릿을 불러왔습니다.`, false);
    this.refresh();
  }

  _delete(id) {
    const record = TemplateStore.getById(id);
    const result = TemplateStore.remove(id);
    if (!result.ok) {
      this.view.showMessage(result.error, true);
      return;
    }
    if (this.activeTemplateId === id) this.activeTemplateId = null;
    this.view.showMessage(`"${record ? record.name : ''}" 템플릿을 삭제했습니다.`, false);
    this.refresh();
  }
}
