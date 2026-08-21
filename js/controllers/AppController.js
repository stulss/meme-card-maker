/**
 * AppController.js
 * 합성 루트(composition root). 모든 View/Controller를 생성하고 연결한다.
 */
class AppController {
  init() {
    const editorView = new EditorView(document);
    const editorController = new EditorController(editorView);

    const templateListView = new TemplateListView(document);
    const templateController = new TemplateController(templateListView, editorController);

    const importExportView = new ImportExportView(document);
    new ImportExportController(importExportView, templateController);

    // 야구 모드: 패널이 화면에 있을 때만 활성화된다 (생성자 안에서 자체 확인)
    new BaseballController(editorController);

    // 템플릿을 저장/수정한 뒤에도 목록이 최신 상태를 반영하도록,
    // 편집 상태가 바뀌면 "현재 템플릿 수정" 버튼 활성 여부만 갱신한다.
    editorController.onRender = () => {
      templateController.view.setUpdateButtonEnabled(!!templateController.activeTemplateId);
    };
  }
}
