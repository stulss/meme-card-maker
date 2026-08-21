/**
 * fileHelpers.js
 * 파일 읽기(FileReader→dataURL), 이미지 다운스케일, 파일 다운로드 트리거를 담당.
 *
 * 왜 FileReader.readAsDataURL인가 (canvas tainting 회피):
 * URL.createObjectURL()로 만든 blob: URL을 <img>에 넣고 canvas에 그리면,
 * 브라우저에 따라 canvas가 "tainted" 상태가 되어 toDataURL()/toBlob() 호출 시
 * SecurityError가 발생할 수 있다. FileReader.readAsDataURL()은 파일을 완전히
 * 메모리 내 base64 문자열로 바꾸므로 같은 origin의 순수 데이터로 취급되어
 * canvas가 절대 tainted되지 않는다. 로컬 개발(localhost)과 Vercel 배포
 * 양쪽에서 동일하게 안전하다.
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = dataUrl;
  });
}

/**
 * 업로드 이미지를 localStorage 저장 전에 downscale한다.
 * - maxDim(긴 변 기준)을 넘으면 비율 유지하며 축소.
 * - 알파 채널이 있으면 PNG로, 없으면 JPEG(quality)로 인코딩해 용량을 줄인다.
 *   (localStorage quota는 보통 5~10MB이므로, 원본을 그대로 저장하면
 *   템플릿 2~3개만으로 quota를 초과할 수 있다.)
 */
async function toDataUrlDownscaled(file, maxDim, quality) {
  maxDim = maxDim || 1280;
  quality = quality == null ? 0.85 : quality;

  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromDataUrl(originalDataUrl);

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, outW, outH);

  const hasAlpha = detectAlpha(ctx, outW, outH);
  const mime = hasAlpha ? 'image/png' : 'image/jpeg';
  const dataUrl = hasAlpha ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality);

  return { dataUrl, hasAlpha, width: outW, height: outH };
}

function detectAlpha(ctx, w, h) {
  // 성능을 위해 전체 픽셀이 아니라 촘촘한 샘플만 검사한다.
  const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += sampleStep) {
    for (let x = 0; x < w; x += sampleStep) {
      const idx = (y * w + x) * 4 + 3;
      if (data[idx] < 255) return true;
    }
  }
  return false;
}

/** Blob을 파일로 다운로드 (링크를 만들어 클릭 후 제거) */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime || 'application/json' });
  downloadBlob(blob, filename);
}
