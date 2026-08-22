/**
 * AiImageClient.js
 * /api/generate-image 서버리스 함수를 호출해 AI 배경 이미지를 받아온다.
 *
 * API 키가 설정되지 않았거나(503) 오류가 나면 예외를 던지고, 호출한 쪽에서
 * 기존 절차적 생성으로 대체하도록 한다. 즉 AI는 "있으면 더 좋은" 선택지이며,
 * 없어도 앱은 완전히 동작한다.
 */
const AiImageClient = {
  /**
   * @param {string} prompt 프롬프트
   * @param {string} aspect '1:1' | '4:5' | '9:16'
   * @param {'background'|'poster'} [mode] 'background'는 글자 없는 배경용(기본),
   *   'poster'는 스코어보드까지 포함된 완성 포스터용
   * @param {'auto'|'openai'|'free'} [provider] 사용할 AI 제공자
   * @returns {Promise<string>} 이미지 dataURL
   * @throws {Error} code 속성에 NO_API_KEY / RATE_LIMITED 등이 담긴다
   */
  async generate(prompt, aspect, mode, provider) {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        aspect,
        mode: mode || 'background',
        provider: provider || 'auto',
      }),
    });

    let payload = {};
    try {
      payload = await res.json();
    } catch (e) {
      // 응답 본문이 JSON이 아닌 경우
    }

    if (!res.ok) {
      // NO_API_KEY는 "OpenAI를 명시적으로 골랐는데 키가 없다"는 뜻일 뿐,
      // 무료 경로는 여전히 쓸 수 있으므로 AI 기능 전체를 막지 않는다.
      const err = new Error(payload.error || `AI 이미지 생성 실패 (${res.status})`);
      err.code = payload.code || 'HTTP_' + res.status;
      throw err;
    }
    if (!payload.dataUrl) {
      const err = new Error('AI 응답에 이미지가 없습니다.');
      err.code = 'NO_IMAGE';
      throw err;
    }
    // 어떤 제공자로 만들었는지 기억해 두면 UI에서 안내할 수 있다
    this.lastProvider = payload.provider || 'unknown';
    this.lastNote = payload.note || '';
    return payload.dataUrl;
  },

};
