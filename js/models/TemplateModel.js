/**
 * TemplateModel.js
 * CardStateModel <-> 저장용 TemplateRecord 변환. TemplateRecord가 곧
 * localStorage/JSON export에 실제로 들어가는 저장 형식이다.
 */
function createTemplateRecord(name, cardState, existingId) {
  const now = new Date().toISOString();
  return {
    id: existingId || generateId('tpl'),
    name,
    createdAt: existingId ? undefined : now, // update 시 TemplateStore가 createdAt 유지
    updatedAt: now,
    ratio: cardState.ratio,
    imageFitMode: cardState.imageFitMode,
    imageDataUrl: cardState.imageDataUrl,
    backgroundColor: cardState.backgroundColor,
    text: {
      content: cardState.text.content,
      color: cardState.text.color,
      xRatio: cardState.text.xRatio,
      yRatio: cardState.text.yRatio,
      wRatio: cardState.text.wRatio,
      hRatio: cardState.text.hRatio,
      maxFontSizeRatio: cardState.text.maxFontSizeRatio,
      align: cardState.text.align,
      fontFamily: cardState.text.fontFamily,
    },
  };
}

function templateRecordToCardState(record) {
  return {
    ratio: record.ratio,
    imageDataUrl: record.imageDataUrl || null,
    imageFitMode: record.imageFitMode,
    backgroundColor: record.backgroundColor,
    text: {
      content: record.text.content,
      color: record.text.color,
      xRatio: record.text.xRatio,
      yRatio: record.text.yRatio,
      wRatio: record.text.wRatio,
      hRatio: record.text.hRatio,
      maxFontSizeRatio: record.text.maxFontSizeRatio,
      align: record.text.align,
      fontFamily: record.text.fontFamily || 'Pretendard, "Malgun Gothic", sans-serif',
    },
  };
}
