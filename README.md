# 시스템 파크 — PR 리뷰로 배우는 백엔드 6장면

카카오테크캠퍼스 4기 학생 PR의 실제 질문·멘토 답변에서 나온 6개 개념을,
차량이 **실제 시뮬레이션을 싣고 달리는** 등각투영 지도로 배우는 정적 사이트.
[ktc4-review-learning](https://github.com/bgc8214/ktc4-review-learning)(시스템 타이쿤)의
콘텐츠를 isometric-explainer 스킬 엔진으로 재구축한 것이다.

의존성 없는 정적 사이트: `index.html`을 열거나

```bash
python3 -m http.server 8000    # → http://localhost:8000/
```

## 원본과 무엇이 다른가

| | 시스템 타이쿤(원본) | 시스템 파크(이 레포) |
|---|---|---|
| 지도 상태 | `worlds.mjs`의 **미리 구운 trace 테이블** | 정류장마다 **모델 함수가 실제 실행** |
| 진행 | 버튼 클릭 슬라이드쇼 | 차량이 연속 주행 + **읽기 속도 정차** |
| 비교 장면 | 장면별 사전 스크립트 | 같은 모델을 **다른 규칙으로 재계산** |
| 검증 | 별도 experiments 테스트 | 모델을 node로 단독 실행 + 헤드리스 스모크 |

## 여섯 지도

| 파일 | 주제 | 비교 장면 | 출처 리뷰 |
|---|---|---|---|
| `auth.html` | 세션·쿠키·인가 | UUID만 vs 소유권 검사 | 경북 1팀 #4 |
| `atomic.html` | 경쟁 상태·GETDEL | GET+DEL 분리 vs GETDEL | 강원 3팀 #59 |
| `transaction.html` | 커밋·롤백·원자성 | 별도 커밋 vs 한 트랜잭션 | 강원 3팀 #59 |
| `polling.html` | 202·jobId·폴링 복구 | 메모리에만 vs 목록 복원 | 경북 1팀 #4 |
| `ports.html` | 포트·어댑터 | GitHub 먼저 vs 대역 먼저 | 경북 1팀 #4 |
| `evidence.html` | LLM 초안·SHA 검증 | 없는 SHA / 주장 불일치 / 정상 | 경북 1팀 #4 |

대부분 **사고 장면이 기본값**이다 — 먼저 부서지는 걸 보고, 비교 장면을 바꿔 고친다.

## 정직성 장부

- **진짜 계산**: 패널의 「현재 상태」와 지도 위 동적 값(드럼 개수·기둥 눈금·진열대 색·통 채움)은
  전부 `topics/*.model.js`의 순수 함수가 정류장에서 실행되어 나온 것이다.
  여섯 모델 모두 node로 단독 실행해 검증했다 (`node -e "require('./topics/auth.model.js'); ..."`).
- **비유**: 시간·차량·건물·상자. 실제 Redis·DB·GitHub API·LLM은 호출하지 않는다.
- **주제별 가정과 한계**: 각 페이지의 「정확성」 모달과 `topics/*.model.js` 머리 주석에 있다.
- **검토 기록**: 원 레포의 `knowledge.md`에서 공식 문서로 핵심 규칙을 교차 확인했다.
  모델 자체 검토이며 외부 전문가의 보증은 아니다.

## 구조

```
index.html                허브 — 여섯 지도 목록
{auth,...}.html           지도 페이지 (page-template.html에서 생성)
css/styles.css            공용 UI
js/iso.js  js/main.js     엔진 (isometric-explainer 템플릿 그대로)
js/sim.js                 상태 머신 — 주제 내용은 전부 World 계약으로 위임
js/render.js              렌더러 + 랜드마크 라이브러리(bin·column·toll·bench·safe…)
js/ui.js                  패널·시나리오 선택·내레이션 (공용)
topics/<t>.model.js       주제의 순수 모델 — node 단독 실행 가능
topics/<t>.world.js       주제의 길·정류장·구역·글·건물 + World 계약 구현
```

새 주제를 더하려면 `topics/X.model.js` + `topics/X.world.js`를 쓰고
`page-template.html`의 `__TOPIC__`을 치환한 페이지 하나를 만들면 된다 — 엔진은 손대지 않는다.

검증: `for f in js/*.js topics/*.js; do node --check "$f"; done` +
skill의 `smoke.mjs`로 6페이지 전부 헤드리스 통과(콘솔 에러 0, 전 정류장 발화).

isometric-explainer 스킬로 제작. MIT.
