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
      aiMode: qs('#kbo-ai-mode'),
      promptBox: qs('#kbo-prompt-box'),
      promptSummary: qs('#kbo-prompt-summary'),
      promptText: qs('#kbo-prompt-text'),
      promptRegenBtn: qs('#kbo-prompt-regen-btn'),
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
    if (this.el.promptRegenBtn) {
      // 프롬프트를 직접 고친 뒤 다시 생성 (AI 옵션을 자동으로 켠다)
      this.el.promptRegenBtn.addEventListener('click', () => {
        if (this.selectedIndex < 0) {
          this._showMessage('먼저 경기를 선택해 주세요.', true);
          return;
        }
        // 프롬프트를 고쳐 다시 만드는 것이므로 AI가 꺼져 있으면 무료 AI로 켜준다
        if (this.el.aiMode && this.el.aiMode.value === 'none') {
          this.el.aiMode.value = 'free';
        }
        this.applyGame(this.selectedIndex, { keepPrompt: true });
      });
    }
  }

  _showMessage(text, isError) {
    if (!this.el.message) return;
    this.el.message.textContent = text;
    this.el.message.classList.toggle('error', !!isError);
    this.el.message.hidden = !text;
  }

  /** 자동 작성된 프롬프트를 화면에 보여준다 (사용자가 직접 고칠 수도 있다) */
  _showPrompt(summary, prompt) {
    if (!this.el.promptBox) return;
    this.el.promptBox.hidden = false;
    if (this.el.promptSummary) this.el.promptSummary.textContent = summary;
    if (this.el.promptText) this.el.promptText.value = prompt;
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

  /** 선택한 경기로 이미지 + 문구를 자동 생성해 편집기에 반영한다. */
  async applyGame(index, options) {
    const game = this.games[index];
    if (!game) return;
    this.selectedIndex = index;
    const keepPrompt = !!(options && options.keepPrompt);

    // 이 호출의 순번. AI 생성은 10초 이상 걸릴 수 있어 그 사이 다른 경기를
    // 고를 수 있으므로, 반영 직전에 아직 최신 요청인지 확인한다.
    this._requestSeq = (this._requestSeq || 0) + 1;
    const mySeq = this._requestSeq;

    const cardState = this.editorController.cardState;
    const preset = CardRenderer.RATIO_PRESETS[cardState.ratio] || CardRenderer.RATIO_PRESETS['1:1'];

    const style = this.el.phraseStyle ? this.el.phraseStyle.value : 'none';
    // 기본값은 'none'(AI 사용 안 함). 사용자가 명시적으로 골라야 AI를 쓴다.
    const aiMode = this.el.aiMode ? this.el.aiMode.value : 'none';
    const wantsAi = aiMode !== 'none';

    // 경기 데이터로 AI 포스터 프롬프트를 자동 작성한다 (AI를 안 쓰더라도 화면에 보여준다).
    // keepPrompt면 사용자가 손댄 프롬프트를 덮어쓰지 않는다.
    const built = BaseballPromptBuilder.buildWithSummary(game, cardState.ratio);
    if (!keepPrompt) this._showPrompt(built.summary, built.prompt);

    let dataUrl = null;
    let aiNote = '';

    if (wantsAi) {
      this._showMessage('AI가 포스터를 그리는 중입니다... (10초 이상 걸릴 수 있어요)', false);
      try {
        // 사용자가 프롬프트를 직접 고쳤다면 그 내용을 우선한다
        const promptToUse = (this.el.promptText && this.el.promptText.value.trim()) || built.prompt;
        dataUrl = await AiImageClient.generate(promptToUse, cardState.ratio, 'poster', aiMode);
      } catch (err) {
        aiNote =
          err.code === 'NO_API_KEY' ? ' (OpenAI 키가 없어 스코어보드로 생성 — 무료 AI를 선택해 보세요)'
            : err.code === 'RATE_LIMITED' ? ' (AI 생성 한도 초과로 스코어보드로 생성)'
              : err.code === 'CONTENT_POLICY' ? ' (AI가 이 내용을 거부해 스코어보드로 생성)'
                : ` (AI 생성 실패로 스코어보드로 생성: ${err.message})`;
      }
    }

    // AI를 안 썼거나 실패했으면 정확한 스코어보드 그래픽으로 만든다
    if (!dataUrl) {
      dataUrl = await BaseballCardGenerator.generateScoreboard(game, preset.w, preset.h, null);
    }

    // AI 응답을 기다리는 사이 사용자가 다른 경기를 골랐다면, 뒤늦게 도착한
    // 이 결과로 화면을 덮어쓰지 않는다.
    if (this._requestSeq !== mySeq) return;

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

    // AI가 200과 함께 깨진 이미지를 줄 수 있다. 여기서 잡지 않으면 예외가
    // 위로 던져져 "생성 중" 메시지가 영구히 고정된다.
    try {
      this.editorController.imageElCache = await loadImageFromDataUrl(dataUrl);
    } catch (err) {
      console.warn('[BaseballController] 생성된 이미지를 불러오지 못했습니다:', err);
      const fallback = await BaseballCardGenerator.generateScoreboard(game, preset.w, preset.h, null);
      cardState.imageDataUrl = fallback;
      this.editorController.imageElCache = await loadImageFromDataUrl(fallback);
      aiNote = ' (AI 이미지가 손상돼 스코어보드로 생성)';
    }
    this.editorController.view.syncFormFromState(cardState);
    this.editorController.scheduleRender();

    this._renderGameList();
    this._showMessage(`카드를 만들었습니다. 아래 편집 패널에서 자유롭게 수정할 수 있습니다.${aiNote}`, false);
  }
}
