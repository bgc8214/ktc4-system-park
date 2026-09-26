/* declared.model.js: 적어둔 것과 실제로 도는 것 — 선언은 약속이지 증거가 아니다.
 *
 * 순수 함수. node 단독 실행:
 *   node -e "require('./topics/declared.model.js'); console.log(globalThis.DeclaredModel.demo())"
 *
 * 세 개의 선언이 있다. 전부 파일에 또렷이 적혀 있고, 빌드도 통과한다.
 * 그런데 셋 다 실제로는 아무 일도 하지 않는다 — 각각 다른 이유로.
 *   ① Flyway     의존성은 있는데 자동설정 스타터가 빠져 마이그레이션이 안 돈다
 *   ② 세션 저장소  설정 키가 새 버전에서 사라져 조용히 무시된다
 *   ③ 프론트 CI   워크플로 파일 위치가 틀려 실행기가 읽지 않는다
 *
 * 선언을 믿으면 셋 다 통과하고, 부작용을 확인하면 셋 다 걸린다.
 *
 * 정직성 경계:
 *   진짜 계산   선언 검사 통과 여부 · 부작용 검사가 잡아내는 개수 · 운영 반입 판정
 *   비유        검사대·도장·반려 통지서
 *   실제 근거   경북대 1팀이 2~3주차에 실제로 겪은 세 사건이다(#11 · #17 · 프론트 CI)
 */
(function (global) {
  'use strict';

  /* 선언 3장. declared = 파일에 적힌 것, works = 실제로 동작하는가(=거짓말 여부) */
  var DECLARATIONS = [
    {
      id: 'flyway',
      label: 'DB 마이그레이션이 기동 시 실행된다',
      written: "implementation 'org.flywaydb:flyway-core'",
      works: false,
      why: '자동설정이 spring-boot-starter-flyway 로 옮겨갔는데 하위 라이브러리만 의존했다',
      /* 부작용 검사: 이력 테이블에 행이 있는가 */
      probe: 'flyway_schema_history 에 적용 기록이 있는가'
    },
    {
      id: 'session',
      label: '세션을 DB에 저장한다',
      written: 'spring.session.store-type: jdbc',
      works: false,
      why: '새 버전에서 이 설정 키 자체가 사라져 조용히 무시된다 — 메모리 세션으로 돈다',
      probe: '로그인 후 SPRING_SESSION 에 행이 생기는가'
    },
    {
      id: 'ci',
      label: '프론트 테스트가 PR마다 돈다',
      written: 'frontend/.github/workflows/ci.yml',
      works: false,
      why: '실행기는 레포 루트의 .github/workflows/ 만 읽는다 — 하위 폴더는 보지 않는다',
      probe: 'PR 에 실제로 체크가 붙는가'
    }
  ];

  /* scenario: 'trust'(선언을 믿는다) | 'verify'(부작용을 확인한다) */
  function newModel(scenario) {
    return {
      verify: scenario === 'verify',
      loaded: [],        // 실은 선언서
      syntaxOk: 0,       // 문법 검사를 통과한 수
      booted: false,
      probed: [],        // 부작용 검사 결과 [{id, passed}]
      caught: 0,         // 적발한 거짓 선언 수
      shipped: false,
      cargo: '배포 준비'
    };
  }

  /* 선언 접수: 파일에 적힌 것을 그대로 싣는다 */
  function load(m) {
    m.loaded = DECLARATIONS.map(function (d) { return d.id; });
    m.cargo = '선언 ' + m.loaded.length + '장 적재';
  }

  /* 빌드 검사: 문법만 본다. 여기서는 셋 다 통과한다 — 그게 함정이다. */
  function build(m) {
    m.syntaxOk = m.loaded.length;
    m.cargo = '문법 검사 ' + m.syntaxOk + '/' + m.loaded.length + ' 통과';
  }

  /* 기동: 실제로 띄운다. 에러 없이 뜬다 — 이것도 함정이다. */
  function boot(m) {
    m.booted = true;
    m.cargo = '기동 성공 (에러 0)';
  }

  /* 부작용 검사대: 선언이 아니라 결과를 본다.
     'trust' 장면에서는 이 검사대가 아예 없어 그냥 통과한다. */
  function probe(m) {
    if (!m.verify) {
      m.cargo = '검사 없음 — 선언을 믿고 통과';
      return;
    }
    m.probed = DECLARATIONS.map(function (d) {
      return { id: d.id, passed: d.works, probe: d.probe, why: d.why };
    });
    m.caught = m.probed.filter(function (p) { return !p.passed; }).length;
    m.cargo = '거짓 선언 ' + m.caught + '건 적발';
  }

  /* 반입 판정: 적발이 0건이면 운영으로 나간다 */
  function ship(m) {
    m.shipped = m.caught === 0;
    m.cargo = m.shipped ? '운영 반입' : '반려 — ' + m.caught + '건 수정 필요';
  }

  /* 실제로 동작하는 선언 수 — 장면과 무관한 진실 */
  function trulyWorking() {
    return DECLARATIONS.filter(function (d) { return d.works; }).length;
  }

  function demo() {
    function run(sc) {
      var m = newModel(sc);
      load(m); build(m); boot(m); probe(m); ship(m);
      return { caught: m.caught, shipped: m.shipped };
    }
    return { trust: run('trust'), verify: run('verify'), truth: trulyWorking() + '/3 작동' };
  }

  global.DeclaredModel = {
    DECLARATIONS: DECLARATIONS,
    newModel: newModel, load: load, build: build, boot: boot,
    probe: probe, ship: ship, trulyWorking: trulyWorking, demo: demo
  };
})(typeof window !== 'undefined' ? window : globalThis);
