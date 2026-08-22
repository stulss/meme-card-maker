/**
 * BaseballCardGenerator.js
 * KBO 경기 결과 하나로부터 (1) 배경 이미지와 (2) 카드 문구를 자동 생성한다.
 *
 * 배경은 AutoImageGenerator와 같은 원리(절차적 canvas 그리기)지만, 무작위
 * 팔레트 대신 "승리팀 상징색"을 써서 경기 결과가 색으로 드러나게 한다.
 * 구단 로고·엠블럼 이미지는 저작권 때문에 쓰지 않고 색상만 활용한다.
 */
const BaseballCardGenerator = {
  /**
   * 경기 결과 자체를 스코어보드 그래픽으로 그린 완성 이미지를 만든다.
   * 배경색만 칠하는 generateBackground와 달리, 팀명·점수·날짜·구장·승패까지
   * 이미지 안에 직접 렌더링하므로 이 이미지 하나로 카드가 완성된다.
   *
   * 좌우를 각 팀 상징색으로 나누고, 패배팀 쪽은 어둡게 처리해 결과가
   * 한눈에 보이게 한다. 구단 로고·엠블럼은 저작권 때문에 쓰지 않는다.
   *
   * @returns {Promise<string>} PNG dataURL
   */
  async generateScoreboard(game, w, h, bgImage) {
    await CardRenderer.ensureFontsReady();

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const font = 'Pretendard, "Malgun Gothic", sans-serif';

    const awayTeam = KboTeams.get(game.awayTeam);
    const homeTeam = KboTeams.get(game.homeTeam);
    const winner = KboTeams.winnerOf(game);
    const awayWon = winner === game.awayTeam;
    const homeWon = winner === game.homeTeam;

    const half = w / 2;
    const awayFill = game.played && homeWon ? this._darken(awayTeam.primary, 0.55) : awayTeam.primary;
    const homeFill = game.played && awayWon ? this._darken(homeTeam.primary, 0.55) : homeTeam.primary;

    // 1) 배경
    if (bgImage) {
      // AI가 만든 배경 사진 위에 팀 색을 반투명하게 얹는다.
      // 분위기는 AI가, 결과(색·숫자)는 우리가 정확하게 담당하는 구조.
      ImageFit.draw(ctx, bgImage, w, h, 'cover', '#12141c');
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = awayFill;
      ctx.fillRect(0, 0, half, h);
      ctx.fillStyle = homeFill;
      ctx.fillRect(half, 0, w - half, h);
      ctx.restore();
      if (!game.played) {
        ctx.fillStyle = 'rgba(15,17,23,0.62)';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      // 기본: 좌우 팀 색상 분할 (패배팀은 어둡게)
      ctx.fillStyle = awayFill;
      ctx.fillRect(0, 0, half, h);
      ctx.fillStyle = homeFill;
      ctx.fillRect(half, 0, w - half, h);

      // 미개최 경기는 전체를 어둡게 (결과 없음을 시각적으로 표현)
      if (!game.played) {
        ctx.fillStyle = 'rgba(15,17,23,0.72)';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 2) 상하 그라디언트로 깊이감 + 텍스트 가독성 확보
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, 'rgba(0,0,0,0.45)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0.12)');
    shade.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    // 3) 가운데 세로 구분선
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(half, h * 0.2);
    ctx.lineTo(half, h * 0.8);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3-1) 구단 엠블럼 (있으면 팀명 위에 배치)
    // AI에게 로고를 그리게 하면 반드시 뭉개지므로, 공식 엠블럼 이미지를 직접 합성한다.
    const [awayLogo, homeLogo] = await Promise.all([
      this._loadLogo(game.awayTeam),
      this._loadLogo(game.homeTeam),
    ]);
    const logoBox = h * 0.1;
    if (awayLogo) this._drawLogo(ctx, awayLogo, w * 0.25, h * 0.235, logoBox);
    if (homeLogo) this._drawLogo(ctx, homeLogo, w * 0.75, h * 0.235, logoBox);

    // 4) 상단: 날짜 · 구장
    const headerSize = Math.round(h * 0.036);
    ctx.font = `${headerSize}px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const headerParts = [game.dateLabel, game.stadium].filter(Boolean);
    ctx.fillText(headerParts.join('  ·  '), w / 2, h * 0.1);

    // 상단 구분선
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, w * 0.002);
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.14);
    ctx.lineTo(w * 0.75, h * 0.14);
    ctx.stroke();

    // 5) 팀명 (좌: 원정 / 우: 홈) — 로고 아래에 배치
    const teamSize = Math.round(h * 0.058);
    ctx.font = `700 ${teamSize}px ${font}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.awayTeam, w * 0.25, h * 0.325);
    ctx.fillText(game.homeTeam, w * 0.75, h * 0.325);

    // 원정/홈 표시
    const tagSize = Math.round(h * 0.025);
    ctx.font = `${tagSize}px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('원정', w * 0.25, h * 0.375);
    ctx.fillText('홈', w * 0.75, h * 0.375);

    // 6) 점수 (또는 미개최 표시)
    if (game.played) {
      const scoreSize = Math.round(h * 0.17);
      ctx.font = `800 ${scoreSize}px ${font}`;

      ctx.fillStyle = awayWon ? '#ffffff' : 'rgba(255,255,255,0.62)';
      ctx.fillText(String(game.awayScore), w * 0.25, h * 0.52);

      ctx.fillStyle = homeWon ? '#ffffff' : 'rgba(255,255,255,0.62)';
      ctx.fillText(String(game.homeScore), w * 0.75, h * 0.52);

      // 가운데 콜론
      ctx.font = `600 ${Math.round(h * 0.07)}px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(':', w / 2, h * 0.52);

      // 승리팀 쪽에 WIN 배지
      if (winner) {
        const badgeX = awayWon ? w * 0.25 : w * 0.75;
        const badgeW = w * 0.14;
        const badgeH = h * 0.045;
        ctx.fillStyle = '#ffffff';
        this._roundRect(ctx, badgeX - badgeW / 2, h * 0.62 - badgeH / 2, badgeW, badgeH, badgeH / 2);
        ctx.fill();
        ctx.fillStyle = awayWon ? awayTeam.primary : homeTeam.primary;
        ctx.font = `800 ${Math.round(h * 0.028)}px ${font}`;
        ctx.fillText('WIN', badgeX, h * 0.62);
      }
    } else {
      ctx.font = `700 ${Math.round(h * 0.075)}px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('VS', w / 2, h * 0.52);
    }

    // 7) 하단: 결과 문구
    const resultSize = Math.round(h * 0.05);
    ctx.font = `700 ${resultSize}px ${font}`;
    ctx.fillStyle = '#ffffff';
    let resultText;
    if (!game.played) {
      resultText = game.note || '경기 취소';
    } else if (winner) {
      resultText = `${KboTeams.get(winner).name} 승리`;
    } else {
      resultText = '무승부';
    }
    ctx.fillText(resultText, w / 2, h * 0.78);

    // 경기 시간 (개최된 경기만)
    if (game.time) {
      ctx.font = `${Math.round(h * 0.026)}px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(game.time, w / 2, h * 0.845);
    }

    return canvas.toDataURL('image/png');
  },

  /** 로고 이미지 캐시 (같은 팀을 반복 로드하지 않도록) */
  _logoCache: {},

  /**
   * 구단 엠블럼을 로드한다. 파일이 없거나 실패하면 null을 반환해
   * 로고 없이도 카드가 정상 생성되도록 한다.
   */
  _loadLogo(teamCode) {
    const path = KboTeams.logoPath(teamCode);
    if (!path) return Promise.resolve(null);
    if (this._logoCache[path] !== undefined) return Promise.resolve(this._logoCache[path]);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._logoCache[path] = img;
        resolve(img);
      };
      img.onerror = () => {
        this._logoCache[path] = null;
        resolve(null);
      };
      img.src = path;
    });
  },

  /** 로고를 (cx, cy) 중심에 box 크기 안에 비율 유지하며 그린다 */
  _drawLogo(ctx, img, cx, cy, box) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.min(box / iw, box / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  },

  /** 둥근 사각형 경로 (배지용) */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  /**
   * (구버전) 경기 결과에 맞는 단순 배경 이미지를 생성한다.
   * 지금은 generateScoreboard를 쓰지만, 배경만 필요할 때를 위해 남겨둔다.
   * @returns {string} PNG dataURL
   */
  generateBackground(game, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const winner = KboTeams.winnerOf(game);
    let topColor;
    let bottomColor;

    if (winner) {
      const team = KboTeams.get(winner);
      topColor = team.primary;
      bottomColor = this._darken(team.primary, 0.55);
    } else {
      // 무승부 또는 미개최
      topColor = '#3a3a48';
      bottomColor = '#1b1b24';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 대각선 스트라이프 (야구 유니폼 느낌의 은은한 질감)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    const stripeW = Math.max(12, w * 0.02);
    for (let x = -h; x < w; x += stripeW * 3) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + stripeW, h);
      ctx.lineTo(x + stripeW + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 하단 어둡게 (문구 가독성 확보)
    const shade = ctx.createLinearGradient(0, h * 0.45, 0, h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    return canvas.toDataURL('image/png');
  },

  /**
   * 경기 결과로 카드 문구를 만든다.
   * @param {object} game
   * @param {'score'|'headline'|'summary'} [style]
   * @returns {string}
   */
  generatePhrase(game, style) {
    if (!game) return '';
    const dateLabel = game.dateLabel || '';

    if (!game.played) {
      const reason = game.note || '경기 취소';
      return `${dateLabel}\n${game.awayTeam} vs ${game.homeTeam}\n${reason}`;
    }

    const winner = KboTeams.winnerOf(game);
    const chosen = style || 'score';

    if (chosen === 'headline') {
      if (!winner) {
        return `${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}\n무승부`;
      }
      const loser = winner === game.awayTeam ? game.homeTeam : game.awayTeam;
      const wScore = winner === game.awayTeam ? game.awayScore : game.homeScore;
      const lScore = winner === game.awayTeam ? game.homeScore : game.awayScore;
      const diff = wScore - lScore;
      const flavor = diff >= 7 ? '완승!' : diff === 1 ? '한 점 차 승부!' : '승리!';
      return `${KboTeams.get(winner).name}\n${loser} 상대 ${wScore}-${lScore} ${flavor}`;
    }

    if (chosen === 'summary') {
      const resultWord = winner ? `${winner} 승` : '무승부';
      return `${dateLabel} ${game.stadium}\n${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}\n${resultWord}`;
    }

    // 기본: score
    return `${dateLabel}\n${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}`;
  },

  /** hex 색상을 어둡게 만든다 (0~1, 클수록 어두움) */
  _darken(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return '#1b1b24';
    const num = parseInt(m[1], 16);
    const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
    const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
    const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  },
};
