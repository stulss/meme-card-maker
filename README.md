# 이미지+문구 카드 메이커 (meme-card-maker)

이미지와 문구를 조합해 밈·카드뉴스·SNS 게시용 이미지를 만들고 파일로 내려받는 웹 도구입니다.
설치나 로그인 없이 브라우저에서 바로 사용할 수 있습니다.

**관련 문서:** [[meme-card-maker/작업내역_체크리스트|작업내역 체크리스트]] · [[meme-card-maker/docs/00_과제_요구사항_매핑|과제 요구사항 매핑]] · [[meme-card-maker/docs/01_기획|기획]] · [[meme-card-maker/docs/05_배포|배포 절차]] · [[meme-card-maker/검증안내서|검증안내서]] · [[meme-card-maker/트러블슈팅|트러블슈팅]] · [[meme-card-maker/AI_3줄|AI 3줄]]

## 공개 주소

(배포 완료 후 채워짐 — `docs/05_배포.md` 참고)

## 핵심 기능

- PNG·JPEG 이미지 불러오기 + 문구 위치·크기·색 편집, 즉시 미리보기
- 1:1 · 4:5 · 9:16 세 화면비 — 미리보기와 다운로드 파일이 항상 일치
- 긴 한글·한영 혼합·줄바꿈·이모지 등 극단 입력에서도 문구가 잘리거나 겹치지 않음(자동 축소 + 클립 안전망)
- 템플릿 생성·불러오기·수정·삭제 (브라우저 localStorage, 새로고침 후에도 유지)
- 템플릿 JSON 내보내기·가져오기 (잘못된 파일이 들어와도 기존 템플릿은 보존)

## 기술 스택

순수 HTML/CSS/JavaScript (빌드 도구 없음), Canvas 2D API, localStorage.
자세한 근거는 `docs/01_기획.md` 참고.

## 폴더 구조

```
meme-card-maker/
├─ index.html               앱 진입 화면
├─ css/style.css             스타일 + Pretendard 폰트
├─ assets/
│  ├─ fonts/                Pretendard Variable (OFL 라이선스)
│  └─ sample-images/        절차적으로 생성한 검사용 이미지 5종
├─ js/
│  ├─ models/                상태·저장소 (CardStateModel, TemplateStore 등)
│  ├─ render/                 렌더링 핵심 (CardRenderer, TextLayout, ImageFit)
│  ├─ views/                   DOM 바인딩
│  ├─ controllers/             이벤트 연결
│  └─ main.js                  진입점
├─ tools/
│  ├─ generate-fixtures.html   fixture 이미지 생성 도구(개발용)
│  └─ fixtures/import-invalid/ 가져오기 거부 테스트용 잘못된 JSON 2종
├─ docs/                       기획·요구사항 매핑·엣지케이스·배포 문서
└─ img/                        검증 스크린샷·완성 샘플
```

## 로컬에서 실행하기

```bash
python -u ".claude/serve.py" 8127 meme-card-maker
```
그 후 `http://localhost:8127` 접속. (정적 파일이지만 `index.html`을 더블클릭하면
일부 브라우저에서 CORS 제약이 걸릴 수 있어 서버로 여는 것을 권장합니다.)

## 문서 색인

| 하려는 일 | 읽을 문서 |
|---|---|
| 과제 요구사항과 대응 확인 | `docs/00_과제_요구사항_매핑.md` |
| 설계·기술 결정 근거 확인 | `docs/01_기획.md` |
| 극단 입력 12종 테스트 결과 확인 | `docs/03_엣지케이스_테스트_결과.md` |
| 배포 방법 확인 | `docs/05_배포.md` |
| 실행 방법(짧게) 확인 | `검증안내서.md` |
| 과거 문제 해결 사례 확인 | `트러블슈팅.md` |
| 진행 상황·결정 기록 확인 | `작업내역_체크리스트.md` |
