/**
 * validators.js
 * 템플릿 레코드/가져오기(import) JSON의 유효성 검사.
 * 여기서 걸러지지 않은 값만 TemplateStore에 실제로 저장된다.
 */
const VALID_RATIOS = ['1:1', '4:5', '9:16'];
const VALID_FIT_MODES = ['cover', 'contain'];
const VALID_ALIGNS = ['left', 'center', 'right'];
const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

function isValidHexColor(v) {
  return typeof v === 'string' && HEX_COLOR_RE.test(v);
}

function isValidRatioNumber(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1;
}

/**
 * 템플릿 레코드 하나의 유효성을 검사한다.
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTemplateRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['레코드가 객체가 아닙니다.'] };
  }
  if (typeof record.name !== 'string' || record.name.trim() === '') {
    errors.push('name이 없거나 빈 문자열입니다.');
  }
  if (!VALID_RATIOS.includes(record.ratio)) {
    errors.push(`ratio 값이 올바르지 않습니다 (${VALID_RATIOS.join('/')} 중 하나여야 함).`);
  }
  if (!VALID_FIT_MODES.includes(record.imageFitMode)) {
    errors.push(`imageFitMode 값이 올바르지 않습니다 (${VALID_FIT_MODES.join('/')} 중 하나여야 함).`);
  }
  if (record.imageDataUrl != null && typeof record.imageDataUrl !== 'string') {
    errors.push('imageDataUrl은 문자열이거나 null이어야 합니다.');
  }
  if (record.imageDataUrl && !/^data:image\//.test(record.imageDataUrl)) {
    errors.push('imageDataUrl 형식이 올바르지 않습니다 (data:image/...).');
  }
  if (!isValidHexColor(record.backgroundColor)) {
    errors.push('backgroundColor가 올바른 HEX 색상이 아닙니다.');
  }

  const text = record.text;
  if (!text || typeof text !== 'object') {
    errors.push('text 필드가 없습니다.');
  } else {
    if (typeof text.content !== 'string') errors.push('text.content가 문자열이 아닙니다.');
    if (!isValidHexColor(text.color)) errors.push('text.color가 올바른 HEX 색상이 아닙니다.');
    ['xRatio', 'yRatio', 'wRatio', 'hRatio', 'maxFontSizeRatio'].forEach((key) => {
      if (!isValidRatioNumber(text[key])) errors.push(`text.${key}가 0~1 범위의 숫자가 아닙니다.`);
    });
    if (!VALID_ALIGNS.includes(text.align)) {
      errors.push(`text.align 값이 올바르지 않습니다 (${VALID_ALIGNS.join('/')} 중 하나여야 함).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 가져오기(import) JSON 페이로드 전체를 검사한다.
 * 파싱은 이미 성공한 상태(JSON.parse 완료)에서 호출된다.
 * @returns {{ok: boolean, validItems: object[], invalidItems: {index:number, errors:string[]}[], reason?: string}}
 */
function validateImportPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, validItems: [], invalidItems: [], reason: '최상위 값이 객체가 아닙니다.' };
  }
  if (!Array.isArray(parsed.templates)) {
    return { ok: false, validItems: [], invalidItems: [], reason: 'templates 배열이 없습니다.' };
  }

  const validItems = [];
  const invalidItems = [];
  parsed.templates.forEach((item, index) => {
    const { valid, errors } = validateTemplateRecord(item);
    if (valid) {
      validItems.push(item);
    } else {
      invalidItems.push({ index, errors });
    }
  });

  if (validItems.length === 0) {
    return {
      ok: false,
      validItems,
      invalidItems,
      reason: '가져올 수 있는 유효한 템플릿이 하나도 없습니다.',
    };
  }

  return { ok: true, validItems, invalidItems };
}
