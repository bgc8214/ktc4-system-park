/* declared.world.js: 선언 검사소 — 적어둔 것과 도는 것은 다르다.
 *
 * 차량은 배포다. 짐칸의 상자 셋이 선언서 세 장이고, 셋 다 파일에 또렷이 적혀 있다.
 * 문법 검사대도 통과하고 기동도 에러 없이 된다 — 그래서 여기까지는 아무도 못 잡는다.
 * 마지막 부작용 검사대에만 길이 갈린다: 검사대가 있으면 세 장 다 반려장으로,
 * 없으면 세 장 다 그대로 운영에 들어간다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.DeclaredModel;
  var makeRoute = Iso.makeRoute;

  var MAIN = makeRoute([
    [2, 16],       // 도입부
    [2, 6],
    [7, 6],        // 2 선언 접수소
    [18, 6],       // 3 문법 검사대
    [29, 6],       // 4 기동장
    [38, 6],       // corner
    [38, 15]       // 6 부작용 검사대
  ]);

  /* 통과: 운영 반입 */
  var PASS = makeRoute([
    [38, 15],
    [38, 25],      // corner
    [26, 25],
    [13, 25]       // 3 운영 반입
  ]);

  /* 반려: 검사대에서 바로 꺾는 짧은 길 */
  var REJECT = makeRoute([
    [38, 15],
    [30, 15],
    [21, 15],      // 2 반려장
    [13, 16]
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'intake', 1.6),
      station(MAIN, 3, 'syntax', 1.6),
      station(MAIN, 4, 'boot', 1.8),
      station(MAIN, 6, 'probe', 2.2)
    ],
    pass: [ station(PASS, 3, 'verdict', 1.8) ],
    reject: [ station(REJECT, 2, 'verdict', 1.8) ]
  };

  var STATION_TO_DISTRICT = {
    intake: 'intake', syntax: 'syntax', boot: 'boot', probe: 'probe', verdict: 'verdict'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'intake', name: '선언 접수소', x: 7, y: 6, r: 3.8, color: C.steel,
      tag: '세 장의 선언서',
      short: '차량이 선언서 세 장을 싣습니다. 전부 파일에 또렷이 적혀 있고, 누가 봐도 정상입니다.',
      body: '① "DB 마이그레이션이 기동 시 실행된다" ② "세션을 DB에 저장한다" ③ "프론트 테스트가 PR마다 돈다". 셋 다 설정 파일과 워크플로에 적혀 있고, 코드 리뷰에서도 지적할 게 없다. 그런데 <b>셋 다 실제로는 아무 일도 하지 않는다</b> — 각각 다른 이유로. 이 지도는 그걸 어디서 잡을 수 있었는지에 관한 것이다.'
    },
    {
      id: 'syntax', name: '문법 검사대', x: 18, y: 6, r: 3.8, color: C.ochre,
      tag: '여기서는 다 통과한다',
      short: '빌드가 돌고 문법 오류가 없습니다. 세 장 모두 초록불입니다.',
      body: '컴파일러와 린터가 보는 것은 <b>형식</b>이다. "이 설정 키가 실제로 읽히는가", "이 파일이 실행기 눈에 보이는가"는 문법의 영역이 아니다. 그래서 여기서 초록이라는 사실은 아무것도 증명하지 못한다 — 다만 사람은 초록을 보면 안심한다. 이 정거장의 위험은 <b>통과 자체가 아니라 통과가 주는 안도감</b>이다.'
    },
    {
      id: 'boot', name: '기동장', x: 29, y: 6, r: 4.0, color: C.plum,
      tag: '에러 없이 뜬다',
      short: '서버가 정상 기동합니다. 로그에 빨간 줄이 하나도 없습니다.',
      body: '세 사건 모두 <b>에러를 내지 않는다</b>는 공통점이 있다. 마이그레이션이 안 돌아도 서버는 뜨고, 세션이 메모리에 저장돼도 로그인은 되고, 워크플로가 실행되지 않아도 PR은 그냥 초록이 없을 뿐이다. <b>조용한 실패</b>라서 위험하다 — 시끄러운 실패는 이미 잡혔을 것이다.'
    },
    {
      id: 'probe', name: '부작용 검사대', x: 38, y: 15, r: 4.4, color: C.brick,
      tag: '선언이 아니라 결과를 본다',
      short: '"적었는가"가 아니라 "그래서 무슨 일이 일어났는가"를 묻습니다.',
      variants: {
        trust: {
          short: '검사대가 없습니다. 선언서를 믿고 그대로 통과시킵니다.',
          body: '차단기가 아예 없는 검문소를 차량이 그냥 지난다. 이 장면의 무서운 점은 <b>아무도 게으르지 않았다</b>는 것이다 — 설정은 정확히 적었고, 빌드는 돌렸고, 기동도 확인했다. 다만 "그래서 실제로 마이그레이션이 돌았는가"를 아무도 안 물었을 뿐이다. 경북대 1팀이 이 상태로 2주를 보냈고, 세 번째 사건이 터지고 나서야 패턴을 알아챘다.'
        },
        verify: {
          short: '세 장 모두 거짓으로 판명됐습니다. 검사 방법은 각각 한 줄입니다.',
          body: '검사대가 묻는 것은 선언이 아니라 <b>부작용</b>이다. ① <code>flyway_schema_history</code>에 적용 기록이 있는가 ② 로그인 후 <code>SPRING_SESSION</code>에 행이 생기는가 ③ PR에 체크가 실제로 붙는가. 셋 다 SQL 한 줄이나 화면 한 번으로 확인되는 것들이고, 셋 다 <b>빨갛다</b>. 진열대 세 칸이 전부 붉게 켜지는 것을 보라 — 문법 검사대에서 초록이던 그 세 장이다.'
        }
      },
      body: '선언은 약속이고, 부작용은 증거다.'
    },
    {
      id: 'verdict', name: '반입 판정', x: 21, y: 15, r: 4.2, color: C.sage,
      tag: '운영으로 갈 것인가',
      short: '적발이 0건이면 운영으로, 아니면 반려장으로.',
      variants: {
        trust: {
          short: '운영 반입. 거짓 선언 세 장이 그대로 들어갔습니다.',
          body: '배포는 성공했고 화면도 멀쩡하다. 문제는 <b>나중에, 엉뚱한 곳에서</b> 드러난다 — 서버를 재시작했더니 전원 로그아웃되고, 새 컬럼을 추가했더니 테이블이 없다 하고, 2주치 프론트 변경이 사람 눈으로만 통과했다는 걸 뒤늦게 안다. 이 셋을 잡을 기회는 방금 지나친 검사대 하나였다.'
        },
        verify: {
          short: '반려 3건. 배포는 막혔지만 사고도 막혔습니다.',
          body: '반려는 실패가 아니라 <b>검사대가 일한 기록</b>이다. 수정은 각각 한 줄이었다 — 스타터 의존성 추가, 세션 저장소 설정 방식 변경, 워크플로 파일을 루트로 이동. 어려운 건 고치는 게 아니라 <b>"안 돌고 있다"는 걸 아는 것</b>이었고, 그게 이 지도의 전부다. 비교 장면을 「선언을 믿는다」로 바꿔 같은 세 장이 그대로 통과하는 것을 보라.'
        }
      },
      body: '판정은 선언이 아니라 검사 결과가 정한다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.trust || d.variants.verify);
    var chars = d.short.length + (v ? v.body.length : d.body.length);
    return Math.min(25, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    intake: function (m) { M.load(m); },
    syntax: function (m) { M.build(m); },
    boot: function (m) { M.boot(m); },
    probe: function (m) { M.probe(m); M.ship(m); },
    verdict: function (m) { /* 판정은 검사대에서 끝났다 */ }
  };

  function nextRoute(cur, m) {
    if (cur === 'main') return m.shipped ? 'pass' : 'reject';
    return null;
  }

  function stateBoard(m) {
    return [
      ['실은 선언', m.loaded.length + '장'],
      ['문법 검사', m.syntaxOk + '/' + m.loaded.length + ' 통과'],
      ['기동', m.booted ? '성공 (에러 0)' : '—'],
      ['부작용 검사', m.verify ? (m.probed.length ? m.probed.length + '건 실시' : '대기') : '없음', !m.verify],
      ['거짓 선언 적발', m.caught, m.caught > 0],
      ['실제 작동', M.trulyWorking() + '/3', true]
    ];
  }

  function verdict(m) {
    if (m.shipped && m.probed.length === 0 && m.booted) {
      return '세 장 다 통과했다 — 검사한 것이 "적혀 있는가"뿐이었기 때문이다. 실제로 작동하는 선언은 0개다.';
    }
    if (m.caught === 3) return '세 장 모두 거짓. 검사 방법은 각각 SQL 한 줄·화면 한 번이었다 — 비싸지 않았다.';
    if (m.booted) return '에러 없이 떴다는 것은 설정이 일했다는 증거가 아니다. 조용한 실패가 가장 위험하다.';
    if (m.syntaxOk) return '문법 검사 통과. 여기서 초록인 것은 형식이 맞다는 뜻일 뿐이다.';
    return '선언은 약속이지 증거가 아니다.';
  }

  function vanInfo(m) {
    var chips = m.loaded.map(function (id) {
      var p = m.probed.find(function (x) { return x.id === id; });
      if (!p) return { color: '#c2913c' };               // 검사 전 — 초록도 빨강도 아님
      return { color: p.passed ? '#6d9068' : '#b05470' };
    });
    return {
      text: m.cargo,
      sub: m.verify ? '부작용 검사 켜짐' : '선언만 믿음',
      gauge: null,
      crates: m.loaded.length,
      crateColor: m.caught > 0 ? '#b05470' : '#c2913c',
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'trust') {
      return {
        tag: '반입 ✅ · 실제 작동 0/3 ⚠',
        title: '세 장 다 거짓인데 배포가 성공했다',
        short: '아무도 게으르지 않았다. 설정은 정확히 적었고 빌드도 기동도 확인했다 — 다만 "그래서 실제로 무슨 일이 일어났는가"를 아무도 안 물었다.',
        body: '경북대 1팀이 이 상태로 2주를 보냈고, 같은 유형이 세 번째 터지고서야 패턴을 알아챘다. 비교 장면을 바꿔 검사대 하나가 무엇을 잡는지 보라.'
      };
    }
    return {
      tag: '반려 3건 · 사고 0건',
      title: '반려는 검사대가 일한 기록이다',
      short: '세 장 모두 적발됐다. 검사 방법은 SQL 한 줄, 화면 한 번 — 비싸지 않았다. 어려운 건 고치는 게 아니라 "안 돌고 있다"는 걸 아는 것이었다.',
      body: '이 검사를 사람의 기억이 아니라 CI 한 스텝으로 옮기면 다음 사람도 자동으로 걸린다. "설정을 만졌으면 부작용을 눈으로 본다"가 절차가 되는 순간이다.'
    };
  }

  function hudCargo(m) { return m.cargo; }

  /* ---- 건물 ---- */

  var buildings = [];
  var props = [];
  function put(o) { buildings.push(o); return o; }
  function block(x, y, o) {
    put({
      x: x, y: y, z: 0, w: o.w, d: o.d, h: o.h, color: o.color,
      roof: o.roof, roofH: o.roofH,
      windows: { cols: o.cols || 3, seed: Math.round(x * 7 + y * 13), color: o.lit }
    });
  }

  function build() {
    if (buildings.length) return;

    /* 선언 접수소: 선언서 더미 */
    put({ kind: 'containers', x: 4.6, y: 1.8, color: C.steel });
    put({ kind: 'kiosk', x: 7.6, y: 10.4, color: C.steel, bubble: '3',
      active: function (m, s) { return s.station === 'intake'; } });

    /* 문법 검사대: 갠트리 — 늘 통과시킨다 */
    put({ kind: 'gatePost', x: 18, y: 4.3, color: C.ochre });
    put({ kind: 'gateBeam', x: 18, y: 6.0, color: C.ochre });
    put({ kind: 'gatePost', x: 18, y: 7.7, color: C.ochre });
    block(16.4, 1.6, { w: 3.0, d: 2.2, h: 2.2, color: '#ddc79a', cols: 3, lit: C.ochre });

    /* 기동장: 굴뚝 — 기동 중 연기 */
    put({ kind: 'stack', x: 32.4, y: 2.2, color: C.plum,
      active: function (m, s) { return s.station === 'boot'; } });
    block(27.0, 1.8, { w: 3.2, d: 2.4, h: 2.8, color: '#cbb6d3', cols: 3, lit: C.plum, rooftop: C.plum });

    /* 부작용 검사대: 차단기(verify에서만 팔이 있다) + 세 칸 진열대 */
    put({ kind: 'toll', x: 38, y: 15, color: C.brick, which: 'probe', axis: 'y',
      on: function (m) { return m.verify; } });
    put({ kind: 'bench', x: 42.4, y: 15.2, color: C.brick,
      slots: function (m) {
        return ['flyway', 'session', 'ci'].map(function (id) {
          var p = m.probed.find(function (x) { return x.id === id; });
          if (!p) return { color: '#d9d3c6' };
          return { color: p.passed ? '#6d9068' : '#b05470' };
        });
      },
      text: function (m) { return m.probed.length ? '적발 ' + m.caught + '/3' : '미검사'; } });

    /* 반려장: 통 */
    put({ kind: 'bin', x: 21, y: 11.4, color: C.brick,
      fill: function (m) { return m.caught / 3; },
      fillColor: '#d8cfbe',
      text: function (m) { return m.caught ? '반려 ' + m.caught : '반려장'; } });

    /* 운영 반입: 컨테이너 + 작동 수 기둥 */
    put({ kind: 'containers', x: 9.4, y: 28.2, color: C.sage });
    put({ kind: 'column', x: 16.6, y: 28.4, color: C.sage,
      fill: function (m) { return m.shipped ? M.trulyWorking() / 3 : 0; },
      text: function (m) { return m.shipped ? '작동 ' + M.trulyWorking() + '/3' : null; },
      sub: '운영에서' });

    var spots = [[12, 11], [24, 11], [33, 11], [12, 2], [23, 21], [33, 21], [6, 21], [44, 6], [44, 25], [30, 29], [5, 13], [42, 30]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = [MAIN, PASS, REJECT].some(function (r) {
        return r.segs.some(function (g) {
          var vx = g.b.x - g.a.x, vy = g.b.y - g.a.y;
          var t = Math.max(0, Math.min(1, ((sp[0] - g.a.x) * vx + (sp[1] - g.a.y) * vy) / (vx * vx + vy * vy)));
          return Math.hypot(sp[0] - (g.a.x + vx * t), sp[1] - (g.a.y + vy * t)) < 2.6;
        });
      });
      if (near) return;
      if (n < 0.4) {
        block(sp[0], sp[1], { w: 1.8 + n, d: 1.6 + n, h: 1.4 + n * 1.4, color: '#cfc7b6', cols: 2, lit: '#8b9aa4', roof: '#b09a86', roofH: 0.5 });
      } else {
        props.push({ kind: n < 0.75 ? 'tree' : 'lamp', x: sp[0], y: sp[1], seed: i });
      }
    });
  }

  global.World = {
    GW: 48, GH: 34,
    routes: { main: MAIN, pass: PASS, reject: REJECT },
    routeStyles: { reject: { width: 2.0, surface: '#ddd2c4', dash: 'rgba(168,90,68,0.5)' } },
    stations: STATIONS,
    districts: DISTRICTS,
    districtById: DISTRICT_BY_ID,
    stationToDistrict: STATION_TO_DISTRICT,
    readSeconds: readSeconds,
    buildings: buildings,
    props: props,
    palette: C,
    build: build,

    meta: {
      title: '선언 검사소',
      subtitle: '적어둔 것과 도는 것은 다르다 — 조용한 실패 세 장',
      origin: 'https://github.com/kakaotechcampus-4/ktc4-kyungpook-1/pull/19',
      limit: '세 선언은 경북대 1팀이 2~3주차에 실제로 겪은 사건이다(Flyway 스타터 누락 · 세션 설정 키 소멸 · 워크플로 파일 위치). 검사 방법은 단순화했고, 실제로는 각 프레임워크·도구마다 확인 지점이 다르다.',
      sources: [
        ['Google SRE Workbook — Configuration Design', 'https://sre.google/workbook/configuration-design/'],
        ['GitHub Actions — 워크플로 파일 위치', 'https://docs.github.com/en/actions/using-workflows/about-workflows'],
        ['Spring Boot — Flyway 자동설정', 'https://docs.spring.io/spring-boot/reference/howto/data-initialization.html']
      ]
    },
    scenarios: [
      { id: 'trust', label: '사고 장면 — 선언을 믿는다' },
      { id: 'verify', label: '안전 장면 — 부작용을 확인한다' }
    ],
    startRoute: 'main',
    newModel: M.newModel,
    OPS: OPS,
    nextRoute: nextRoute,
    stateBoard: stateBoard,
    verdict: verdict,
    vanInfo: vanInfo,
    doneCard: doneCard,
    hudCargo: hudCargo
  };
})(window);
