/* evidence.model.js: LLM 초안과 근거 검증 — 그럴듯함과 사실은 다르다.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/evidence.model.js'); console.log(globalThis.EvidenceModel.demo())"
 *
 * 정직성 경계:
 *   진짜 계산   초안의 SHA를 기록과 대조하는 판정(존재 · 주장-변경 일치)과
 *               그 결과에 따른 출고/보류 — 분기 그대로다
 *   가정        '정상' 장면은 저장소·작성자·관련성 확인까지 충족했다고 가정 ·
 *               세 장면은 미리 만든 사례이지 일반 자연어 검증 알고리즘이 아니다
 *   범위 밖     조회 실패에는 없는 SHA 외에 인증·권한·네트워크 오류도 있다 —
 *               HTTP 오류 전부를 '없는 SHA'로 취급하면 안 된다
 */
(function (global) {
  'use strict';

  /* 이 저장소의 실제 기록 (수집 결과) */
  var RECORD = { sha: 'a1b2c3', change: '로그인 오류 수정' };

  /* scenario: 'missing'(없는 SHA) | 'mismatch'(SHA는 있지만 주장 불일치) | 'valid' */
  function newModel(scenario) {
    return {
      kind: scenario,
      collected: 0,
      candidates: 0,
      llm: 0,
      draft: null,          // { sha, claim } — 모델의 주장
      checks: null,         // { exists, context } — 기록과의 대조 결과
      shipped: false,
      blocked: false,
      cargo: '원본 수집 대기'
    };
  }

  /* 수집: GitHub API의 일 — LLM 호출이 아니다 */
  function collect(m) {
    m.collected = 47;
    m.cargo = '커밋 47개 수집';
  }

  /* 압축: 규칙으로 후보를 좁힌다 — 여기도 LLM 0 */
  function compress(m) {
    m.candidates = 5;
    m.cargo = '후보 5개 (규칙)';
  }

  /* 초안: 모델이 문장과 SHA를 제안한다 — 아직 주장일 뿐이다 */
  function generate(m) {
    m.llm++;
    m.draft = {
      sha: m.kind === 'missing' ? 'ffff00' : RECORD.sha,
      claim: m.kind === 'mismatch' ? '결제 기능 구현' : RECORD.change
    };
    m.cargo = '초안 + SHA ' + m.draft.sha;
  }

  /* 재조회: 권위 있는 실제 기록과 대조한다 */
  function verify(m) {
    var exists = m.draft.sha === RECORD.sha;
    var context = exists && m.draft.claim === RECORD.change;
    m.checks = { exists: exists, context: context };
    m.cargo = !exists ? 'SHA 미발견' : (context ? '근거 확인' : '주장 ≠ 실제 변경');
  }

  /* 출고 판정: 두 검사를 모두 통과해야 확정된다 */
  function ship(m) {
    m.shipped = !!(m.checks && m.checks.exists && m.checks.context);
    m.blocked = !m.shipped;
    m.cargo = m.shipped ? '카드 확정' : '출고 차단';
  }

  function demo() {
    var out = {};
    ['missing', 'mismatch', 'valid'].forEach(function (k) {
      var m = newModel(k);
      collect(m); compress(m); generate(m); verify(m); ship(m);
      out[k] = { exists: m.checks.exists, context: m.checks.context, shipped: m.shipped };
    });
    return out;
  }

  global.EvidenceModel = {
    RECORD: RECORD,
    newModel: newModel, collect: collect, compress: compress,
    generate: generate, verify: verify, ship: ship, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
