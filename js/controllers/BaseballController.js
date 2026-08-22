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
      useAi: qs('#kbo-use-ai'),
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

  /**
   * AI 배경용 프롬프트를 만든다. 팀명·점수 같은 사실 정보는 넣지 않는다 —
   * AI가 글자를 그려 넣으면 실제 결과와 어긋날 수 있기 때문이다.
   * AI에게는 "분위기"만 맡기고, 사실은 스코어보드가 정확히 담당한다.
   */
  _buildBackgroundPrompt(game) {
    const night = /^(1[89]|2[0-3]):/.test(game.time || '') ? 'under night stadium floodlights' : 'in warm afternoon daylight';
    if (!game.played) {
      return `An empty baseball stadium ${night}, quiet and moody atmosphere, rain-soaked or overcast sky, cinematic wide shot.`;
    }
    return `A dramatic baseball stadium ${night}, packed crowd in the stands, cinematic wide shot, vibrant sports photography atmosphere.`;
  },

  /** 선택한 경기로 배경 이미지 + 문구를 자동 생성해 편집기에 반영한다. */
  async applyGame(index) {
    const game = this.games[index];
    if (!game) return;
    this.selectedIndex = index;

    const cardState = this.editorController.cardState;
    const preset = CardRenderer.RATIO_PRESETS[cardState.ratio] || CardRenderer.RATIO_PRESETS['1:1'];

    const style = this.el.phraseStyle ? this.el.phraseStyle.value : 'none';

    // AI 배경 옵션이 켜져 있으면 야구장 분위기 배경을 먼저 생성한다.
    // 실패하면 조용히 기본(팀 색상 분할) 배경으로 대체한다 — AI는 선택 사항이다.
    let bgImage = null;
    if (this.el.useAi && this.el.useAi.checked && !AiImageClient.isKnownUnavailable()) {
      this._showMessage('AI 배경을 생성하는 중입니다... (몇 초 걸릴 수 있어요)', false);
      try {
        const prompt = this._buildBackgroundPrompt(game);
        const aiUrl = await AiImageClient.generate(prompt, cardState.ratio);
        bgImage = await loadImageFromDataUrl(aiUrl);
      } catch (err) {
        const reason =
          err.code === 'NO_API_KEY' ? 'AI 기능이 아직 설정되지 않아'
            : err.code === 'RATE_LIMITED' ? '오늘 AI 생성 한도를 넘어'
              : 'AI 생성에 실패해';
        this._showMessage(`${reason} 기본 배경으로 만들었습니다.`, false);
      }
    }

    // 경기 결과 자체를 스코어보드 그래픽으로 그린 이미지 (팀명·점수·날짜·승패 포함)
    const dataUrl = await BaseballCardGenerator.generateScoreboard(game, preset.w, preset.h, bgImage);

    cardState.imageDataUrl = dataUrl;
    cardState.imageFitMode = 'cover';

    // 스코어보드 이미지에 이미 정보가 다 들어있으므로 문구는 기본적으로 비운다.
    // 사용자가 코멘트를 덧붙이고 싶으면 문구 스타일을 고르거나 직접 입력하면 된다.
    cardState.text.content = style === 'none' ? '' : BaseballCardGenerator.generatePhrase(game, style);
    cardState.text.color = '#ffffff';
    cardState.text.align = 'center';
    // 코멘트는 하단 여백에 배치 (스코어보드 본문과 겹치지 않도록)
    cardState.text.xRatio = 0.06;
    cardState.text.yRatio = 0.87;
    cardState.text.wRatio = 0.88;
    cardState.text.hRatio = 0.1;
    cardState.text.maxFontSizeRatio = 0.04;

    this.editorController.imageElCache = await loadImageFromDataUrl(dataUrl);
    this.editorController.view.syncFormFromState(cardState);
    this.editorController.scheduleRender();

    this._renderGameList();
    this._showMessage('카드를 만들었습니다. 아래 편집 패널에서 자유롭게 수정할 수 있습니다.', false);
  }
}
