/**
 * api/generate-image.js — Vercel 서버리스 함수 (생성형 AI 이미지)
 *
 * Google Gemini 이미지 생성 모델("Nano Banana" 계열)을 호출해 카드 배경 이미지를
 * 만든다. API 키는 서버 환경변수(GEMINI_API_KEY)로만 다루며, 브라우저로 절대
 * 노출하지 않는다.
 *
 * 안전장치:
 * - 키가 없으면 503을 반환한다. 프런트엔드는 이때 기존 절차적 생성으로 대체한다.
 * - 프롬프트 길이를 제한하고, 사용자 입력을 그대로 신뢰하지 않는다.
 * - 인스턴스 단위 간이 rate limit으로 실수/장난에 의한 요금 폭증을 완화한다.
 *   (서버리스는 인스턴스가 여러 개일 수 있어 완벽한 제한은 아니며, 근본적인
 *    보호는 Google Cloud 콘솔의 예산 알림·할당량 설정으로 해야 한다.)
 */

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_PROMPT_LENGTH = 400;

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

/** 카드 배경으로 쓰기 좋도록 프롬프트를 보정한다 */
function buildPrompt(userPrompt, aspect) {
  const ratioHint =
    aspect === '9:16' ? 'vertical 9:16 portrait composition'
      : aspect === '4:5' ? '4:5 portrait composition'
        : 'square 1:1 composition';

  return [
    userPrompt,
    `Background image for a social media card, ${ratioHint}.`,
    'No text, no letters, no numbers, no watermarks, no logos.',
    'Keep the composition simple with uncluttered areas so text can be overlaid later.',
  ].join(' ');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
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
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(rawPrompt, aspect) }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('[generate-image] AI 응답 오류', aiRes.status, detail.slice(0, 500));
      res.status(502).json({
        error: 'AI 이미지 생성에 실패했습니다.',
        code: 'AI_ERROR',
      });
      return;
    }

    const json = await aiRes.json();
    const parts =
      (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const imagePart = parts.find((p) => p && (p.inlineData || p.inline_data));

    if (!imagePart) {
      res.status(502).json({
        error: 'AI가 이미지를 반환하지 않았습니다. 프롬프트를 바꿔 다시 시도해 주세요.',
        code: 'NO_IMAGE',
      });
      return;
    }

    const inline = imagePart.inlineData || imagePart.inline_data;
    const mimeType = inline.mimeType || inline.mime_type || 'image/png';
    const data = inline.data;

    // 생성 결과는 매번 달라야 하므로 캐시하지 않는다.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ dataUrl: `data:${mimeType};base64,${data}` });
  } catch (err) {
    console.error('[generate-image] 예외', err);
    res.status(500).json({ error: 'AI 이미지 생성 중 오류가 발생했습니다.', code: 'EXCEPTION' });
  }
};
