/* auth.model.js: 인증·인가 — 실제로 일어나는 일.
 *
 * 순수 함수만 있다. node로 단독 실행 가능:
 *   node -e "require('./topics/auth.model.js'); console.log(globalThis.AuthModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   세션 생성(SID→사용자 연결) · 인가 판정(소유권 비교) ·
 *               노출 여부와 응답 코드 — 전부 아래 함수의 분기 그대로다
 *   비유        차량·건물·상자. 실제 토큰·쿠키·네트워크는 없다
 *   가정        A가 B의 카드 UUID를 이미 알고 있다(추측이 아니라 조건으로 고정) ·
 *               세션 만료·CSRF·XSS는 이 지도의 범위 밖
 */
(function (global) {
  'use strict';

  /* scenario: 'secure'(소유권 검사 있음) | 'uuidOnly'(UUID만 믿음) */
  function newModel(scenario) {
    return {
      checkOn: scenario === 'secure',
      user: null,          // 인증된 사용자
      sid: null,           // 서버가 발급한 세션 ID
      target: 'B',         // 요청하는 카드의 소유자 — A가 B의 UUID를 안다
      denied: false,
      opened: null,        // 실제로 열린 카드의 소유자
      code: null,          // 최종 응답
      cargo: '로그인 요청'
    };
  }

  /* 로그인 센터: 신원 확인. 아직 권한 이야기가 아니다. */
  function login(m) {
    m.user = 'A';
    m.cargo = '사용자 A 확인됨';
  }

  /* 세션 보관소: 서버가 SID→A를 저장하고, 쿠키에는 SID만 실린다. */
  function makeSession(m) {
    m.sid = 's7';
    m.cargo = 'Cookie: SID=s7';
  }

  /* 다음 요청: A가 B의 카드 UUID로 요청을 만든다. */
  function requestCard(m) {
    m.cargo = 'GET /cards/' + m.target + '의-UUID';
  }

  /* 인가 검문소 — 이 지도의 핵심 한 줄.
     인증(누구인가)과 인가(이 자원을 봐도 되는가)는 다른 질문이다. */
  function authorize(m) {
    if (!m.user) { m.denied = true; m.code = '401'; m.cargo = '401 미인증'; return; }
    if (m.checkOn && m.target !== m.user) {
      m.denied = true;
      /* 존재 여부를 숨기려고 404를 쓴다. 정책에 따라 403도 가능하다. */
      m.code = '404';
      m.cargo = '404 거절';
      return;
    }
    m.cargo = '창고 진입 허가';
  }

  /* 카드 창고: 검문을 통과했으면 카드가 열린다 — 소유자가 누구든. */
  function openCard(m) {
    m.opened = m.target;
    m.code = '200';
    m.cargo = m.target + '의 카드';
  }

  /* 응답 터미널: 최종 응답 확정 */
  function respond(m) {
    if (!m.code) m.code = m.denied ? '404' : '200';
    m.cargo = m.denied ? '404 응답' : '200 + ' + (m.opened || '?') + '의 카드';
  }

  function exposed(m) { return m.opened === 'B' ? 1 : 0; }

  function demo() {
    var a = newModel('secure');
    login(a); makeSession(a); requestCard(a); authorize(a);
    if (!a.denied) openCard(a);
    respond(a);
    var b = newModel('uuidOnly');
    login(b); makeSession(b); requestCard(b); authorize(b);
    if (!b.denied) openCard(b);
    respond(b);
    return { secure: { code: a.code, exposed: exposed(a) }, uuidOnly: { code: b.code, exposed: exposed(b) } };
  }

  global.AuthModel = {
    newModel: newModel,
    login: login,
    makeSession: makeSession,
    requestCard: requestCard,
    authorize: authorize,
    openCard: openCard,
    respond: respond,
    exposed: exposed,
    demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
