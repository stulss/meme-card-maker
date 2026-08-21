/**
 * FixtureData.js
 * 카드 3(극단 입력 검사)용 12개 테스트 문구. 일부는 첨부 PRD
 * (card_meme_web_tool_development_request.md 15장)의 한영 혼합 테스트
 * 문구를 그대로 채용했다 - 실제 서비스 QA에서 검증된 대표 사례이기 때문.
 */
const TEXT_CASES = [
  {
    id: 'long-ko',
    label: '긴 한글 (공백 없음)',
    text: '오늘하루도수고했어요정말고생많으셨습니다내일은더좋은일만가득하시길바랍니다',
  },
  {
    id: 'long-en',
    label: '긴 영문 (단어 줄바꿈)',
    text: 'This is a fairly long English sentence used to verify that automatic word wrapping behaves correctly inside the text box.',
  },
  {
    id: 'mixed-ko-en',
    label: '한영 혼합',
    text: '한글과 English를 함께 써도 괜찮을까?',
  },
  {
    id: 'manual-breaks',
    label: '수동 줄바꿈',
    text: '오늘도 화이팅!\nHello, 오늘도 화이팅!\n123 가나다 ABC',
  },
  {
    id: 'emoji-heavy',
    label: '이모지 (합성 시퀀스 포함)',
    text: '😀 👍 🎉 #밈 #카드뉴스 👨‍👩‍👧‍👦 🏳️‍🌈',
  },
  {
    id: 'empty',
    label: '빈 문자열 (이미지만)',
    text: '',
  },
  {
    id: 'single-char',
    label: '한 글자',
    text: '가',
  },
  {
    id: 'unbroken-token',
    label: '거대한 미분할 토큰',
    text: 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ진짜뭐지',
  },
  {
    id: 'symbols-heavy',
    label: '기호 집약',
    text: '!?@#$%^&*()_+~★☆※ 진짜 뭐지?',
  },
  {
    id: 'numbers-units',
    label: '숫자·단위·날짜',
    text: '2026년 08월 21일 총 1,234,567원 -50%',
  },
  {
    // 기본 텍스트 상자(hRatio 0.3)에서 minFontSizePx(10)까지 축소해도
    // 넘치도록 실측(브라우저 canvas.measureText)으로 검증된 길이(4500자,
    // 문장 60회 반복)를 사용한다 - 이보다 짧으면 클립 안전망이 실제로는
    // 작동하지 않는 "가짜" 오버플로우 케이스가 되어버린다.
    id: 'overflow-paragraph',
    label: '오버플로우 강제 단락 (클립 증명)',
    text: '이 문장은 아주아주 길게 만들어서 최소 글자 크기로 줄여도 절대 텍스트 상자 안에 다 들어가지 못하도록 의도적으로 작성한 단락입니다. '.repeat(
      60
    ),
  },
  {
    id: 'stray-whitespace',
    label: '공백/탭 혼합',
    text: '  앞뒤 공백과　전각공백\t탭이 섞인 문구  ',
  },
];
