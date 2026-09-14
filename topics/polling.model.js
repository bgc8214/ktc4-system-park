/* polling.model.js: 비동기 Job — 브라우저 메모리와 서버 작업은 다른 세계다.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/polling.model.js'); console.log(globalThis.PollModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   서버 진행률·상태와 화면 상태의 분리 · 새로고침이 지우는 것과
 *               못 지우는 것 · 복구 경로 유무에 따른 결말
 *   가정        서버는 새로고침과 무관하게 작업을 지속하는 구현이다
 *   범위 밖     폴링 중단 조건·타이머 정리·소유권 확인·서버 재시작 복구
 */
(function (global) {
  'use strict';

  /* scenario: 'memoryOnly'(jobId를 JS 메모리에만) | 'recover'(내 작업 목록으로 복원) */
  function newModel(scenario) {
    return {
      restore: scenario === 'recover',
      server: '미접수',     // 서버 쪽 작업 상태
      progress: 0,
      job: null,            // 서버에 존재하는 작업 번호
      memory: null,         // 브라우저 JS 메모리의 jobId
      screen: '대기',       // 화면이 표시 중인 것
      reloaded: false,
      cargo: 'POST /analyze'
    };
  }

  /* 접수: 202와 jobId. 성공 완료가 아니다. */
  function accept(m) {
    m.job = 42;
    m.memory = 42;
    m.server = 'QUEUED';
    m.screen = '접수 · 202';
    m.cargo = '202 + jobId 42';
  }

  /* 서버 작업 진행 — 화면과 무관하게 돈다 */
  function work(m, pct) {
    m.progress = Math.min(100, m.progress + pct);
    m.server = m.progress >= 100 ? 'SUCCEEDED' : 'RUNNING';
    m.cargo = '서버 ' + m.progress + '%';
  }

  /* 새로고침: JS 메모리만 초기화된다. 서버의 job 42는 그대로다. */
  function refresh(m) {
    m.memory = null;
    m.screen = '초기화';
    m.reloaded = true;
    m.cargo = '메모리 초기화';
  }

  /* 복구 창구: 저장해 둔 ID 또는 "내 작업 목록"으로 42를 되찾는다 — 경로가 있다면 */
  function recover(m) {
    if (m.restore) {
      m.memory = m.job;
      m.cargo = 'GET /jobs (내 목록) → 42';
    } else {
      m.cargo = '어떤 작업인지 모름';
    }
  }

  /* 폴링: 메모리에 ID가 있어야 조회할 수 있다 */
  function poll(m) {
    if (m.memory == null) {
      m.screen = '결과 미표시';
      m.cargo = '조회할 ID 없음';
      return;
    }
    m.screen = m.server === 'SUCCEEDED' ? '완료' : m.server + ' · ' + m.progress + '%';
    m.cargo = 'GET /jobs/42 → ' + m.server;
  }

  function demo() {
    var a = newModel('memoryOnly');
    accept(a); work(a, 50); refresh(a); work(a, 50); recover(a); poll(a);
    var b = newModel('recover');
    accept(b); work(b, 50); refresh(b); work(b, 50); recover(b); poll(b);
    return {
      memoryOnly: { server: a.server, screen: a.screen },
      recover: { server: b.server, screen: b.screen }
    };
  }

  global.PollModel = {
    newModel: newModel, accept: accept, work: work,
    refresh: refresh, recover: recover, poll: poll, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
