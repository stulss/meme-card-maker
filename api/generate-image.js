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

/**
 * OpenAI GPT Image로 생성한다. 실패하면 예외를 던져 호출한 쪽이 무료 대체로
 * 넘어갈 수 있게 한다. 콘텐츠 정책 위반은 err.code = 'CONTENT_POLICY'로 구분한다.
 */
async function generateWithOpenAi(prompt, aspect) {
  const apiKey = process.env.OPENAI_API_KEY;
  const aiRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: mapSize(aspect),
      quality: QUALITY,
      n: 1,
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text().catch(() => '');
    // OpenAI가 준 사람이 읽을 수 있는 사유를 추출한다.
    // (오류 메시지에는 API 키가 포함되지 않으므로 노출해도 안전하며,
    //  "크레딧 부족"처럼 사용자가 직접 조치해야 하는 경우가 많아 그대로 알려준다.)
    let reason = '';
    try {
      const parsed = JSON.parse(detail);
      reason = (parsed && parsed.error && parsed.error.message) || '';
    } catch (e) {
      reason = detail.slice(0, 200);
    }
    const err = new Error(`${aiRes.status} ${reason}`.trim());
    if (aiRes.status === 400 && /safety|policy|moderation/i.test(detail)) {
      err.code = 'CONTENT_POLICY';
    }
    throw err;
  }

  const json = await aiRes.json();
  const first = json.data && json.data[0];
  if (!first) throw new Error('OpenAI가 이미지를 반환하지 않았습니다.');

  // gpt-image 계열은 기본적으로 b64_json을 반환한다. url이 오는 경우도 대비한다.
  if (first.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first.url) {
    // URL로 온 경우 서버에서 받아 dataURL로 바꾼다.
    // (브라우저가 외부 URL 이미지를 canvas에 그리면 tainted 문제가 생기므로)
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) throw new Error(`이미지 다운로드 실패 (${imgRes.status})`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  throw new Error('OpenAI 응답 형식을 해석하지 못했습니다.');
}

/**
 * Pollinations.ai — 가입·API 키·결제 수단이 전혀 필요 없는 무료 이미지 생성.
 * OpenAI 키가 없거나 실패했을 때의 대체 경로로 쓴다.
 *
 * 한계: SLA가 없고 rate limit이 예고 없이 바뀔 수 있으며, 이미지 안의 한글 글자를
 * 제대로 못 쓴다. 그래도 "키 없이도 AI 이미지가 나온다"는 가치가 크다.
 */
async function generateWithPollinations(prompt, aspect) {
  const size = mapSize(aspect).split('x');
  const width = Number(size[0]) || 1024;
  const height = Number(size[1]) || 1024;

  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e9)}`;

  const imgRes = await fetch(url, {
    headers: { 'User-Agent': 'meme-card-maker/1.0' },
  });
  if (!imgRes.ok) {
    throw new Error(`Pollinations 응답 오류 (${imgRes.status})`);
  }

  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error('Pollinations가 유효한 이미지를 반환하지 않았습니다.');
  }
  const mime = imgRes.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

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
  // 'auto'  : OpenAI 먼저, 실패하면 무료로 (기본)
  // 'openai': OpenAI만 사용. 실패하면 무료로 몰래 넘어가지 않고 이유를 알린다
  // 'free'  : 무료(Pollinations)만 사용
  const provider = String((body && body.provider) || 'auto');

  if (!rawPrompt) {
    res.status(400).json({ error: '프롬프트를 입력해 주세요.' });
    return;
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해 주세요.` });
    return;
  }

  const finalPrompt = buildPrompt(rawPrompt, mode);
  const notes = []; // 어떤 경로로 만들어졌는지 사용자에게 알려줄 메모

  // OpenAI 경로 (provider가 'openai' 또는 'auto'일 때)
  if (provider === 'openai' || provider === 'auto') {
    if (!apiKey) {
      if (provider === 'openai') {
        // 사용자가 명시적으로 OpenAI를 고른 경우, 무료로 몰래 바꾸지 않고 알린다.
        res.status(503).json({
          error: 'OpenAI API 키가 설정되지 않았습니다. 무료 AI를 선택하거나 키를 등록해 주세요.',
          code: 'NO_API_KEY',
        });
        return;
      }
      notes.push('OpenAI 키 미설정');
    } else {
      try {
        const result = await generateWithOpenAi(finalPrompt, aspect);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ dataUrl: result, provider: 'openai' });
        return;
      } catch (err) {
        // 콘텐츠 정책 위반은 어느 제공자로 바꿔도 같은 결과일 가능성이 높다.
        if (err.code === 'CONTENT_POLICY') {
          res.status(400).json({
            error: '요청하신 내용으로는 이미지를 만들 수 없습니다. 다른 표현으로 시도해 주세요.',
            code: 'CONTENT_POLICY',
          });
          return;
        }
        if (provider === 'openai') {
          // 명시적으로 OpenAI를 골랐으므로 실패 사유를 그대로 알린다.
          res.status(502).json({
            error: `OpenAI 이미지 생성에 실패했습니다. ${err.message}`,
            code: 'AI_ERROR',
          });
          return;
        }
        console.error('[generate-image] OpenAI 실패, 무료 대체로 전환:', err.message);
        notes.push(`OpenAI 사용 불가(${err.message})`);
      }
    }
  }

  // 무료 경로 (provider가 'free'이거나, 'auto'에서 OpenAI가 안 됐을 때)
  try {
    const dataUrl = await generateWithPollinations(finalPrompt, aspect);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      dataUrl,
      provider: 'pollinations',
      note: notes.length ? `무료 AI로 생성했습니다. ${notes.join(', ')}` : '무료 AI로 생성했습니다.',
    });
  } catch (err) {
    console.error('[generate-image] 무료 생성 실패', err);
    res.status(502).json({
      error: `AI 이미지 생성에 실패했습니다. ${notes.concat([err.message]).join(' / ')}`,
      code: 'AI_ERROR',
    });
  }
};
