/**
 * idGenerator.js
 * 템플릿·엔트리 등에 쓰는 고유 ID 생성기.
 * crypto.randomUUID()가 있으면 그걸 쓰고, 없으면 타임스탬프+랜덤으로 대체한다.
 */
function generateId(prefix) {
  const base =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${base}` : base;
}
