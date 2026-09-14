/* transaction.model.js: 이체와 트랜잭션 — 함께 성공하거나 함께 없던 일이 되거나.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/transaction.model.js'); console.log(globalThis.TxModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   작업 잔액과 확정 잔액의 분리 · 커밋/롤백에 따른 합계 —
 *               분기 그대로의 결과다
 *   가정        입금은 반드시 실패한다(교육 장면) · 같은 DB 안의 두 계좌
 *   범위 밖     격리 수준 · 잠금 · 외부 결제 API — DB 롤백은 외부 HTTP 요청을
 *               되돌리지 못한다
 */
(function (global) {
  'use strict';

  /* scenario: 'separate'(출금을 먼저 커밋) | 'together'(한 트랜잭션) */
  function newModel(scenario) {
    return {
      together: scenario === 'together',
      A: 100, B: 100,                 // 작업 장부 (트랜잭션 안의 값)
      committedA: 100, committedB: 100, // 확정 장부 (다른 세션이 보는 값)
      phase: 'ready',
      cargo: '이체 30 접수'
    };
  }

  function withdraw(m) {
    m.A -= 30;
    if (!m.together) m.committedA = m.A;   // 별도 커밋: 출금이 그 자리에서 확정된다
    m.phase = 'withdrawn';
    m.cargo = '30 출금 ' + (m.together ? '(임시)' : '(커밋됨)');
  }

  function deposit(m) {
    /* 입금 실패 — 이 지도의 고정 사건 */
    m.phase = 'failed';
    m.cargo = '입금 오류!';
  }

  function settle(m) {
    if (m.together) {
      m.A = m.committedA;                  // ROLLBACK: 임시 변경을 되돌린다
      m.B = m.committedB;
      m.phase = 'rolledback';
      m.cargo = 'ROLLBACK';
    } else {
      m.phase = 'partial';                 // 이미 커밋된 출금은 자동으로 안 돌아온다
      m.cargo = '보상 필요';
    }
  }

  function audit(m) {
    m.cargo = '확정 합계 ' + (m.committedA + m.committedB);
  }

  function total(m) { return m.committedA + m.committedB; }

  function demo() {
    var t = newModel('together');
    withdraw(t); deposit(t); settle(t); audit(t);
    var s = newModel('separate');
    withdraw(s); deposit(s); settle(s); audit(s);
    return { together: total(t), separate: total(s) };
  }

  global.TxModel = {
    newModel: newModel, withdraw: withdraw, deposit: deposit,
    settle: settle, audit: audit, total: total, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
