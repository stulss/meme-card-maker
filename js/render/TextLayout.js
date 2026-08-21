/**
 * TextLayout.js
 * 텍스트 줄바꿈 + 자동 축소(autofit) + 클립 안전망.
 *
 * 카드 3(극단 입력 검사)의 핵심 모듈. 알고리즘 개요:
 * 1. 수동 줄바꿈(\n)을 먼저 존중해 문단으로 나눈다.
 * 2. 각 문단을 공백 기준으로 "단어" 토큰화한다 (영어 단어 줄바꿈, 한영 혼합 지원).
 * 3. 상자 폭을 넘는 토큰(긴 한글 연속, 거대한 미분할 토큰)은 Intl.Segmenter로
 *    grapheme(글자 모음) 단위로 다시 쪼갠다 -> 이모지 합성 시퀀스(ZWJ, 국기 등)가
 *    깨지지 않고 하나의 단위로 유지된다.
 * 4. 이진 탐색으로 상자에 맞는 가장 큰 폰트 크기를 찾는다 (선형 감소보다 빠름).
 * 5. 그래도 넘치면(=오버플로우 강제 케이스) ctx.clip()으로 상자 밖 렌더링을 차단한다.
 * 6. 측정에 쓴 것과 동일한 baseline 계산으로 그린다 (측정·paint 불일치 시 클립 위험).
 */
const TextLayout = {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{content:string, color:string, align:string, fontFamily:string}} textSpec
   * @param {{x:number,y:number,w:number,h:number}} box - 픽셀 단위 텍스트 상자
   * @param {{maxFontSizePx:number, minFontSizePx?:number, lineHeightRatio?:number}} opts
   * @returns {{didShrink:boolean, didClip:boolean, finalFontSizePx:number}}
   */
  fitAndDraw(ctx, textSpec, box, opts) {
    const minFontSizePx = (opts && opts.minFontSizePx) || 10;
    const maxFontSizePx = (opts && opts.maxFontSizePx) || 96;
    const lineHeightRatio = (opts && opts.lineHeightRatio) || 1.25;
    const content = textSpec.content || '';

    if (!content.trim()) {
      return { didShrink: false, didClip: false, finalFontSizePx: maxFontSizePx };
    }

    const fontFamily = textSpec.fontFamily || 'sans-serif';

    // 1) 이진 탐색으로 상자에 맞는 최대 폰트 크기 탐색
    let lo = minFontSizePx;
    let hi = maxFontSizePx;
    let bestLayout = null;
    let bestSize = minFontSizePx;

    const fits = (size) => {
      ctx.font = `${size}px ${fontFamily}`;
      const layout = this._layoutLines(ctx, content, box.w);
      const blockHeight = layout.lines.length * size * lineHeightRatio;
      return { ok: blockHeight <= box.h, layout };
    };

    // hi부터 시도: 처음부터 맞으면 축소 불필요
    let hiResult = fits(hi);
    if (hiResult.ok) {
      bestSize = hi;
      bestLayout = hiResult.layout;
    } else {
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const result = fits(mid);
        if (result.ok) {
          lo = mid;
          bestLayout = result.layout;
        } else {
          hi = mid - 1;
        }
      }
      bestSize = lo;
      if (!bestLayout) {
        // minFontSizePx에서도 세로로 넘침 -> 그래도 레이아웃은 필요 (클립 안전망용)
        bestLayout = fits(minFontSizePx).layout;
      }
    }

    // 2) 세로 오버플로우 재확인 (클립 안전망이 필요한지)
    const blockHeight = bestLayout.lines.length * bestSize * lineHeightRatio;
    const didClip = blockHeight > box.h;
    const didShrink = bestSize < maxFontSizePx;

    // 3) 실제 draw
    ctx.font = `${bestSize}px ${fontFamily}`;
    ctx.fillStyle = textSpec.color || '#000000';
    ctx.textAlign = textSpec.align || 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.save();
    if (didClip) {
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
    }

    const lineHeight = bestSize * lineHeightRatio;
    const totalHeight = bestLayout.lines.length * lineHeight;
    const startY = box.y + Math.max(0, (box.h - totalHeight) / 2);
    // ascent 근사값(폰트 메트릭 기반) - 라인 상단에서 baseline까지 거리
    const ascent = bestSize * 0.8;

    let drawX = box.x;
    if (ctx.textAlign === 'center') drawX = box.x + box.w / 2;
    else if (ctx.textAlign === 'right') drawX = box.x + box.w;

    bestLayout.lines.forEach((line, i) => {
      const y = startY + i * lineHeight + ascent;
      ctx.fillText(line, drawX, y);
    });

    ctx.restore();

    return { didShrink, didClip, finalFontSizePx: bestSize };
  },

  /**
   * 문단(\n 분해) -> 토큰화 -> 그리디 줄 채우기.
   * @returns {{lines: string[]}}
   */
  _layoutLines(ctx, content, maxWidth) {
    const paragraphs = content.split('\n');
    const lines = [];

    paragraphs.forEach((paragraph) => {
      if (paragraph === '') {
        lines.push('');
        return;
      }
      const tokens = this._tokenize(ctx, paragraph, maxWidth);
      let current = '';
      tokens.forEach((token) => {
        if (token === ' ') {
          // 공백은 현재 줄에 붙여보고, 다음 토큰이 넘치면 자연히 새 줄에서 trim됨
          const candidate = current + token;
          if (ctx.measureText(candidate).width <= maxWidth || current === '') {
            current = candidate;
          } else {
            lines.push(current.trimEnd());
            current = '';
          }
          return;
        }
        const candidate = current + token;
        if (current === '' || ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current.trimEnd());
          current = token;
        }
      });
      if (current !== '') lines.push(current.trimEnd());
      if (tokens.length === 0) lines.push('');
    });

    return { lines: lines.length ? lines : [''] };
  },

  /**
   * 공백으로 1차 분할 후, 상자보다 넓은 토큰은 grapheme 단위로 재분할한다.
   * 공백 자체도 하나의 토큰(' ')으로 유지해 재조립 시 원래 간격을 보존한다.
   */
  _tokenize(ctx, paragraph, maxWidth) {
    const words = paragraph.split(/( +)/).filter((s) => s !== '');
    const tokens = [];
    words.forEach((word) => {
      if (word.trim() === '') {
        tokens.push(' ');
        return;
      }
      if (ctx.measureText(word).width <= maxWidth) {
        tokens.push(word);
        return;
      }
      // 상자보다 넓은 단어(공백 없는 긴 한글/거대 토큰) -> grapheme 단위로 분해
      this._segmentGraphemes(word).forEach((g) => tokens.push(g));
    });
    return tokens;
  },

  /**
   * Intl.Segmenter가 있으면 grapheme cluster 단위로, 없으면 code point 단위로 분해.
   * 이모지 ZWJ 시퀀스·국기·피부톤 modifier가 하나의 단위로 유지된다.
   */
  _segmentGraphemes(str) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      try {
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return Array.from(seg.segment(str), (s) => s.segment);
      } catch (e) {
        // fallthrough to fallback
      }
    }
    return Array.from(str); // code point 단위 (구형 브라우저 폴백)
  },
};
