/**
 * CardStateModel.js
 * 편집기가 메모리에 들고 있는 "현재 카드" 상태. 모든 위치/크기 값은
 * 0~1 비율로 저장한다 - 그래야 1:1/4:5/9:16 세 해상도 전환 시
 * 텍스트 상자가 항상 같은 상대 위치를 유지한다 (카드 2 요구사항).
 */
function createDefaultCardState() {
  return {
    ratio: '1:1',
    imageDataUrl: null,
    imageFitMode: 'cover',
    backgroundColor: '#1c1c28',
    text: {
      content: '오늘도 화이팅!',
      color: '#ffffff',
      xRatio: 0.08,
      yRatio: 0.62,
      wRatio: 0.84,
      hRatio: 0.3,
      maxFontSizeRatio: 0.12,
      align: 'center',
      fontFamily: 'Pretendard, "Malgun Gothic", sans-serif',
    },
  };
}

function cloneCardState(state) {
  return JSON.parse(JSON.stringify(state));
}
