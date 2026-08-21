/**
 * TemplateListView.js
 * 템플릿 목록(생성·불러오기·수정·삭제) 렌더링. 카드 4 요구사항의 화면 담당.
 */
class TemplateListView {
  constructor(root) {
    this.root = root;
    this.el = {
      nameInput: qs('#template-name-input', root),
      saveNewBtn: qs('#template-save-new-btn', root),
      updateCurrentBtn: qs('#template-update-current-btn', root),
      list: qs('#template-list', root),
      message: qs('#template-message', root),
    };
  }

  /**
   * @param {object[]} templates
   * @param {string|null} activeId - 현재 편집 중인 템플릿의 원본 ID(없으면 새 카드)
   * @param {{onLoad:function, onDelete:function}} handlers
   */
  render(templates, activeId, handlers) {
    const list = this.el.list;
    list.innerHTML = '';

    if (templates.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'template-empty';
      empty.textContent = '저장된 템플릿이 없습니다. 편집 후 "새 템플릿으로 저장"을 눌러보세요.';
      list.appendChild(empty);
      return;
    }

    templates.forEach((tpl) => {
      const li = document.createElement('li');
      li.className = 'template-item' + (tpl.id === activeId ? ' active' : '');

      const thumb = document.createElement('div');
      thumb.className = 'template-thumb';
      if (tpl.imageDataUrl) {
        const img = document.createElement('img');
        img.src = tpl.imageDataUrl;
        img.alt = '';
        thumb.appendChild(img);
      } else {
        thumb.style.background = tpl.backgroundColor;
      }

      const info = document.createElement('div');
      info.className = 'template-info';
      const nameEl = document.createElement('strong');
      nameEl.textContent = tpl.name; // textContent이므로 이스케이프 불필요
      const metaEl = document.createElement('span');
      metaEl.className = 'template-meta';
      metaEl.textContent = `${tpl.ratio} · ${formatDateTime(tpl.updatedAt)}`;
      info.appendChild(nameEl);
      info.appendChild(metaEl);

      const actions = document.createElement('div');
      actions.className = 'template-actions';
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.textContent = '불러오기';
      loadBtn.addEventListener('click', () => handlers.onLoad(tpl.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'danger';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`"${tpl.name}" 템플릿을 삭제할까요?`)) handlers.onDelete(tpl.id);
      });

      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(thumb);
      li.appendChild(info);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  showMessage(text, isError) {
    if (!this.el.message) return;
    this.el.message.textContent = text;
    this.el.message.classList.toggle('error', !!isError);
    this.el.message.hidden = !text;
  }

  setUpdateButtonEnabled(enabled) {
    if (this.el.updateCurrentBtn) this.el.updateCurrentBtn.disabled = !enabled;
  }
}
