/**
 * BaseballController.js
 * 야구 모드 패널: 날짜 선택 → /api/kbo-schedule 호출 → 경기 목록 표시 →
 * 경기 선택 시 배경 이미지와 문구를 자동으로 채운다.
 *
 * 자동 생성 후에도 기존 편집 패널로 문구·색·위치를 얼마든지 수정할 수 있다.
 * (요구사항: "문구는 직접 입력하거나 자동으로 생성 가능")
 */
class BaseballController {
  constructor(editorController) {
    this.editorController = editorController;
    this.games = [];
    this.selectedIndex = -1;

    this.el = {
      dateInput: qs('#kbo-date-input'),
      loadBtn: qs('#kbo-load-btn'),
      gameList: qs('#kbo-game-list'),
      message: qs('#kbo-message'),
      phraseStyle: qs('#kbo-phrase-style'),
    };

    if (!this.el.dateInput) return; // 패널이 없으면 아무것도 하지 않음

    this._bindEvents();
    this._setDefaultDate();
  }

  _setDefaultDate() {
    // 기본값: 어제(오늘 경기는 아직 진행 중일 수 있으므로)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    kst.setUTCDate(kst.getUTCDate() - 1);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    this.el.dateInput.value = `${y}-${m}-${d}`;
  }

  _bindEvents() {
    this.el.loadBtn.addEventListener('click', () => this.loadGames());
    if (this.el.phraseStyle) {
      this.el.phraseStyle.addEventListener('change', () => {
        if (this.selectedIndex >= 0) this.applyGame(this.selectedIndex);
      });
    }
  }

  _showMessage(text, isError) {
    if (!this.el.message) return;
    this.el.message.textContent = text;
    this.el.message.classList.toggle('error', !!isError);
    this.el.message.hidden = !text;
  }

  async loadGames() {
    const raw = this.el.dateInput.value; // YYYY-MM-DD
    if (!raw) {
      this._showMessage('날짜를 선택해 주세요.', true);
      return;
    }
    const date = raw.replace(/-/g, '');

    this._showMessage('경기 결과를 불러오는 중...', false);
    this.el.loadBtn.disabled = true;

    try {
      const res = await fetch(`/api/kbo-schedule?date=${date}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      this.games = data.games || [];
      this.selectedIndex = -1;
      this._renderGameList();

      if (this.games.length === 0) {
        this._showMessage('그날은 경기가 없습니다. 다른 날짜를 선택해 보세요.', false);
      } else {
        this._showMessage(`${this.games.length}경기를 찾았습니다. 카드로 만들 경기를 선택하세요.`, false);
      }
    } catch (err) {
      this._showMessage(`경기 결과를 불러오지 못했습니다: ${err.message}`, true);
      this.games = [];
      this._renderGameList();
    } finally {
      this.el.loadBtn.disabled = false;
    }
  }

  _renderGameList() {
    const list = this.el.gameList;
    list.innerHTML = '';

    this.games.forEach((game, index) => {
      const li = document.createElement('li');
      li.className = 'kbo-game-item' + (index === this.selectedIndex ? ' active' : '');

      const info = document.createElement('div');
      info.className = 'kbo-game-info';

      const matchup = document.createElement('strong');
      matchup.textContent = game.played
        ? `${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}`
        : `${game.awayTeam} vs ${game.homeTeam}`;

      const meta = document.createElement('span');
      meta.className = 'kbo-game-meta';
      const status = game.played ? (KboTeams.winnerOf(game) ? `${KboTeams.winnerOf(game)} 승` : '무승부') : game.note || '미개최';
      meta.textContent = `${game.time} · ${game.stadium} · ${status}`;

      info.appendChild(matchup);
      info.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '카드 만들기';
      btn.addEventListener('click', () => this.applyGame(index));

      li.appendChild(info);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  /** 선택한 경기로 배경 이미지 + 문구를 자동 생성해 편집기에 반영한다. */
  async applyGame(index) {
    const game = this.games[index];
    if (!game) return;
    this.selectedIndex = index;

    const cardState = this.editorController.cardState;
    const preset = CardRenderer.RATIO_PRESETS[cardState.ratio] || CardRenderer.RATIO_PRESETS['1:1'];

    const style = this.el.phraseStyle ? this.el.phraseStyle.value : 'score';
    const dataUrl = BaseballCardGenerator.generateBackground(game, preset.w, preset.h);
    const phrase = BaseballCardGenerator.generatePhrase(game, style);

    cardState.imageDataUrl = dataUrl;
    cardState.imageFitMode = 'cover';
    cardState.text.content = phrase;
    cardState.text.color = '#ffffff';
    cardState.text.align = 'center';
    // 문구를 하단 중앙에 배치 (배경 하단이 어둡게 처리되어 가독성이 좋음)
    cardState.text.xRatio = 0.06;
    cardState.text.yRatio = 0.6;
    cardState.text.wRatio = 0.88;
    cardState.text.hRatio = 0.32;

    this.editorController.imageElCache = await loadImageFromDataUrl(dataUrl);
    this.editorController.view.syncFormFromState(cardState);
    this.editorController.scheduleRender();

    this._renderGameList();
    this._showMessage('카드를 만들었습니다. 아래 편집 패널에서 자유롭게 수정할 수 있습니다.', false);
  }
}
