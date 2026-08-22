/**
 * KboTeams.js
 * KBO 10개 구단의 대표 색상. 승리팀 색상으로 카드 배경을 자동 생성할 때 쓴다.
 * 색상은 각 구단의 널리 알려진 상징색을 참고한 근사값이며, 구단 로고나
 * 엠블럼 이미지는 저작권 문제로 사용하지 않는다(색상+텍스트만 사용).
 */
/**
 * 각 구단의 색상·정식명칭과, AI 포스터 생성 시 쓸 마스코트 정보.
 *
 * mascot: 마스코트 이름 (한국어)
 * mascotEn: AI 프롬프트에 넣을 묘사. 마스코트 실명과 함께 생김새 설명을 넣는다.
 *   (AI가 그 마스코트를 모를 경우를 대비해 설명을 함께 주는 것)
 * colorsEn: 프롬프트용 팀 컬러 설명
 *
 * 참고: 이 프로젝트는 과제 제출용 임시 사이트이며 제출 후 내릴 예정이라는 전제로
 * 마스코트 실명을 사용한다. 상시 서비스로 전환한다면 구단 캐릭터·로고 사용에 대해
 * 별도로 확인이 필요하다.
 */
const KBO_TEAMS = {
  LG: {
    primary: '#C30452', secondary: '#000000', name: 'LG 트윈스',
    mascot: '럭키·비니',
    mascotEn: 'Lucky and Vini (럭키, 비니), the official twin mascot characters of the LG Twins — a pair of cheerful twin characters in LG Twins baseball uniforms',
    colorsEn: 'crimson red, black and white',
  },
  두산: {
    primary: '#131230', secondary: '#C10B31', name: '두산 베어스',
    mascot: '철웅이',
    mascotEn: 'Cheolwoongi (철웅이), the official mascot of the Doosan Bears — a strong, friendly bear character in a Doosan Bears baseball uniform',
    colorsEn: 'navy blue, red and white',
  },
  KT: {
    primary: '#000000', secondary: '#EC1C24', name: 'KT 위즈',
    mascot: '빅·또리',
    mascotEn: 'Vic and Ddori (빅, 또리), the official mascot characters of the KT Wiz — playful wizard-themed characters in KT Wiz baseball uniforms',
    colorsEn: 'black, red and white',
  },
  SSG: {
    primary: '#CE0E2D', secondary: '#FFB81C', name: 'SSG 랜더스',
    mascot: '랜디',
    mascotEn: 'Randy (랜디), the official mascot of the SSG Landers — a bold adventurer character in an SSG Landers baseball uniform',
    colorsEn: 'red, gold and white',
  },
  NC: {
    primary: '#315288', secondary: '#C7A079', name: 'NC 다이노스',
    mascot: '단디·쎄리',
    mascotEn: 'Dandi and Sseri (단디, 쎄리), the official dinosaur mascot characters of the NC Dinos — friendly dinosaur characters in NC Dinos baseball uniforms',
    colorsEn: 'deep blue, gold and white',
  },
  KIA: {
    primary: '#EA0029', secondary: '#06141F', name: 'KIA 타이거즈',
    mascot: '호걸이',
    mascotEn: 'Hogeori (호걸이), the official tiger mascot of the KIA Tigers — a fierce, muscular tiger character in a KIA Tigers baseball uniform and cap',
    colorsEn: 'bright red, black and white',
  },
  롯데: {
    primary: '#041E42', secondary: '#D00F31', name: '롯데 자이언츠',
    mascot: '누리·아라',
    mascotEn: 'Nuri and Ara (누리, 아라), the official mascot characters of the Lotte Giants — giant seagull-themed characters in Lotte Giants baseball uniforms',
    colorsEn: 'navy blue, red and white',
  },
  삼성: {
    primary: '#074CA1', secondary: '#C0C0C0', name: '삼성 라이온즈',
    mascot: '블레오',
    mascotEn: 'Bleo (블레오), the official lion mascot of the Samsung Lions — a proud blue lion character in a Samsung Lions baseball uniform',
    colorsEn: 'royal blue, silver and white',
  },
  한화: {
    primary: '#FC4E00', secondary: '#000000', name: '한화 이글스',
    mascot: '위니·수리',
    mascotEn: 'Wini and Suri (위니, 수리), the official eagle mascot characters of the Hanwha Eagles — soaring eagle characters in Hanwha Eagles baseball uniforms',
    colorsEn: 'vivid orange, black and white',
  },
  키움: {
    primary: '#570514', secondary: '#B07F4A', name: '키움 히어로즈',
    mascot: '턱돌이',
    mascotEn: 'Teokdori (턱돌이), the official mascot of the Kiwoom Heroes — a quirky character with a prominent large jaw, wearing a Kiwoom Heroes baseball uniform and helmet',
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
