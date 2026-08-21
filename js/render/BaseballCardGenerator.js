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
   * 경기 결과에 맞는 배경 이미지를 생성한다.
   * - 정상 경기: 승리팀 상징색 그라디언트 + 대각선 스트라이프
   * - 무승부/취소: 중립 회색 그라디언트
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
