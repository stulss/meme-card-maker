/**
 * PhraseTemplates.js
 * "문구 자동 생성" 버튼이 고를 수 있는 카테고리별 카드 문구 목록.
 * 외부 AI 텍스트 생성 API(서버·비용·API 키 필요) 없이, 미리 큐레이션한 문구
 * 중에서 무작위로 선택하는 방식으로 구현한다.
 */
const PHRASE_CATEGORIES = {
  응원: [
    '오늘도 화이팅!',
    '넌 할 수 있어',
    '포기하지 마세요',
    '오늘 하루도 힘내요',
    '작은 한 걸음도 전진입니다',
  ],
  감성: [
    '오늘의 기분: 맑음',
    '천천히 걸어도 괜찮아',
    '지금 이 순간을 기억해',
    '마음이 향하는 대로',
    '오늘도 나답게',
  ],
  유머: [
    'ㅋㅋㅋ 진짜 뭐지?',
    '이거 실화냐',
    '오늘의 정신승리',
    '월요일이 또 왔다고?',
    '커피 없인 못 살아',
  ],
  공지: [
    '중요 공지사항',
    '이벤트 안내',
    '오늘의 소식',
    '알려드립니다',
    '함께해요!',
  ],
  축하: [
    '축하합니다 🎉',
    '해냈다!',
    '오늘을 기념하며',
    '고생 많으셨습니다',
    '수고하셨습니다!',
  ],
};

const PhraseTemplates = {
  categories() {
    return Object.keys(PHRASE_CATEGORIES);
  },

  /** @param {string} [category] 지정하지 않으면 전체 카테고리에서 무작위 */
  random(category) {
    const pool = category && PHRASE_CATEGORIES[category] ? PHRASE_CATEGORIES[category] : Object.values(PHRASE_CATEGORIES).flat();
    return pool[Math.floor(Math.random() * pool.length)];
  },
};
