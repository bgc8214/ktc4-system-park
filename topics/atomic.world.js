/* atomic.world.js: 동시성 항구 — GET+DEL 사이에 다른 요청이 끼어드는 곳.
 *
 * 차량은 요청 A다. 요청 B는 창고 옆에 정박해 있다가 A가 읽고 삭제하기 전의
 * 그 틈에 같이 읽는다 — 진열대의 두 칸(A·B의 복사본)이 그 틈의 기록이다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.AtomicModel;
  var makeRoute = Iso.makeRoute;

  var MAIN = makeRoute([
    [2, 18],       // 출발 도입부
    [2, 8],
    [7, 8],        // 2 항구 접수
    [17, 8],       // 3 토큰 창고
    [27, 8],       // 4 검증 센터
    [34, 8],       // corner
    [34, 16],      // 6 재발급 공장
    [34, 24],      // corner
    [24, 24],      // 8 결과 부두
    [14, 24]       // 종점
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'arrive', 1.4),
      station(MAIN, 3, 'store', 2.2),
      station(MAIN, 4, 'verify', 1.6),
      station(MAIN, 6, 'factory', 1.8),
      station(MAIN, 8, 'dock', 1.6)
    ]
  };

  var STATION_TO_DISTRICT = {
    arrive: 'arrive', store: 'store', verify: 'verify', factory: 'factory', dock: 'dock'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'arrive', name: '항구 접수', x: 7, y: 8, r: 3.8, color: C.steel,
      tag: '같은 토큰, 두 요청',
      short: '차량은 요청 A입니다. 같은 Refresh Token을 든 요청 B가 창고 옆에 이미 와 있습니다.',
      body: '앱을 두 탭에서 열었거나, 타임아웃 재시도가 겹쳤거나 — 같은 기존 토큰을 든 요청이 동시에 도착하는 일은 흔하다. 이 지도의 질문은 하나다: 하나뿐인 기존 토큰을 몇 개의 요청이 소비하게 되는가. 답은 코드가 아니라 명령 사이의 틈이 정한다.'
    },
    {
      id: 'store', name: '토큰 창고 (Redis)', x: 17, y: 8, r: 4.2, color: C.ochre,
      tag: '틈이 생기는 곳',
      variants: {
        split: {
          short: 'A가 GET으로 읽습니다. 원본은 아직 남아 있고 — 그 틈에 B도 GET합니다.',
          body: 'GET도 DEL도 각각은 원자적이다. 문제는 그 사이다. A가 읽고 아직 지우지 않은 짧은 틈에 B의 GET이 끼어들면, 둘 다 같은 값의 복사본을 들게 된다. 진열대의 두 칸이 모두 켜진 것을 보라. 드럼통(원본)은 아직 그대로다 — 삭제는 나중이고, 복사본은 이미 나갔다.'
        },
        atomic: {
          short: 'A의 GETDEL이 값을 반환하며 그 자리에서 지웁니다. B의 GETDEL은 빈손입니다.',
          body: 'GETDEL은 "읽기+삭제"가 한 명령이라 그 사이에 끼어들 틈 자체가 없다. A가 값을 받는 순간 드럼통이 비고, 곧이어 도착한 B는 null을 받는다. 진열대에서 A 칸만 켜진 것을 보라. Redis 6.2부터 제공되는 문자열 명령이다.'
        }
      },
      short: '기존 토큰의 원본이 사는 곳.',
      body: '읽기와 삭제 사이의 틈이 이 주제의 전부다.'
    },
    {
      id: 'verify', name: '검증 센터', x: 27, y: 8, r: 3.8, color: C.plum,
      tag: '복사본을 든 자만 통과',
      variants: {
        split: { short: 'A도 B도 복사본이 있으므로 둘 다 통과합니다.', body: '검증은 제출된 값이 맞는지만 본다. 같은 값의 복사본이 둘이면 둘 다 "맞다". 여기서 걸러지지 않는다는 것이 핵심이다 — 검증은 위조를 잡지, 중복을 잡지 못한다. 중복은 창고에서, 소비를 원자적으로 만들어야만 잡힌다.' },
        atomic: { short: 'A만 통과합니다. B는 빈손이라 여기서 거절됩니다.', body: '먼저 소비한 요청만 값이 있다. B의 거절은 오류가 아니라 정확히 의도된 결과다 — 기존 토큰은 한 번만 쓰여야 하기 때문이다.' }
      },
      short: '제출된 토큰이 유효한지 확인한다.',
      body: '검증은 중복을 잡지 못한다.'
    },
    {
      id: 'factory', name: '재발급 공장', x: 34, y: 16, r: 4.2, color: C.brick,
      tag: '복사본 수 = 발급 수',
      variants: {
        split: { short: '늦은 DEL이 실행되지만, 이미 읽힌 복사본 두 개가 각각 새 토큰이 됩니다.', body: '나중에 DEL을 해도 소용없다 — 삭제는 창고의 원본을 지울 뿐, 이미 나간 복사본을 회수하지 못한다. 같은 기존 토큰으로 새 토큰 2개가 발급됐다. 이 중 하나가 공격자의 손에 있다면, 정상 사용자와 공격자가 나란히 유효한 세션을 갖게 되는 것이다.' },
        atomic: { short: 'A의 복사본 하나만 새 토큰이 됩니다. 발급 1건.', body: '단일 소비가 보장되면 발급도 하나다. 단, GETDEL이 재발급 전체를 안전하게 만드는 것은 아니다 — 새 토큰을 저장하기 전에 서버가 죽으면? 응답이 유실되면? 그런 실패 처리는 별도 설계가 필요하다. 이 명령이 막는 것은 정확히 "같은 기존 토큰의 중복 소비" 하나다.' }
      },
      short: '복사본을 가진 요청마다 새 토큰이 나온다.',
      body: '발급 수는 복사본 수를 그대로 따른다.'
    },
    {
      id: 'dock', name: '결과 부두', x: 24, y: 24, r: 4.0, color: C.sage,
      tag: '몇 개가 발급됐는가',
      variants: {
        split: { short: '중복 발급 2건. 항상 터지는 게 아니라, 이 순서로 겹치면 터지는 경쟁입니다.', body: '이 결과의 무서운 점은 재현이 어렵다는 것이다 — A읽기→A삭제→B읽기 순서면 분리 명령이어도 멀쩡하다. 테스트에서 안 잡히고 트래픽이 몰리는 날 잡힌다. 그래서 "운 좋은 순서"에 기대지 않고 명령 자체를 원자적으로 만드는 것이다.' },
        atomic: { short: '발급 1건, 거절 1건. 같은 도착 순서에서 결과가 갈렸습니다.', body: '바뀐 것은 명령 하나다: GET+DEL → GETDEL. 두 요청의 도착 순서는 같았다. 비교 장면을 「분리」로 되돌려 같은 길을 달려 보면, 틈이 어디서 생기는지 창고 진열대에서 보인다.' }
      },
      short: '발급 수가 이 지도의 최종 성적표다.',
      body: '기존 토큰 1개 → 새 토큰은 1개여야 한다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.split || d.variants.atomic);
    var chars = (d.short.length + (v ? v.body.length : d.body.length));
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    arrive: function (m) { /* 도착 */ },
    store: function (m) { M.readBoth(m); },
    verify: function (m) { M.verify(m); },
    factory: function (m) { M.reissue(m); },
    dock: function (m) { M.settle(m); }
  };

  function nextRoute() { return null; }   // 외길 — 결과가 길이 아니라 개수로 갈린다

  function stateBoard(m) {
    return [
      ['Redis 원본', m.token ? '1' : '0'],
      ['A의 복사본', m.A.copy ? '있음' : (m.A.rejected ? '거절' : '—')],
      ['B의 복사본', m.B.copy ? '있음' : (m.B.rejected ? '거절' : '—'), m.B.copy && !m.atomic],
      ['명령', m.atomic ? 'GETDEL' : 'GET → DEL'],
      ['새 토큰 발급', m.issued, m.issued > 1]
    ];
  }

  function verdict(m) {
    if (m.issued > 1) return '같은 기존 토큰이 두 번 소비됐다. 각 명령이 원자적이어도 명령 "사이"는 원자적이지 않다.';
    if (m.issued === 1) return '단일 소비 확인. 단, GETDEL은 중복 소비 하나를 막을 뿐 — 소비 후 장애·응답 유실 처리는 별도 설계다.';
    if (m.A.copy && m.B.copy) return 'A와 B가 같은 값의 복사본을 들고 있다 — 삭제가 아직이라 원본도 남아 있다.';
    if (m.A.copy) return 'A만 값을 얻었다. B가 도착해도 창고는 이미 비어 있다.';
    return '하나뿐인 기존 토큰을 두 요청이 노리고 있다.';
  }

  function vanInfo(m) {
    var chips = [];
    if (m.A.copy) chips.push({ color: '#c2913c' });
    if (m.A.issued) chips.push({ color: '#6d9068' });
    return {
      text: m.cargo,
      sub: '요청 A (B는 창고 옆 대기)',
      gauge: null,
      crates: m.issued,
      crateColor: m.issued > 1 ? '#b05470' : '#6d9068',
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'split') {
      return {
        tag: '발급 ' + m.issued + '건 ⚠',
        title: '같은 토큰이 두 번 살았다',
        short: 'GET과 DEL 사이의 틈에 B가 끼어들어, 기존 토큰 하나로 새 토큰 2개가 발급됐다. 각 명령의 원자성은 죄가 없다 — 죄는 두 명령 사이에 있다.',
        body: '비교 장면을 「GETDEL」로 바꾸면 같은 도착 순서에서 B가 빈손이 되는 것을 볼 수 있다.'
      };
    }
    return {
      tag: '발급 1건 · 거절 1건',
      title: '틈 자체를 없앴다',
      short: 'GETDEL은 읽기와 삭제가 한 명령이라 끼어들 자리가 없다. B의 거절은 고장이 아니라 이 설계의 목적이다.',
      body: '단, 이 명령이 재발급 전체를 안전하게 만드는 것은 아니다 — 소비 후 서버 장애, 응답 유실, 새 토큰 저장은 별도로 설계해야 한다.'
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

    /* 항구 접수: 크레인 + B의 대기 카트(정박) */
    put({ kind: 'crane', x: 6.4, y: 3.4, color: C.steel,
      active: function (m, s) { return s.station === 'arrive'; } });

    /* 토큰 창고: 드럼통 = 원본 개수(1→0), 진열대 = A·B의 복사본 */
    put({ kind: 'drums', x: 16.4, y: 3.4, color: C.ochre,
      count: function (m) { return m.token ? 1 : 0; },
      text: function (m) { return '원본 ' + (m.token ? 1 : 0); } });
    put({ kind: 'bench', x: 17.6, y: 12.4, color: C.ochre,
      slots: function (m) {
        return [
          { color: m.A.copy ? '#c2913c' : '#d9d3c6' },
          { color: m.B.copy ? '#b05470' : '#d9d3c6' }
        ];
      },
      text: function (m) {
        var n = (m.A.copy ? 1 : 0) + (m.B.copy ? 1 : 0);
        return n ? '복사본 ' + n : 'A칸 · B칸';
      } });
    /* B의 정박 카트 표시 */
    block(21.0, 12.2, { w: 1.6, d: 1.1, h: 0.9, color: '#c9a0aa', cols: 1, lit: C.rose });

    /* 검증 센터: 도로 위 갠트리 */
    put({ kind: 'gatePost', x: 27, y: 6.3, color: C.plum });
    put({ kind: 'gateBeam', x: 27, y: 8.0, color: C.plum });
    put({ kind: 'gatePost', x: 27, y: 9.7, color: C.plum });
    block(26.2, 3.2, { w: 2.8, d: 2.2, h: 2.4, color: '#cbb6d3', cols: 3, lit: C.plum });

    /* 재발급 공장: 프레스 + 발급 진열대 */
    put({ kind: 'press', x: 38.4, y: 15.2, color: C.brick,
      active: function (m, s) { return s.station === 'factory'; } });
    put({ kind: 'bench', x: 38.6, y: 19.6, color: C.brick,
      slots: function (m) {
        return [
          { color: m.A.issued ? '#6d9068' : '#d9d3c6' },
          { color: m.B.issued ? '#b05470' : (m.B.rejected ? '#8d8578' : '#d9d3c6') }
        ];
      },
      text: function (m) { return '발급 ' + m.issued; } });

    /* 결과 부두 */
    block(23.0, 27.8, { w: 3.2, d: 2.4, h: 2.2, color: '#b9cdb4', cols: 3, lit: C.sage, roof: '#93a88e', roofH: 0.6 });
    put({ kind: 'containers', x: 15.4, y: 27.4, color: C.sage });

    var spots = [[12, 3], [22, 3], [31, 3], [39, 6], [40, 26], [8, 14], [13, 14], [22, 17], [28, 18], [6, 26], [29, 28], [12, 20]];
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
    GW: 44, GH: 32,
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
      title: '동시성 항구',
      subtitle: '하나의 토큰, 두 요청 — GET+DEL의 틈과 GETDEL',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kangwon-3-pr-59.md&line=302#atomic',
      limit: '두 요청 모두 같은 기존 토큰을 제출했고 검증 조건은 충족됐다고 가정한다. 보여주는 교차 순서(A읽기→B읽기)는 발생 가능한 최악의 순서이지 항상 일어나는 것이 아니다. 소비 후 장애·응답 유실·새 토큰 저장은 범위 밖이다.',
      sources: [
        ['Redis · GETDEL', 'https://redis.io/docs/latest/commands/getdel/'],
        ['우아한형제들 · 재고와 동시성', 'https://techblog.woowahan.com/2709/']
      ]
    },
    scenarios: [
      { id: 'split', label: '사고 장면 — GET + DEL 분리' },
      { id: 'atomic', label: '안전 장면 — GETDEL 한 명령' }
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
