/* ports.world.js: 어댑터 공방 — 같은 약속을 구현하는 두 장치.
 *
 * 차량은 업무의 read(repo) 호출이다. 포트 게이트에서 길이 갈라지고,
 * 한 바퀴째는 GitHub 장치, 두 바퀴째는 테스트 장치를 지난다 — 두 길 다
 * 같은 변환소를 거쳐 같은 모양(Commit[])으로 업무에 돌아온다.
 * 길이 두 갈래인데 돌아오는 모양이 하나라는 것, 그것이 포트다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.PortsModel;
  var makeRoute = Iso.makeRoute;

  /* 업무 → 포트 게이트 */
  var OUT = makeRoute([
    [2, 16],       // 출발 도입부 (2바퀴째에는 업무 사옥에서 재출발)
    [2, 8],
    [7, 8],        // 2 카드 업무
    [15, 8]        // 3 포트 게이트
  ]);

  /* 포트 → GitHub 어댑터 → 변환소 */
  var GH = makeRoute([
    [15, 8],
    [24, 8],       // corner
    [24, 3],       // 2 GitHub 어댑터 (북쪽 길)
    [32, 3],
    [32, 14]       // 4 형식 변환소
  ]);

  /* 포트 → 테스트 어댑터 → 변환소 */
  var FAKE = makeRoute([
    [15, 8],
    [15, 14],      // corner
    [15, 19],      // 2 테스트 어댑터 (남쪽 길)
    [24, 19],
    [32, 19],
    [32, 14]       // 5 형식 변환소
  ]);

  /* 변환소 → 업무 복귀 */
  var BACK = makeRoute([
    [32, 14],
    [36, 14],
    [36, 25],      // corner
    [20, 25],
    [7, 25],
    [7, 12],       // 5 결과 선반 (업무 앞마당)
    [7, 8]         // 업무 복귀 → 다음 호출
  ]);

  /* 2바퀴째: 업무 사옥에서 곧장 게이트로 (도입부 없이) */
  var OUT2 = makeRoute([
    [7, 8],
    [15, 8]        // 1 포트 게이트
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    out: [
      station(OUT, 2, 'biz', 1.4),
      station(OUT, 3, 'port', 1.8)
    ],
    out2: [
      station(OUT2, 1, 'port', 1.2)
    ],
    gh: [
      station(GH, 2, 'github', 1.8),
      station(GH, 4, 'convert', 1.6)
    ],
    fake: [
      station(FAKE, 2, 'fake', 1.8),
      station(FAKE, 5, 'convert', 1.6)
    ],
    back: [
      station(BACK, 5, 'result', 1.6)
    ]
  };

  var STATION_TO_DISTRICT = {
    biz: 'biz', port: 'port', github: 'github', fake: 'fake',
    convert: 'convert', result: 'result'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'biz', name: '카드 업무', x: 7, y: 8, r: 3.6, color: C.steel,
      tag: 'SDK를 모르는 코드',
      short: '업무 서비스가 커밋 목록이 필요합니다. GitHub SDK는 이 건물에 없습니다.',
      body: '업무 코드가 아는 것은 CommitReader라는 내부 약속 하나다: read(repo)를 부르면 Commit[]이 온다. 그 뒤에서 누가 어떻게 구해오는지는 이 건물의 관심사가 아니다. 그래서 뒤의 구현이 통째로 바뀌어도 이 건물의 코드는 한 줄도 바뀌지 않는다 — 오늘 두 바퀴를 돌며 그걸 직접 확인한다.'
    },
    {
      id: 'port', name: '포트 게이트', x: 15, y: 8, r: 3.8, color: C.violet,
      tag: 'CommitReader — 약속',
      short: 'read(repo): Commit[] — 이 게이트의 간판이 곧 인터페이스입니다.',
      body: '주의할 것 하나. 차량의 길은 "런타임 호출 순서"이고, 소스 코드의 의존 방향은 그 반대다 — GitHubAdapter가 내부 포트를 import하지, 업무가 어댑터를 import하지 않는다. 안쪽(업무·포트)이 바깥(기술)을 모르는 이 방향이 포트의 본질이고, 게이트 너머 길이 몇 갈래든 게이트의 간판은 하나다.'
    },
    {
      id: 'github', name: 'GitHub 어댑터', x: 24, y: 3, r: 3.8, color: C.orange,
      tag: '진짜 장치 — 네트워크 발생',
      short: '외부 HTTP가 일어나는 유일한 곳입니다. 굴뚝에서 연기가 나는 이유입니다.',
      body: '페이지네이션, rate limit, 재시도, 인증 — 외부 세계의 지저분함이 전부 이 건물 안에 갇힌다. 밖으로 나가는 것은 내부 형식뿐이다. 네트워크 계수기가 여기서만 올라가는 것을 보라. 이 건물을 다른 것(GitLab, 로컬 git)으로 갈아치워도, 게이트의 간판이 같으면 업무는 모른다.'
    },
    {
      id: 'fake', name: '테스트 어댑터', x: 15, y: 19, r: 3.8, color: C.teal,
      tag: '대역 — 네트워크 0',
      short: '준비된 데이터를 돌려주는 같은 약속의 다른 구현. 네트워크 계수기가 멈춰 있습니다.',
      body: '포트가 있어서 얻는 가장 실용적인 보상이 이 건물이다 — 외부 API 없이, 토큰 없이, 네트워크 없이 업무 로직을 테스트할 수 있다. 대역이 진짜와 같은 간판(read(repo): Commit[])을 걸고 있다는 것이 조건의 전부다. 인터페이스 하나 만들었다고 전면 헥사고날이 되는 것은 아니고, 그럴 필요도 없다 — 갈아끼울 곳과 테스트할 곳에만 문을 달면 된다.'
    },
    {
      id: 'convert', name: '형식 변환소', x: 32, y: 14, r: 3.8, color: C.plum,
      tag: '바깥 모양 → 안 모양',
      short: 'HTTP 응답이든 테스트 데이터든, 여기서 내부 Commit 형식으로 맞춰집니다.',
      body: '두 갈래 길이 여기서 합쳐진다는 것이 지도의 요점이다. 바깥의 JSON 모양이 업무까지 흘러들면 외부 API의 사정이 곧 업무의 사정이 된다 — 변환소가 그 침투를 끊는다. 업무가 받는 것은 언제나 같은 내부 형식이고, 그래서 업무는 두 결과를 구분할 수 없다(구분할 필요도 없다).'
    },
    {
      id: 'result', name: '결과 선반', x: 7, y: 12, r: 3.6, color: C.sage,
      tag: '같은 모양인가',
      short: '이번 호출의 Commit[]이 선반에 놓입니다. 두 바퀴가 끝나면 두 칸을 비교합니다.',
      body: '선반의 두 칸이 같은 색이면 — 같은 형식, 같은 필드 — 실험 성공이다. 업무 코드는 두 바퀴 내내 한 글자도 바뀌지 않았고, 바뀐 것은 게이트 뒤의 장치뿐이었다. "ingest만 GitHub에 접근한다"는 팀 규칙이 모듈 책임의 이야기라면, 이 게이트는 그 규칙을 코드 구조로 만드는 방법이다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var chars = (d.short + d.body).length;
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    biz: function (m) { /* 사옥 — 두 바퀴째엔 결과를 들고 재출발 */ },
    port: function (m) { M.callPort(m); },
    github: function (m) { M.adapt(m); },
    fake: function (m) { M.adapt(m); },
    convert: function (m) { M.convert(m); },
    result: function (m) { M.receive(m); }
  };

  function nextRoute(cur, m) {
    if (cur === 'out') return M.currentAdapter(m) === 'github' ? 'gh' : 'fake';
    if (cur === 'out2') return M.currentAdapter(m) === 'github' ? 'gh' : 'fake';
    if (cur === 'gh' || cur === 'fake') return 'back';
    if (cur === 'back') return m.call < 2 ? 'out2' : null;
    return null;
  }

  function stateBoard(m) {
    return [
      ['약속', 'read(repo): Commit[]'],
      ['업무 호출', m.requests + '회'],
      ['지금 구현체', m.current ? (m.current === 'github' ? 'GitHub' : '테스트 대역') : '—'],
      ['네트워크 호출', m.network + '회', false],
      ['받은 결과', m.results.length + '건'],
      ['형식 일치', m.results.length === 2 ? (M.sameShape(m) ? '일치' : '불일치') : '비교 전', m.results.length === 2 && !M.sameShape(m)]
    ];
  }

  function verdict(m) {
    if (m.results.length === 2) {
      return M.sameShape(m)
        ? '두 구현체가 같은 내부 형식을 돌려줬다. 업무 코드는 두 바퀴 내내 변경 0줄 — 네트워크만 ' + m.network + '회와 0회로 갈렸다.'
        : '형식이 갈라졌다 — 변환소가 일을 안 한 것이다.';
    }
    if (m.current === 'github') return '외부의 지저분함(HTTP·rate limit)이 어댑터 안에 갇혀 있다.';
    if (m.current === 'fake') return '같은 간판, 다른 장치 — 네트워크 계수기가 멈춰 있는 것을 보라.';
    return '업무는 SDK가 아니라 약속을 부른다.';
  }

  function vanInfo(m) {
    return {
      text: m.cargo,
      sub: m.current ? ((m.current === 'github' ? 'GitHub' : 'Fake') + ' 경유') : 'read(repo)',
      gauge: null,
      crates: m.results.length,
      crateColor: '#6d9068',
      chips: m.results.map(function () { return { color: '#6d9068' }; })
    };
  }

  function doneCard(m) {
    return {
      tag: '호출 2 · 네트워크 ' + m.network + ' · 변경 0줄',
      title: '업무는 그대로, 장치만 두 번 바뀌었다',
      short: '같은 read(repo) 호출이 GitHub 장치로 한 번, 테스트 대역으로 한 번 처리됐고, 두 결과의 내부 형식은 같았다. 업무 코드가 몰라도 되는 것을 실제로 모르게 만든 것 — 그게 포트다.',
      body: '기억할 경계 하나: 차량 길은 런타임 흐름이고, 소스 의존은 어댑터 → 포트 방향이다. 그리고 포트는 공짜가 아니므로 갈아끼울 곳·테스트할 곳에만 단다.'
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

    /* 카드 업무 사옥 */
    block(6.0, 3.6, { w: 3.4, d: 2.6, h: 3.0, color: '#c3d0d9', cols: 3, lit: C.steel, rooftop: C.steel });

    /* 포트 게이트: 도로 위 갠트리 = 인터페이스 간판 */
    put({ kind: 'gatePost', x: 15, y: 6.3, color: C.violet });
    put({ kind: 'gateBeam', x: 15, y: 8.0, color: C.violet });
    put({ kind: 'gatePost', x: 15, y: 9.7, color: C.violet });

    /* GitHub 어댑터: 접시 안테나 + 연기 굴뚝(네트워크) + 계수기 */
    put({ kind: 'dish', x: 22.2, y: 0.8, color: C.orange });
    put({ kind: 'stack', x: 27.2, y: 0.6, color: C.orange,
      active: function (m, s) { return s.station === 'github'; } });
    put({ kind: 'column', x: 20.0, y: 5.6, color: C.orange, labelZ: 5.0,
      fill: function (m) { return m.network / 2; },
      text: function (m) { return '네트워크 ' + m.network; } });

    /* 테스트 어댑터: 준비된 데이터 진열대 */
    put({ kind: 'bench', x: 11.4, y: 21.8, color: C.teal,
      slots: function () { return [{ color: '#8fbab6' }, { color: '#8fbab6' }, { color: '#8fbab6' }]; },
      text: function () { return '준비된 데이터'; } });

    /* 형식 변환소 */
    put({ kind: 'press', x: 35.0, y: 10.0, color: C.plum,
      active: function (m, s) { return s.station === 'convert'; } });

    /* 결과 선반 */
    put({ kind: 'bench', x: 3.2, y: 13.2, color: C.sage,
      slots: function (m) {
        return [
          { color: m.results[0] ? '#6d9068' : '#d9d3c6' },
          { color: m.results[1] ? '#6d9068' : '#d9d3c6' }
        ];
      },
      text: function (m) { return m.results.length ? 'Commit[] ×' + m.results.length : '1차 · 2차'; } });

    var spots = [[11, 3], [30, 8], [26, 12], [20, 15], [27, 22], [40, 8], [40, 20], [12, 28], [22, 28], [31, 28], [3, 21], [38, 3]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = [OUT, GH, FAKE, BACK].some(function (r) {
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
    GW: 44, GH: 32,
    routes: { out: OUT, out2: OUT2, gh: GH, fake: FAKE, back: BACK },
    routeStyles: {
      gh: { surface: '#ddd0be' },
      fake: { surface: '#d3dbcb', dash: 'rgba(63,138,134,0.5)' }
    },
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
      title: '어댑터 공방',
      subtitle: '업무는 그대로, 장치만 교체 — 인터페이스 · 의존성 역전',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kyungpook-1-pr-4.md&line=43#ports',
      limit: '차량의 길은 런타임 호출 순서다 — 소스 코드 의존 방향(어댑터 → 내부 포트)과 반대이니 혼동하지 말 것. 인터페이스 하나가 전면 헥사고날을 뜻하지 않으며, 포트의 근거는 교체 가능성 외에 기술 격리·테스트일 수도 있다. GitHub 호출은 모의다.',
      sources: [
        ['Alistair Cockburn · Hexagonal Architecture', 'https://alistair.cockburn.us/hexagonal-architecture'],
        ['카카오뱅크 · 헥사고날 적용기', 'https://tech.kakaobank.com/posts/2311-hexagonal-architecture-in-messaging-hub/']
      ]
    },
    scenarios: [
      { id: 'ghFirst', label: 'GitHub 먼저 → 테스트 대역' },
      { id: 'fakeFirst', label: '테스트 대역 먼저 → GitHub' }
    ],
    startRoute: 'out',
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
