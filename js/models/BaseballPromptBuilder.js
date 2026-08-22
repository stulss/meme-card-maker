/**
 * BaseballPromptBuilder.js
 * 경기 결과 데이터로부터 AI 포스터 생성용 프롬프트를 자동 작성한다.
 *
 * 설계 원칙:
 * 1. 사용자가 아무것도 안 써도 "카드 만들기" 한 번으로 완성된 프롬프트가 나온다.
 * 2. 점수 차·승패에 따라 분위기(압도적 승리 / 접전 / 무승부 / 취소)를 자동 조절한다.
 * 3. 구단 로고·엠블럼을 그대로 재현하라고 지시하지 않는다. 상표권 문제를 피하기 위해
 *    "그 팀을 상징하는 동물/캐릭터" 수준의 일반적인 묘사만 사용한다.
 * 4. 스코어는 이미지에서 가장 명확하게 읽히도록 강조하고, negative prompt로
 *    다른 숫자가 나오는 것을 막는다.
 */
const BaseballPromptBuilder = {
  /** YYYYMMDD -> "2026.08.21" */
  _formatDate(yyyymmdd) {
    if (!/^\d{8}$/.test(String(yyyymmdd || ''))) return '';
    const s = String(yyyymmdd);
    return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  },

  /** 구장 한글명 -> 영문명 (AI가 구장 분위기를 더 정확히 잡도록) */
  STADIUM_EN: {
    잠실: 'Jamsil Baseball Stadium in Seoul',
    고척: 'Gocheok Sky Dome, an indoor domed stadium in Seoul',
    문학: 'Incheon SSG Landers Field',
    수원: 'Suwon KT Wiz Park',
    대구: 'Daegu Samsung Lions Park',
    광주: 'Gwangju-KIA Champions Field',
    사직: 'Sajik Baseball Stadium in Busan',
    창원: 'Changwon NC Park',
    대전: 'Daejeon Hanwha Life Eagles Park',
    울산: 'Ulsan Munsu Baseball Stadium',
    청주: 'Cheongju Baseball Stadium',
  },

  _stadiumEn(ko) {
    return this.STADIUM_EN[ko] || `${ko} baseball stadium in South Korea`;
  },

  /** 점수 차로 경기 성격을 분류한다 */
  _classify(game) {
    if (!game.played) return 'cancelled';
    const diff = Math.abs(game.awayScore - game.homeScore);
    if (diff === 0) return 'draw';
    if (diff >= 7) return 'blowout';
    if (diff <= 1) return 'nailbiter';
    return 'normal';
  },

  /** 경기 성격별 영어 분위기 묘사 */
  _moodEn(kind) {
    switch (kind) {
      case 'blowout':
        return 'an overwhelming, dominant victory with explosive celebration energy';
      case 'nailbiter':
        return 'a razor-thin one-run thriller decided in the final moments, extremely tense';
      case 'draw':
        return 'a hard-fought draw where neither side could break through, tense and unresolved';
      case 'cancelled':
        return 'a rained-out / cancelled game, quiet empty stadium, melancholic mood';
      default:
        return 'a hard-fought competitive win';
    }
  },

  /** 한국어 요약 (화면에 프롬프트를 보여줄 때 맨 앞에 붙는 설명) */
  _summaryKo(game) {
    const date = this._formatDate(game.date);
    if (!game.played) {
      return `${date} ${game.awayTeam} vs ${game.homeTeam} 경기 (${game.note || '취소'})`;
    }
    const winner = KboTeams.winnerOf(game);
    const result = winner ? `${KboTeams.get(winner).name} 승리` : '무승부';
    return `${date} ${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam} — ${result}`;
  },

  /**
   * 최종 이미지 생성 프롬프트를 만든다.
   * @param {object} game /api/kbo-schedule가 준 경기 객체
   * @param {string} aspect '1:1' | '4:5' | '9:16'
   * @returns {string}
   */
  build(game, aspect) {
    const away = KboTeams.get(game.awayTeam);
    const home = KboTeams.get(game.homeTeam);
    const winner = KboTeams.winnerOf(game);
    const kind = this._classify(game);
    const date = this._formatDate(game.date);
    const stadium = game.stadium || '';
    const isNight = /^(1[89]|2[0-3]):/.test(game.time || '');
    const timeOfDay = isNight ? 'night game under bright stadium floodlights' : 'afternoon game in warm daylight';

    const ratioText =
      aspect === '9:16' ? 'vertical 9:16 portrait poster'
        : aspect === '4:5' ? 'vertical 4:5 portrait poster'
          : 'square 1:1 poster';

    const lines = [];

    lines.push(`A premium, high-quality KBO Korean baseball sports poster illustration, ${ratioText}.`);
    lines.push(
      `Subject: the result of a KBO Korean professional baseball game between the ${away.name} and the ${home.name}, ` +
      `played on ${date} at ${this._stadiumEn(stadium)}, ${timeOfDay}.`
    );
    lines.push(`Overall feeling: ${this._moodEn(kind)}.`);

    // 좌우 캐릭터 배치
    if (game.played && winner) {
      const winnerSide = winner === game.awayTeam ? away : home;
      const loserSide = winner === game.awayTeam ? home : away;
      lines.push(
        `LEFT SIDE (winning team): ${winnerSide.mascotEn}, striking a triumphant victory pose with a raised fist, ` +
        `confident and powerful expression, lit in ${winnerSide.colorsEn} with dramatic rim lighting, sparks and energy effects.`
      );
      lines.push(
        `RIGHT SIDE (losing team): ${loserSide.mascotEn}, showing visible disappointment and frustration, ` +
        `head slightly lowered, in ${loserSide.colorsEn} but rendered noticeably darker and more subdued than the winning side.`
      );
      lines.push('The two mascot characters face each other, creating a clear visual contrast between winner and loser.');
    } else if (kind === 'draw') {
      lines.push(
        `LEFT SIDE: ${away.mascotEn} in ${away.colorsEn}. RIGHT SIDE: ${home.mascotEn} in ${home.colorsEn}. ` +
        'Both characters are equally lit and equally intense, locked in a standoff, neither winning nor losing.'
      );
    } else {
      lines.push(
        `LEFT SIDE: ${away.mascotEn} in ${away.colorsEn}. RIGHT SIDE: ${home.mascotEn} in ${home.colorsEn}. ` +
        'Both characters look up at an empty, quiet stadium; the game did not take place.'
      );
    }

    // 배경
    lines.push(
      `BACKGROUND: ${this._stadiumEn(stadium)}, ${timeOfDay}, ` +
      (game.played
        ? 'packed with a roaring crowd, dynamic sports illustration style blended with cinematic photography, motion blur, flying baseball with a glowing trajectory arc across the frame.'
        : 'nearly empty with covered infield, overcast or rainy sky, quiet and still.')
    );

    // 스코어보드 — 가장 중요
    if (game.played) {
      lines.push(
        `SCOREBOARD (most important element, must be perfectly legible): a large stadium-style scoreboard displaying exactly ` +
        `"${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}". ` +
        `The two numbers ${game.awayScore} and ${game.homeScore} must be the largest, clearest, most readable text in the entire image. ` +
        `Below it, smaller text: "${date}" and "${stadium}".` +
        (winner ? ` And a small line reading "${KboTeams.get(winner).name} WIN".` : ' And a small line reading "DRAW".')
      );
    } else {
      lines.push(
        `SCOREBOARD: a stadium scoreboard showing "${game.awayTeam} vs ${game.homeTeam}" with no score, ` +
        `and text reading "${game.note || 'CANCELLED'}", plus smaller text "${date}" and "${stadium}".`
      );
    }

    // 스타일
    lines.push(
      'STYLE: cinematic sports illustration, dramatic stadium lighting, dynamic low-angle perspective, ' +
      'high contrast, energetic crowd, premium official sports poster design. ' +
      'Mascot characters should be stylish and powerful rather than childish. ' +
      'Do not let a busy background bury the characters or the scoreboard.'
    );

    // 네거티브
    lines.push(
      'AVOID: low quality, blurry, distorted faces, extra limbs, malformed hands, duplicate characters, ' +
      'wrong team colors, unreadable or broken text, garbled letters, watermarks, signatures, ' +
      (game.played
        ? `and any score numbers other than ${game.awayScore} and ${game.homeScore}.`
        : 'and any score numbers at all.')
    );

    return lines.join('\n\n');
  },

  /** 화면에 보여줄 요약 + 전체 프롬프트 */
  buildWithSummary(game, aspect) {
    return {
      summary: this._summaryKo(game),
      prompt: this.build(game, aspect),
    };
  },
};
