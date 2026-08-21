/**
 * KboTeams.js
 * KBO 10개 구단의 대표 색상. 승리팀 색상으로 카드 배경을 자동 생성할 때 쓴다.
 * 색상은 각 구단의 널리 알려진 상징색을 참고한 근사값이며, 구단 로고나
 * 엠블럼 이미지는 저작권 문제로 사용하지 않는다(색상+텍스트만 사용).
 */
const KBO_TEAMS = {
  LG: { primary: '#C30452', secondary: '#000000', name: 'LG 트윈스' },
  두산: { primary: '#131230', secondary: '#C10B31', name: '두산 베어스' },
  KT: { primary: '#000000', secondary: '#EC1C24', name: 'KT 위즈' },
  SSG: { primary: '#CE0E2D', secondary: '#FFB81C', name: 'SSG 랜더스' },
  NC: { primary: '#315288', secondary: '#C7A079', name: 'NC 다이노스' },
  KIA: { primary: '#EA0029', secondary: '#06141F', name: 'KIA 타이거즈' },
  롯데: { primary: '#041E42', secondary: '#D00F31', name: '롯데 자이언츠' },
  삼성: { primary: '#074CA1', secondary: '#C0C0C0', name: '삼성 라이온즈' },
  한화: { primary: '#FC4E00', secondary: '#000000', name: '한화 이글스' },
  키움: { primary: '#570514', secondary: '#B07F4A', name: '키움 히어로즈' },
};

const KboTeams = {
  /** 팀 약칭으로 색상 정보를 찾는다. 모르는 팀이면 중립 색상 반환. */
  get(teamCode) {
    return KBO_TEAMS[teamCode] || { primary: '#2b2b3d', secondary: '#6ea8fe', name: teamCode || '' };
  },

  /** 경기 결과에서 승리팀 약칭을 반환한다. 무승부·미개최면 null. */
  winnerOf(game) {
    if (!game || !game.played) return null;
    if (game.awayScore > game.homeScore) return game.awayTeam;
    if (game.homeScore > game.awayScore) return game.homeTeam;
    return null; // 무승부
  },
};
