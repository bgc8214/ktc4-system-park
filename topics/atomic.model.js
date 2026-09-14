/* atomic.model.js: 토큰 재발급의 경쟁 상태 — GET+DEL 분리 vs GETDEL.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/atomic.model.js'); console.log(globalThis.AtomicModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   토큰 원본의 존재 · 각 요청이 얻은 복사본 · 발급 수 —
 *               교차 실행 순서(A읽기→B읽기→A발급→B발급)를 그대로 실행한 결과다
 *   가정        두 요청 모두 같은 기존 토큰을 제출했고 검증 조건은 충족됐다 ·
 *               이 교차 순서는 "발생 가능한" 최악의 순서이지 항상은 아니다
 *   범위 밖     소비 후 장애·응답 유실·새 토큰 저장 정책 — GETDEL만으로
 *               재발급 전체가 안전해지는 것은 아니다
 */
(function (global) {
  'use strict';

  /* scenario: 'split'(GET 후 DEL — 사이에 B가 끼어든다) | 'atomic'(GETDEL) */
  function newModel(scenario) {
    return {
      atomic: scenario === 'atomic',
      token: true,                       // Redis의 기존 토큰 원본
      A: { copy: false, issued: false, rejected: false },
      B: { copy: false, issued: false, rejected: false },
      issued: 0,
      cargo: '요청 A · B 동시 도착'
    };
  }

  /* 창고: 읽기. 교차 실행 — A가 읽고, 삭제하기 전에 B도 읽는다. */
  function readBoth(m) {
    /* A의 읽기 */
    m.A.copy = m.token;
    if (m.atomic && m.A.copy) m.token = false;   // GETDEL: 반환과 삭제가 한 명령
    /* B의 읽기 — split이면 원본이 아직 남아 있어 B도 복사본을 얻는다 */
    m.B.copy = m.token;
    if (m.atomic && m.B.copy) m.token = false;
    m.cargo = m.B.copy ? 'A·B 둘 다 토큰 확보' : 'A만 토큰 확보';
  }

  /* 검증 센터: 복사본을 가진 요청만 통과한다. */
  function verify(m) {
    if (!m.A.copy) m.A.rejected = true;
    if (!m.B.copy) m.B.rejected = true;
    m.cargo = m.B.rejected ? 'B는 빈손 — 거절' : 'A·B 검증 통과';
  }

  /* 재발급 공장: 복사본을 가진 요청마다 새 토큰이 발급된다.
     split이면 늦은 DEL이 있어도 이미 읽은 값은 되돌릴 수 없다. */
  function reissue(m) {
    m.token = false;                     // split: 늦은 DEL. atomic: 이미 없음
    if (m.A.copy) { m.A.issued = true; m.issued++; }
    if (m.B.copy) { m.B.issued = true; m.issued++; }
    m.cargo = '새 토큰 ' + m.issued + '개 발급';
  }

  function settle(m) {
    m.cargo = m.issued === 1 ? '단일 소비 확인' : '중복 발급 ' + m.issued + '건';
  }

  function demo() {
    var s = newModel('split');
    readBoth(s); verify(s); reissue(s); settle(s);
    var a = newModel('atomic');
    readBoth(a); verify(a); reissue(a); settle(a);
    return { split: { issued: s.issued }, atomic: { issued: a.issued, bRejected: a.B.rejected } };
  }

  global.AtomicModel = {
    newModel: newModel, readBoth: readBoth, verify: verify,
    reissue: reissue, settle: settle, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
