/* retry.model.js: 응답이 사라졌을 때 — 같은 키로 다시 보낼 것인가.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/retry.model.js'); console.log(globalThis.RetryModel.demo())"
 *
 * 멱등키의 진짜 어려움은 "키를 만드는 법"이 아니라 **"언제 같은 키를 다시 쓰는가"**다.
 * 실패에는 두 종류가 있고, 둘을 구분하지 못하면 멱등키가 있어도 중복이 생긴다.
 *   · 결과를 아는 실패(400·404·409) — 서버가 확실히 처리 안 함 → 새 키가 맞다
 *   · 결과를 모르는 실패(네트워크 끊김·500·타임아웃) — 서버가 했는지 모름 → 같은 키여야 한다
 *
 * 정직성 경계:
 *   진짜 계산   키 재사용 판단 · DB 유니크 제약의 거절 · 최종 생성된 Job 수 —
 *               분기 그대로의 결과다
 *   가정        첫 요청은 서버에 도달해 Job이 만들어졌고, 응답만 유실됐다
 *               (이 지도가 다루려는 정확한 상황)
 *   범위 밖     재시도 횟수·지수 백오프·서킷 브레이커
 */
(function (global) {
  'use strict';

  /* scenario: 'blind'(실패하면 무조건 새 키) | 'smart'(결과를 모를 때만 같은 키) */
  function newModel(scenario) {
    return {
      smart: scenario === 'smart',
      key: 'k-1',              // 지금 손에 든 멱등 키
      attempt: 0,              // 몇 번째 시도인가
      sentKeys: [],            // 서버에 도달한 키들
      jobs: [],                // DB에 만들어진 Job (키와 함께)
      lastOutcome: null,       // 'LOST' | 'OK' | 'DUPLICATE_BLOCKED'
      knownFailure: null,      // 이번 실패가 "결과를 아는" 것인가
      cargo: '분석 요청 준비'
    };
  }

  /* 발신 창구: 키를 들고 출발한다 */
  function prepare(m) {
    m.attempt++;
    m.cargo = m.attempt + '차 시도 · 키 ' + m.key;
  }

  /* 접수 사무소: DB 유니크 제약이 심판이다.
     같은 키가 이미 있으면 새로 만들지 않고 기존 것을 돌려준다. */
  function receive(m) {
    m.sentKeys.push(m.key);
    var existing = m.jobs.find(function (j) { return j.key === m.key; });
    if (existing) {
      m.lastOutcome = 'DUPLICATE_BLOCKED';
      m.cargo = '같은 키 — 기존 Job #' + existing.id + ' 반환';
      return;
    }
    var job = { id: m.jobs.length + 1, key: m.key };
    m.jobs.push(job);
    m.lastOutcome = 'OK';
    m.cargo = 'Job #' + job.id + ' 생성';
  }

  /* 응답 구간: 1차 시도에서만 응답이 유실된다 — 이 지도가 다루는 사건.
     서버는 일을 다 했는데 클라이언트는 그걸 모른다. */
  function respond(m) {
    if (m.attempt === 1) {
      m.lastOutcome = 'LOST';
      m.knownFailure = false;        // 처리됐는지 모르는 실패
      m.cargo = '응답 유실 — 처리 여부 모름';
      return;
    }
    m.knownFailure = null;
    m.cargo = '응답 도착';
  }

  /* 재시도 판단소: 이 지도의 심장.
     "결과를 아는 실패면 새 키, 모르는 실패면 같은 키." */
  function decide(m) {
    if (m.lastOutcome !== 'LOST') { m.cargo = '재시도 없음'; return; }
    if (m.smart && m.knownFailure === false) {
      m.cargo = '결과 모름 → 같은 키 유지 (' + m.key + ')';
    } else {
      m.key = 'k-' + (m.attempt + 1);
      m.cargo = '새 키 발급 (' + m.key + ')';
    }
  }

  function settle(m) {
    m.cargo = 'Job ' + m.jobs.length + '개';
  }

  function demo() {
    function run(sc) {
      var m = newModel(sc);
      prepare(m); receive(m); respond(m); decide(m);   // 1차 — 응답 유실
      prepare(m); receive(m); respond(m);              // 2차 — 재시도
      settle(m);
      return { jobs: m.jobs.length, keys: m.sentKeys };
    }
    return { blind: run('blind'), smart: run('smart') };
  }

  global.RetryModel = {
    newModel: newModel, prepare: prepare, receive: receive,
    respond: respond, decide: decide, settle: settle, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
