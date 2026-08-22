/**
 * api/generate-image.js — Vercel 서버리스 함수 (생성형 AI 이미지)
 *
 * OpenAI GPT Image 2 모델을 호출해 카드 배경 이미지를 만든다.
 * API 키는 서버 환경변수(OPENAI_API_KEY)로만 다루며, 브라우저로 절대 노출하지 않는다.
 *
 * 품질 기본값이 'low'인 이유: 이 이미지는 "배경"으로만 쓰이고 그 위에 팀 색상
 * 오버레이(62%)와 그라디언트 음영이 덮인 뒤 텍스트가 올라간다. 고품질을 써도
 * 최종 결과 차이가 거의 없는 반면 비용은 30배 이상 차이난다
 * (1024x1024 기준 low ≈ $0.006, high ≈ $0.211).
 * 필요하면 OPENAI_IMAGE_QUALITY 환경변수로 medium/high로 올릴 수 있다.
 *
 * 안전장치:
 * - 키가 없으면 503을 반환한다. 프런트엔드는 이때 기존 절차적 생성으로 대체한다.
 * - 프롬프트 길이를 제한하고, 사용자 입력을 그대로 신뢰하지 않는다.
 * - 인스턴스 단위 간이 rate limit으로 실수/장난에 의한 요금 폭증을 완화한다.
 *   (서버리스는 인스턴스가 여러 개일 수 있어 완벽한 제한은 아니며, 근본적인
 *    보호는 OpenAI 대시보드의 사용량 한도(usage limits) 설정으로 해야 한다.)
 */

const ENDPOINT = 'https://api.openai.com/v1/images/generations';
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';

// 야구 포스터용 자동 생성 프롬프트는 2000자를 넘기도 하므로 넉넉히 잡는다.
// (일반 카드에서 사용자가 직접 쓰는 프롬프트는 보통 100자 이내)
const MAX_PROMPT_LENGTH = 4000;

// 간이 rate limit (인스턴스 메모리 기준)
const RATE_LIMIT_MAX = Number(process.env.AI_IMAGE_DAILY_LIMIT || 100);
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
let rateWindowStart = Date.now();
let rateCount = 0;

function checkRateLimit() {
  const now = Date.now();
  if (now - rateWindowStart > RATE_WINDOW_MS) {
    rateWindowStart = now;
    rateCount = 0;
  }
  if (rateCount >= RATE_LIMIT_MAX) return false;
  rateCount += 1;
  return true;
}

/**
 * 카드 화면비를 OpenAI가 지원하는 size 값으로 매핑한다.
 * 4:5와 9:16은 정확히 대응되는 값이 없지만, 최종 렌더링에서 'cover'로 잘라
 * 채우므로 세로형(1024x1536)이면 충분하다.
 */
function mapSize(aspect) {
  if (aspect === '4:5' || aspect === '9:16') return '1024x1536';
  return '1024x1024';
}

/**
 * 프롬프트를 모드에 맞게 보정한다.
 *
 * - 'background': 카드 배경으로만 쓸 이미지. 나중에 텍스트를 얹을 것이므로
 *   글자가 들어가지 않도록 명시한다.
 * - 'poster': 완성된 포스터. 프롬프트에 이미 스코어보드 문구·구도·네거티브가
 *   모두 들어있으므로 그대로 전달한다. (여기서 "글자 넣지 마"를 붙이면
 *   스코어보드를 그리라는 지시와 충돌한다.)
 */
function buildPrompt(userPrompt, mode) {
  if (mode === 'poster') return userPrompt;

  return [
    userPrompt,
    'Background image for a social media card.',
    'No text, no letters, no numbers, no watermarks, no logos.',
    'Keep the composition simple with uncluttered areas so text can be overlaid later.',
  ].join(' ');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 키 미설정: 프런트엔드가 절차적 생성으로 대체할 수 있도록 명확히 알린다.
    res.status(503).json({
      error: 'AI 이미지 생성이 설정되지 않았습니다.',
      code: 'NO_API_KEY',
    });
    return;
  }

  if (!checkRateLimit()) {
    res.status(429).json({
      error: '오늘 AI 이미지 생성 한도를 모두 사용했습니다. 잠시 후 다시 시도해 주세요.',
      code: 'RATE_LIMITED',
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
      return;
    }
  }

  const rawPrompt = String((body && body.prompt) || '').trim();
  const aspect = String((body && body.aspect) || '1:1');
  const mode = String((body && body.mode) || 'background');

  if (!rawPrompt) {
    res.status(400).json({ error: '프롬프트를 입력해 주세요.' });
    return;
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해 주세요.` });
    return;
  }

  try {
    const aiRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(rawPrompt, mode),
        size: mapSize(aspect),
        quality: QUALITY,
        n: 1,
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('[generate-image] AI 응답 오류', aiRes.status, detail.slice(0, 500));

      // 콘텐츠 정책 위반은 사용자가 프롬프트를 고치면 되므로 구분해서 알린다.
      const isPolicy = aiRes.status === 400 && /safety|policy|moderation/i.test(detail);
      res.status(isPolicy ? 400 : 502).json({
        error: isPolicy
          ? '요청하신 내용으로는 이미지를 만들 수 없습니다. 다른 표현으로 시도해 주세요.'
          : 'AI 이미지 생성에 실패했습니다.',
        code: isPolicy ? 'CONTENT_POLICY' : 'AI_ERROR',
      });
      return;
    }

    const json = await aiRes.json();
    const first = json.data && json.data[0];

    if (!first) {
      res.status(502).json({
        error: 'AI가 이미지를 반환하지 않았습니다. 프롬프트를 바꿔 다시 시도해 주세요.',
        code: 'NO_IMAGE',
      });
      return;
    }

    // gpt-image 계열은 기본적으로 b64_json을 반환한다. url이 오는 경우도 대비한다.
    let dataUrl;
    if (first.b64_json) {
      dataUrl = `data:image/png;base64,${first.b64_json}`;
    } else if (first.url) {
      // URL로 온 경우 서버에서 받아 dataURL로 바꾼다.
      // (브라우저가 외부 URL 이미지를 canvas에 그리면 tainted 문제가 생기므로)
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) throw new Error(`이미지 다운로드 실패 (${imgRes.status})`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mime = imgRes.headers.get('content-type') || 'image/png';
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    } else {
      res.status(502).json({
        error: 'AI 응답 형식을 해석하지 못했습니다.',
        code: 'NO_IMAGE',
      });
      return;
    }

    // 생성 결과는 매번 달라야 하므로 캐시하지 않는다.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ dataUrl });
  } catch (err) {
    console.error('[generate-image] 예외', err);
    res.status(500).json({ error: 'AI 이미지 생성 중 오류가 발생했습니다.', code: 'EXCEPTION' });
  }
};
