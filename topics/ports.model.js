/* ports.model.js: 포트와 어댑터 — 업무는 그대로, 장치만 교체.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/ports.model.js'); console.log(globalThis.PortsModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   호출 수 · 네트워크 호출 수 · 두 구현체가 같은 내부 형식을
 *               반환하는지의 비교 — 실행 흐름 그대로다
 *   비유        차량의 길은 "런타임 호출 순서"다. 소스 코드 의존 방향은
 *               어댑터 → 내부 포트(반대!)이며, 길의 화살표와 혼동하면 안 된다
 *   범위 밖     실제 GitHub HTTP · 인터페이스 하나 = 전면 헥사고날이라는 오해
 */
(function (global) {
  'use strict';

  /* scenario: 'ghFirst'(GitHub 먼저) | 'fakeFirst'(테스트 대역 먼저) */
  function newModel(scenario) {
    var order = scenario === 'fakeFirst' ? ['fake', 'github'] : ['github', 'fake'];
    return {
      order: order,
      call: 0,                 // 몇 번째 호출인가 (0 또는 1)
      current: null,           // 지금 요청을 처리 중인 어댑터
      requests: 0,
      network: 0,
      results: [],             // 각 호출이 돌려준 내부 형식
      cargo: '커밋 조회 준비'
    };
  }

  function currentAdapter(m) { return m.order[Math.min(m.call, 1)]; }

  /* 업무: read(repo) 호출 — SDK가 아니라 내부 약속을 부른다 */
  function callPort(m) {
    m.current = currentAdapter(m);
    m.requests++;
    m.cargo = 'read(repo) — ' + (m.call + 1) + '번째 호출';
  }

  /* 어댑터: 같은 약속의 두 구현 */
  function adapt(m) {
    if (m.current === 'github') {
      m.network++;             // 외부 HTTP가 발생하는 유일한 곳 (여기서는 모의)
      m.cargo = 'HTTP 응답 수신';
    } else {
      m.cargo = '준비된 테스트 데이터';
    }
  }

  /* 변환소: 어느 쪽이든 내부 Commit 형식으로 맞춘다 */
  function convert(m) {
    m.results.push({ via: m.current, shape: 'Commit[]', sha: 'a1b2c3', title: '로그인 오류 수정' });
    m.cargo = 'List<Commit> 반환';
  }

  /* 업무 복귀: 결과 접수, 다음 호출 준비 */
  function receive(m) {
    m.call++;
    m.cargo = m.call < 2 ? '구현체를 바꿔 다시 호출' : '두 결과 비교';
  }

  function sameShape(m) {
    return m.results.length === 2 &&
      m.results[0].shape === m.results[1].shape &&
      m.results[0].sha === m.results[1].sha;
  }

  function demo() {
    var m = newModel('ghFirst');
    callPort(m); adapt(m); convert(m); receive(m);
    callPort(m); adapt(m); convert(m); receive(m);
    return { requests: m.requests, network: m.network, sameShape: sameShape(m) };
  }

  global.PortsModel = {
    newModel: newModel, currentAdapter: currentAdapter,
    callPort: callPort, adapt: adapt, convert: convert, receive: receive,
    sameShape: sameShape, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
