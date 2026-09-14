/* polling.world.js: 비동기 작업장 — 화면은 꺼져도 작업은 계속된다.
 *
 * 차량은 브라우저(화면)의 심부름꾼이다. 서버 작업장의 기둥(진행률)은 차량이
 * 어디 있든 계속 차오른다 — 새로고침 광장에서 차량의 jobId 칩이 사라져도
 * 기둥은 멈추지 않는 것, 그것이 이 지도의 전부다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.PollModel;
  var makeRoute = Iso.makeRoute;

  var MAIN = makeRoute([
    [2, 18],       // 출발 도입부
    [2, 8],
    [7, 8],        // 2 브라우저 책상
    [16, 8],       // 3 API 접수처
    [26, 8],       // 4 서버 작업장 (첫 관측)
    [34, 8],       // corner
    [34, 15],      // 6 새로고침 광장
    [34, 22],      // corner
    [25, 22],      // 8 복구 창구
    [16, 22],      // 9 결과 화면
    [9, 22]        // 종점
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'browser', 1.4),
      station(MAIN, 3, 'accept', 1.8),
      station(MAIN, 4, 'server', 1.8),
      station(MAIN, 6, 'refresh', 2.0),
      station(MAIN, 8, 'recover', 1.8),
      station(MAIN, 9, 'screen', 1.8)
    ]
  };

  var STATION_TO_DISTRICT = {
    browser: 'browser', accept: 'accept', server: 'server',
    refresh: 'refresh', recover: 'recover', screen: 'screen'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'browser', name: '브라우저 책상', x: 7, y: 8, r: 3.6, color: C.steel,
      tag: '분석 시작',
      short: '레포 분석은 수십 초~수 분짜리 작업입니다. 응답을 기다리며 화면을 잡아둘 수 없습니다.',
      body: '동기 요청으로 처리하면 사용자는 빈 화면 앞에서 몇 분을 기다리고, 게이트웨이 타임아웃이 먼저 온다. 그래서 서버에 "해줘"라고 접수만 하고, 화면은 번호표를 들고 상태를 물으러 다니는 구조가 된다. 차량이 그 번호표 심부름꾼이다.'
    },
    {
      id: 'accept', name: 'API 접수처', x: 16, y: 8, r: 3.8, color: C.violet,
      tag: '202 — 접수이지 완료가 아니다',
      short: '202 Accepted와 jobId=42를 받습니다. 분석이 성공했다는 뜻이 전혀 아닙니다.',
      body: '202의 정확한 의미는 "받아뒀다"다. 성공도 실패도 아직 없다. 차량 옆에 42번 칩이 붙는 것을 보라 — 지금부터 화면이 아는 것은 이 번호 하나뿐이고, 진행 상황은 이 번호로 물어봐야만 안다. 이 접수 응답을 완료로 취급하는 화면이 흔한 첫 실수다.'
    },
    {
      id: 'server', name: '서버 작업장', x: 26, y: 8, r: 4.0, color: C.orange,
      tag: '독립적으로 도는 세계',
      short: '작업 보관소의 상태가 RUNNING으로 바뀌고 기둥이 차오르기 시작합니다.',
      body: '이 기둥은 차량(화면)과 아무 상관 없이 차오른다 — 그게 요점이다. 서버의 작업 상태는 서버의 것이고, 화면이 보는 것은 마지막으로 조회한 순간의 스냅샷일 뿐이다. 지도 어디에 있든 기둥을 계속 지켜보라. 잠시 뒤 화면 쪽에 무슨 일이 생겨도 이 기둥은 멈추지 않는다.'
    },
    {
      id: 'refresh', name: '새로고침 광장', x: 34, y: 15, r: 4.2, color: C.brick,
      tag: 'F5 — 무엇이 지워지는가',
      short: '사용자가 새로고침했습니다. 차량의 42번 칩(JS 메모리)이 사라집니다. 서버 기둥은 그대로입니다.',
      body: '새로고침이 지우는 것은 브라우저의 자바스크립트 메모리뿐이다. 서버의 job 42도, 진행률도 멀쩡하다. 즉 지금 상태는 "작업은 잘 되고 있는데 화면이 그 사실을 모르는" 상태다. 서버 완료와 화면 복구는 서로 다른 문제라는 것 — 이 광장이 그 분리를 만드는 곳이다.'
    },
    {
      id: 'recover', name: '복구 창구', x: 25, y: 22, r: 4.0, color: C.teal,
      tag: '번호표를 되찾는 길',
      variants: {
        memoryOnly: { short: '복원 경로가 없습니다. 어떤 작업이 내 것이었는지 화면은 모릅니다.', body: 'jobId를 JS 메모리에만 뒀으므로 되찾을 방법이 없다. 서버가 완료해도 화면은 조회할 번호가 없어 영영 못 보여준다. 해법은 두 가지 — 번호를 URL이나 스토리지에 남기거나, 서버에 "내 최근 작업 목록" API를 두거나. 어느 쪽이든 새로고침 전에 설계돼 있어야 한다.' },
        recover: { short: '인증된 「내 작업 목록」에서 42를 찾았습니다. 다시 조회할 수 있습니다.', body: '복원은 실행 재개가 아니라 재조회다 — 작업은 원래 서버에서 계속 돌고 있었고, 화면이 그 사실을 다시 알게 됐을 뿐이다. ID를 URL에 두는 방법과 서버 목록 조회, 두 경로 다 유효하다. 목록 조회에는 소유권 확인이 붙어야 한다는 것(남의 작업이 보이면 안 된다)도 잊지 말 것.' }
      },
      short: '사라진 jobId를 되찾을 수 있는가.',
      body: 'ID 보관은 실행 보장이 아니라 재조회의 열쇠다.'
    },
    {
      id: 'screen', name: '결과 화면', x: 16, y: 22, r: 4.0, color: C.sage,
      tag: '폴링의 종착지',
      variants: {
        memoryOnly: { short: '서버는 SUCCEEDED, 화면은 결과 미표시 — 두 상태가 영영 어긋났습니다.', body: '작업은 성공했다. 낭비된 것은 서버가 아니라 사용자의 신뢰다 — "분석이 사라졌다"고 느낀다. 이 어긋남은 서버 로그로는 안 보이고 화면에서만 보인다는 점이 고약하다. 비교 장면을 「복원 가능」으로 바꿔 같은 새로고침을 다시 겪어 보라.' },
        recover: { short: 'GET /jobs/42 → SUCCEEDED. 완료 결과를 표시하고 폴링을 멈춥니다.', body: '복구된 번호로 조회하니 서버는 이미 완료 상태였다. 화면은 그 스냅샷을 표시하고 반복 조회를 멈춘다. 실전에서는 여기에 완료·실패 시 폴링 중단, 지수 백오프, 타이머 정리 같은 마무리 규칙이 붙는다 — 이 지도의 범위 밖이지만 잊으면 안 되는 목록이다.' }
      },
      short: '화면이 서버의 진실을 따라잡는 곳.',
      body: '폴링은 서버 상태의 스냅샷을 가져올 뿐이다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.memoryOnly || d.variants.recover);
    var chars = (d.short.length + (v ? v.body.length : d.body.length));
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    browser: function (m) { /* 시작 */ },
    accept: function (m) { M.accept(m); },
    server: function (m) { M.work(m, 25); },
    refresh: function (m) { M.work(m, 25); M.refresh(m); },
    recover: function (m) { M.work(m, 50); M.recover(m); },
    screen: function (m) { M.poll(m); }
  };

  function nextRoute() { return null; }

  function stateBoard(m) {
    return [
      ['서버 작업', m.server + (m.job ? ' · ' + m.progress + '%' : '')],
      ['서버의 job', m.job ? '#' + m.job : '없음'],
      ['메모리 jobId', m.memory != null ? m.memory : '없음', m.reloaded && m.memory == null],
      ['화면', m.screen, m.screen === '결과 미표시'],
      ['복원 경로', m.restore ? '내 작업 목록' : '없음', !m.restore]
    ];
  }

  function verdict(m) {
    if (m.screen === '결과 미표시') return '서버는 완료했는데 화면은 모른다 — 어긋난 것은 작업이 아니라 관측이다.';
    if (m.screen === '완료') return '복원 → 재조회 → 표시. 작업은 한 번도 멈춘 적이 없었다.';
    if (m.reloaded && m.memory == null) return '새로고침은 JS 메모리만 지웠다. 서버 기둥이 계속 차오르는 것을 보라.';
    if (m.job) return '202는 접수다. 서버 상태는 조회한 순간의 스냅샷으로만 알 수 있다.';
    return '긴 작업은 접수와 완료를 분리해야 한다.';
  }

  function vanInfo(m) {
    var chips = [];
    if (m.memory != null) chips.push({ color: '#6f63a8' });   // jobId 칩
    return {
      text: m.cargo,
      sub: m.memory != null ? 'jobId ' + m.memory + ' 보유' : 'jobId 없음',
      gauge: null,
      crates: m.screen === '완료' ? 1 : 0,
      crateColor: '#6d9068',
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'memoryOnly') {
      return {
        tag: '서버 SUCCEEDED · 화면 미표시 ⚠',
        title: '작업은 성공했고, 화면만 그걸 모른다',
        short: '새로고침이 지운 것은 jobId를 든 JS 메모리 하나였다. 복원 경로가 없으면 서버의 성공은 사용자에게 존재하지 않는 성공이 된다.',
        body: '비교 장면을 「복원 가능」으로 바꾸면 같은 새로고침 뒤에 내 작업 목록에서 42를 되찾아 완료를 표시하는 것을 볼 수 있다.'
      };
    }
    return {
      tag: '서버 SUCCEEDED · 화면 완료',
      title: '새로고침에도 살아남았다',
      short: '살아남은 비결은 대단한 게 아니다 — 번호를 되찾을 경로(내 작업 목록 또는 URL의 jobId)를 새로고침 전에 설계해 둔 것뿐이다.',
      body: 'ID 보관은 실행 보장이 아니라 재조회의 열쇠라는 것, 그리고 202는 접수일 뿐이라는 것 — 이 지도가 가르치는 두 문장이다.'
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

    /* 브라우저 책상 */
    block(6.2, 3.6, { w: 3.0, d: 2.4, h: 2.2, color: '#c3d0d9', cols: 3, lit: C.steel, roof: '#9aa8b2', roofH: 0.6 });

    /* API 접수처 */
    put({ kind: 'kiosk', x: 16, y: 3.6, color: C.violet, bubble: '202',
      active: function (m, s) { return s.station === 'accept'; } });

    /* 서버 작업장: 진행률 기둥 — 차량과 무관하게 차오른다 */
    put({
      x: 24.6, y: 2.2, z: 0, w: 4.0, d: 2.8, h: 3.0, color: '#d9b491',
      panels: { cols: 4, seed: 5, color: '#eed7bd' }, rooftop: C.orange
    });
    put({ kind: 'column', x: 29.8, y: 3.4, color: C.orange,
      fill: function (m) { return m.progress / 100; },
      text: function (m) { return m.job ? '서버 ' + m.progress + '%' : null; },
      sub: function () { return null; } });

    /* 새로고침 광장 */
    put({ kind: 'press', x: 38.4, y: 14.4, color: C.brick,
      active: function (m, s) { return s.station === 'refresh'; } });

    /* 복구 창구: 내 작업 목록 서랍(드럼) */
    put({ kind: 'drums', x: 25.4, y: 26.6, color: C.teal,
      count: function (m) { return m.job ? 3 : 0; },
      text: function (m) { return m.restore ? '내 작업 목록' : '목록 없음'; } });

    /* 결과 화면 */
    put({ kind: 'kiosk', x: 15.4, y: 26.4, color: C.sage,
      bubble: '✓',
      active: function (m, s) { return s.station === 'screen' || (s.finished && m.screen === '완료'); } });

    var spots = [[12, 3], [21, 3], [12, 14], [20, 14], [28, 14], [40, 8], [40, 20], [8, 26], [30, 26], [5, 13], [26, 17], [39, 26]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = MAIN.segs.some(function (g) {
        var vx = g.b.x - g.a.x, vy = g.b.y - g.a.y;
        var t = Math.max(0, Math.min(1, ((sp[0] - g.a.x) * vx + (sp[1] - g.a.y) * vy) / (vx * vx + vy * vy)));
        return Math.hypot(sp[0] - (g.a.x + vx * t), sp[1] - (g.a.y + vy * t)) < 2.6;
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
    GW: 44, GH: 30,
    routes: { main: MAIN },
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
      title: '비동기 작업장',
      subtitle: '화면은 꺼져도 작업은 계속된다 — 202 · jobId · 폴링 · 복구',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kyungpook-1-pr-4.md&line=325#polling',
      limit: '서버는 새로고침과 무관하게 작업을 지속하는 구현이라고 가정한다. 폴링 중단 조건·백오프·타이머 정리·소유권 확인·서버 재시작 복구는 실제 구현에서 추가해야 하는 별도 목록이다.',
      sources: [
        ['MDN · 202 Accepted', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/202'],
        ['카카오 · Mocking과 API', 'https://tech.kakao.com/posts/458']
      ]
    },
    scenarios: [
      { id: 'memoryOnly', label: '사고 장면 — jobId를 메모리에만' },
      { id: 'recover', label: '안전 장면 — 내 작업 목록으로 복원' }
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
