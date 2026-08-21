/**
 * TemplateStore.js
 * 카드 4(실제 템플릿 관리)의 저장소. localStorage에 CRUD를 구현하고,
 * 손상된 저장값·개별 레코드 오류·quota 초과를 모두 방어적으로 처리한다.
 *
 * 손상 저장소 처리 원칙: JSON.parse 실패나 최상위 shape 불일치 시,
 * 기존 원본 문자열은 별도 key로 백업하고 빈 목록으로 시작한다 - 절대 그냥
 * 덮어쓰거나 예외를 던져 앱을 멈추지 않는다.
 */
const TemplateStore = {
  STORAGE_KEY: 'meme-card-maker:templates:v1',

  /** @returns {object[]} 유효성 검사를 통과한 TemplateRecord 배열 */
  load() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw == null) return [];

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this._backupCorrupt(raw, 'json-parse-error');
      return [];
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.templates)) {
      this._backupCorrupt(raw, 'shape-mismatch');
      return [];
    }

    // 개별 레코드 단위로 검사 - 레코드 하나가 깨졌다고 전체를 버리지 않는다.
    const valid = [];
    parsed.templates.forEach((record) => {
      const { valid: ok } = validateTemplateRecord(record);
      if (ok) valid.push(record);
      else console.warn('[TemplateStore] 유효하지 않은 템플릿 레코드를 건너뜁니다:', record && record.id);
    });
    return valid;
  },

  /** @returns {{ok:boolean, error?:string}} */
  saveAll(list) {
    const payload = JSON.stringify({ version: 1, templates: list });
    try {
      localStorage.setItem(this.STORAGE_KEY, payload);
      return { ok: true };
    } catch (e) {
      const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return {
        ok: false,
        error: isQuota
          ? '저장 용량이 부족합니다. 이미지 용량이 큰 템플릿을 정리한 뒤 다시 시도해 주세요.'
          : '템플릿을 저장하지 못했습니다.',
      };
    }
  },

  getAll() {
    return this.load();
  },

  getById(id) {
    return this.load().find((t) => t.id === id) || null;
  },

  create(name, cardState) {
    const record = createTemplateRecord(name, cardState);
    const list = this.load();
    list.push(record);
    const result = this.saveAll(list);
    return { ...result, record };
  },

  update(id, name, cardState) {
    const list = this.load();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return { ok: false, error: '템플릿을 찾을 수 없습니다.' };
    const createdAt = list[idx].createdAt;
    const record = createTemplateRecord(name, cardState, id);
    record.createdAt = createdAt;
    list[idx] = record;
    const result = this.saveAll(list);
    return { ...result, record };
  },

  remove(id) {
    const list = this.load();
    const next = list.filter((t) => t.id !== id);
    return this.saveAll(next);
  },

  /**
   * 유효한 레코드들을 기존 새 ID로 재부여해 목록 뒤에 append한다.
   * 절대 목록을 통째로 교체(replace)하지 않는다 - 이것이 "고장난 import가
   * 기존 템플릿을 파괴할 수 없다"는 보장의 핵심이다.
   */
  appendImported(validRecords) {
    const list = this.load();
    const now = new Date().toISOString();
    const withNewIds = validRecords.map((r) => ({
      ...r,
      id: generateId('tpl'),
      createdAt: now,
      updatedAt: now,
    }));
    const next = list.concat(withNewIds);
    const result = this.saveAll(next);
    return { ...result, added: withNewIds.length };
  },

  _backupCorrupt(raw, reason) {
    try {
      const backupKey = `${this.STORAGE_KEY}:corrupt-backup:${Date.now()}`;
      localStorage.setItem(backupKey, raw);
      console.warn(`[TemplateStore] 손상된 저장값을 ${backupKey}로 백업했습니다. 원인: ${reason}`);
    } catch (e) {
      console.warn('[TemplateStore] 손상된 저장값 백업도 실패했습니다:', e);
    }
  },
};
