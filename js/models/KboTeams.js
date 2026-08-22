/**
 * KboTeams.js
 * KBO 10개 구단의 대표 색상. 승리팀 색상으로 카드 배경을 자동 생성할 때 쓴다.
 * 색상은 각 구단의 널리 알려진 상징색을 참고한 근사값이며, 구단 로고나
 * 엠블럼 이미지는 저작권 문제로 사용하지 않는다(색상+텍스트만 사용).
 */
/**
 * 각 구단의 색상·정식명칭과, AI 포스터 생성 시 쓸 마스코트 묘사.
 *
 * mascot: 마스코트 이름 (한국어, 화면 표시용)
 * mascotEn: AI 프롬프트에 넣을 영문 묘사. 상표권 문제를 피하기 위해 구단 로고나
 *   실제 캐릭터를 그대로 재현하라고 지시하지 않고, "그 팀을 상징하는 동물/캐릭터"
 *   수준의 일반적인 묘사만 사용한다.
 * colorsEn: 프롬프트용 팀 컬러 설명
 */
const KBO_TEAMS = {
  LG: {
    primary: '#C30452', secondary: '#000000', name: 'LG 트윈스',
    mascot: '럭키·비니', mascotEn: 'a pair of cheerful twin mascot characters in baseball uniforms',
    colorsEn: 'crimson red, black and white',
  },
  두산: {
    primary: '#131230', secondary: '#C10B31', name: '두산 베어스',
    mascot: '철웅이', mascotEn: 'a strong bear mascot character in a baseball uniform',
    colorsEn: 'navy blue, red and white',
  },
  KT: {
    primary: '#000000', secondary: '#EC1C24', name: 'KT 위즈',
    mascot: '빅·또리', mascotEn: 'a playful wizard-themed mascot character in a baseball uniform',
    colorsEn: 'black, red and white',
  },
  SSG: {
    primary: '#CE0E2D', secondary: '#FFB81C', name: 'SSG 랜더스',
    mascot: '랜디', mascotEn: 'a bold adventurer mascot character in a baseball uniform',
    colorsEn: 'red, gold and white',
  },
  NC: {
    primary: '#315288', secondary: '#C7A079', name: 'NC 다이노스',
    mascot: '단디·쎄리', mascotEn: 'a friendly dinosaur mascot character in a baseball uniform',
    colorsEn: 'deep blue, gold and white',
  },
  KIA: {
    primary: '#EA0029', secondary: '#06141F', name: 'KIA 타이거즈',
    mascot: '호걸이', mascotEn: 'a fierce tiger mascot character in a baseball uniform',
    colorsEn: 'bright red, black and white',
  },
  롯데: {
    primary: '#041E42', secondary: '#D00F31', name: '롯데 자이언츠',
    mascot: '누리·아라', mascotEn: 'a giant seagull-themed mascot character in a baseball uniform',
    colorsEn: 'navy blue, red and white',
  },
  삼성: {
    primary: '#074CA1', secondary: '#C0C0C0', name: '삼성 라이온즈',
    mascot: '블레오', mascotEn: 'a proud lion mascot character in a baseball uniform',
    colorsEn: 'royal blue, silver and white',
  },
  한화: {
    primary: '#FC4E00', secondary: '#000000', name: '한화 이글스',
    mascot: '위니·수리', mascotEn: 'a soaring eagle mascot character in a baseball uniform',
    colorsEn: 'vivid orange, black and white',
  },
  키움: {
    primary: '#570514', secondary: '#B07F4A', name: '키움 히어로즈',
    mascot: '턱돌이', mascotEn: 'a quirky superhero-styled mascot character in a baseball uniform',
    colorsEn: 'burgundy, dark red and gold',
  },
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
