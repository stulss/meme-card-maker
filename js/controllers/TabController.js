/**
 * TabController.js
 * 상단 탭(일반 카드 / 야구 카드)을 전환한다.
 *
 * 탭은 "이미지를 어디서 가져올지"만 바꾼다. 편집·미리보기·템플릿·내보내기
 * 패널은 두 모드에서 똑같이 쓰이므로 항상 보인다.
 */
class TabController {
  constructor(root) {
    this.root = root || document;
    this.buttons = qsa('.tab-btn', this.root);
    this.panels = qsa('.tab-panel', this.root);
    if (this.buttons.length === 0) return;

    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.select(btn.dataset.tab));
    });

    // 기본 탭: 일반 카드
    this.select('general');
  }

  select(tabName) {
    this.buttons.forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    this.panels.forEach((panel) => {
      panel.hidden = panel.dataset.tab !== tabName;
    });
  }
}
