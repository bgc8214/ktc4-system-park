/* retry.world.js: 재시도 우체국 — 응답이 사라졌을 때 어느 길로 가는가.
 *
 * 지형이 곧 규칙이다: 응답이 유실되면 차량이 왼쪽 아래 우회로로 꺾어
 * 재시도 판단소를 지나 발신 창구로 돌아온다. 그 판단소에서 키를 바꾸느냐 아니냐가
 * 결과 부두의 Job 개수를 정한다 — 같은 길, 다른 결말.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.RetryModel;
  var makeRoute = Iso.makeRoute;

  /* 1차: 발신 → 접수 → 응답 */
  var OUT = makeRoute([
    [2, 18],       // 도입부
    [2, 8],
    [8, 8],        // 2 발신 창구
    [20, 8],       // 3 접수 사무소
    [32, 8]        // 4 응답 구간
  ]);

  /* 유실 시 우회로: 판단소를 지나 발신 창구로 복귀 */
  var RETRY = makeRoute([
    [32, 8],
    [40, 8],       // corner
    [40, 22],      // corner
    [30, 22],
    [21, 22],      // 4 재시도 판단소
    [10, 22],
    [8, 22],
    [8, 8]         // 발신 창구 복귀
  ]);

  /* 2차: 발신 → 접수 → 응답 (도입부 없이) */
  var OUT2 = makeRoute([
    [8, 8],
    [20, 8],       // 1 접수 사무소
    [32, 8]        // 2 응답 구간
  ]);

  /* 응답이 도착하면 결과 부두로 */
  var DOCK = makeRoute([
    [32, 8],
    [32, 13],      // corner
    [26, 13],
    [26, 29],      // corner
    [17, 29]       // 4 결과 부두
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    out: [
      station(OUT, 2, 'desk', 1.6),
      station(OUT, 3, 'intake', 1.8),
      station(OUT, 4, 'wire', 1.8)
    ],
    retry: [
      station(RETRY, 4, 'decide', 2.2)
    ],
    out2: [
      station(OUT2, 1, 'intake', 1.4),
      station(OUT2, 2, 'wire', 1.4)
    ],
    dock: [
      station(DOCK, 4, 'dock', 1.8)
    ]
  };

  var STATION_TO_DISTRICT = {
    desk: 'desk', intake: 'intake', wire: 'wire', decide: 'decide', dock: 'dock'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'desk', name: '발신 창구', x: 8, y: 8, r: 3.8, color: C.steel,
      tag: '키를 들고 출발한다',
      short: '요청마다 멱등 키를 하나 발급합니다. 차량 옆면의 칩이 지금 든 키입니다.',
      body: '멱등 키(Idempotency-Key)는 "이 요청은 저 요청과 같은 것"을 서버에 알려주는 이름표다. 만드는 건 쉽다 — 어려운 건 <b>언제 같은 이름표를 다시 쓰는가</b>이고, 이 지도의 전부가 그 판단이다. 차량이 이 창구를 두 번 지나는데, 두 번째에 무슨 칩을 달고 나가는지 지켜보라.'
    },
    {
      id: 'intake', name: '접수 사무소', x: 20, y: 8, r: 4.0, color: C.ochre,
      tag: 'DB 유니크 제약이 심판',
      short: '같은 키가 이미 있으면 새로 만들지 않고 기존 Job을 돌려줍니다.',
      body: '접수대 뒤 진열대가 지금까지 만들어진 Job이다. 서버는 "이 키로 만든 게 있나"를 코드로 판단하지 않고 <b>DB 유니크 제약</b>에 맡긴다 — 동시 요청이 몇 개든 DB는 한 줄만 받기 때문이다. 부산 1팀 멘토가 실제로 세션 10개에 동시 start를 10번씩 보냈더니 <b>200 응답이 세션마다 딱 하나</b>였다고 한다. 여기가 그 장치다.'
    },
    {
      id: 'wire', name: '응답 구간', x: 32, y: 8, r: 3.8, color: C.plum,
      tag: '가장 위험한 실패',
      short: '1차 시도에서 응답이 사라집니다. 서버는 일을 다 했는데 우리는 그걸 모릅니다.',
      variants: {
        blind: { body: '응답이 유실됐다. 여기서 중요한 건 <b>서버가 일을 안 한 게 아니라, 했는지 안 했는지를 우리가 모른다</b>는 것이다. 타임아웃·연결 끊김·502가 전부 이 부류다. 실패를 한 덩어리로 보면 여기서 잘못된 선택을 하게 된다.' },
        smart: { body: '응답이 유실됐다. 실패에는 두 종류가 있다 — <b>결과를 아는 실패</b>(400·404·409: 서버가 확실히 거절함)와 <b>결과를 모르는 실패</b>(끊김·500·타임아웃: 했는지 모름). 이 둘을 구분하는 것이 다음 정거장의 판단 기준이 된다.' }
      },
      body: '응답이 사라지면 우리는 서버가 일했는지 알 수 없다.'
    },
    {
      id: 'decide', name: '재시도 판단소', x: 21, y: 22, r: 4.4, color: C.brick,
      tag: '이 지도의 심장',
      short: '다시 보낼 때 같은 키를 쓸 것인가, 새 키를 만들 것인가.',
      variants: {
        blind: {
          short: '실패했으니 새 키를 발급합니다 — 가장 자연스러워 보이는 선택입니다.',
          body: '"실패했으니 새로 보내자"는 직관적이지만, 이 실패는 <b>결과를 모르는 실패</b>였다. 서버에는 이미 Job이 있는데 새 키로 가면 서버는 그걸 <b>다른 요청</b>으로 본다 — 멱등 키가 있는데도 중복이 생기는 것이다. 차량 칩이 k-1에서 k-2로 바뀌는 것을 보라. 이 한 번의 교체가 부두의 Job 개수를 바꾼다.'
        },
        smart: {
          short: '결과를 모르는 실패였으므로 같은 키를 유지합니다.',
          body: '판단 규칙은 한 줄이다: <b>결과를 아는 실패면 새 키, 모르는 실패면 같은 키.</b> 끊김·500·타임아웃은 서버가 처리했을 수 있으니 같은 키로 물어봐야 하고, 400·404·409는 확실히 거절당했으니 새 키가 맞다. 차량 칩이 k-1 그대로인 것을 보라 — 접수 사무소가 그 키를 알아볼 것이다.'
        }
      },
      body: '실패의 종류가 키의 운명을 정한다.'
    },
    {
      id: 'dock', name: '결과 부두', x: 17, y: 29, r: 4.2, color: C.sage,
      tag: 'Job 몇 개가 만들어졌나',
      short: '사용자는 한 번 눌렀습니다. 서버에 Job이 몇 개 있어야 맞을까요.',
      variants: {
        blind: { short: 'Job 2개. 같은 분석이 두 번 돌고, 비용도 두 번 나갑니다.', body: '사용자는 버튼을 한 번 눌렀는데 서버에는 Job이 둘이다. 분석이 두 번 돌고 토큰 비용도 두 배다. 더 나쁜 건 <b>이게 조용하다</b>는 것 — 화면에는 오류가 없고, 사용자도 모르고, 로그를 보기 전엔 아무도 모른다. 멱등 키를 만들어 놓고도 중복이 생긴 이유는 키가 없어서가 아니라 <b>재시도할 때 키를 바꿨기 때문</b>이다.' },
        smart: { short: 'Job 1개. 두 번 보냈지만 서버는 한 번만 일했습니다.', body: '같은 키로 두 번 도착했고, 두 번째는 접수 사무소가 기존 Job을 돌려줬다. 사용자가 본 것은 정상 응답 하나뿐이다. <b>멱등성의 정의가 이 화면이다</b> — 여러 번 보내도 결과가 한 번 보낸 것과 같다. 비교 장면을 「무조건 새 키」로 바꿔 같은 유실을 다시 겪어 보라.' }
      },
      body: 'Job 개수가 이 지도의 성적표다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.blind || d.variants.smart);
    var chars = d.short.length + (v ? v.body.length : d.body.length);
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    desk: function (m) { M.prepare(m); },
    intake: function (m) { M.receive(m); },
    wire: function (m) { M.respond(m); },
    decide: function (m) { M.decide(m); },
    dock: function (m) { M.settle(m); }
  };

  function nextRoute(cur, m) {
    if (cur === 'out') return m.lastOutcome === 'LOST' ? 'retry' : 'dock';
    if (cur === 'retry') return 'out2';
    if (cur === 'out2') return 'dock';
    return null;
  }

  function stateBoard(m) {
    var dup = m.jobs.length > 1;
    return [
      ['시도', m.attempt + '회'],
      ['지금 든 키', m.key],
      ['서버에 도달한 키', m.sentKeys.join(' · ') || '—'],
      ['재시도 정책', m.smart ? '모를 때만 같은 키' : '무조건 새 키', !m.smart],
      ['만들어진 Job', m.jobs.length, dup]
    ];
  }

  function verdict(m) {
    if (m.jobs.length > 1) return '사용자는 한 번 눌렀는데 Job이 둘이다 — 멱등 키가 있어도 재시도할 때 키를 바꾸면 소용없다.';
    if (m.lastOutcome === 'DUPLICATE_BLOCKED') return '같은 키가 도착해 DB가 새 Job을 거절했다. 두 번째 요청은 기존 Job을 받는다 — 이게 멱등이다.';
    if (m.lastOutcome === 'LOST') return '서버가 일했는지 모르는 상태다. 이 실패를 400·404와 같이 취급하면 중복이 생긴다.';
    if (m.jobs.length === 1) return 'Job 하나 생성. 아직 응답이 사용자에게 도착할지는 다음 구간이 정한다.';
    return '멱등 키의 어려움은 만드는 게 아니라 다시 쓰는 판단이다.';
  }

  function vanInfo(m) {
    var chips = [{ color: m.key === 'k-1' ? '#4a7a9b' : '#b05470' }];
    if (m.jobs.length) chips.push({ color: m.jobs.length > 1 ? '#b05470' : '#6d9068' });
    return {
      text: m.cargo,
      sub: '키 ' + m.key + ' · ' + m.attempt + '차',
      gauge: null,
      crates: m.jobs.length,
      crateColor: m.jobs.length > 1 ? '#b05470' : '#6d9068',
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'blind') {
      return {
        tag: 'Job ' + m.jobs.length + '개 ⚠ · 키 ' + m.sentKeys.join(', '),
        title: '멱등 키가 있는데 중복이 생겼다',
        short: '키를 만든 것만으로는 부족했다. 결과를 모르는 실패에 새 키를 발급하는 순간, 서버는 그것을 완전히 다른 요청으로 본다.',
        body: '실패를 한 덩어리로 보지 말고 "결과를 아는가"로 나누는 것 — 그게 이 지도의 한 줄이다.'
      };
    }
    return {
      tag: 'Job 1개 · 같은 키 2회 도착',
      title: '두 번 보냈지만 서버는 한 번만 일했다',
      short: '같은 키로 재시도했고, 접수 사무소가 기존 Job을 돌려줬다. 사용자가 본 것은 정상 응답 하나뿐이다.',
      body: '다만 이 방식은 "첫 요청이 서버에 도달했다"를 전제로 한다. 재시도 횟수 상한과 백오프는 이 지도 밖의 별도 설계다.'
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

    /* 발신 창구: 키 발급 키오스크 */
    put({ kind: 'kiosk', x: 8, y: 3.6, color: C.steel, bubble: '#',
      active: function (m, s) { return s.station === 'desk'; } });

    /* 접수 사무소: 차단기(유니크 제약) + Job 진열대 */
    put({ kind: 'toll', x: 20, y: 8, color: C.ochre, which: 'intake', axis: 'y',
      on: function () { return true; } });
    put({ kind: 'bench', x: 20.4, y: 3.2, color: C.ochre,
      slots: function (m) {
        return [
          { color: m.jobs[0] ? '#6d9068' : '#d9d3c6' },
          { color: m.jobs[1] ? '#b05470' : '#d9d3c6' }
        ];
      },
      text: function (m) { return m.jobs.length ? 'Job ' + m.jobs.length : '빈 장부'; } });

    /* 응답 구간: 안테나 + 유실되면 연기 */
    put({ kind: 'dish', x: 35.4, y: 4.4, color: C.plum });
    put({ kind: 'stack', x: 35.6, y: 10.6, color: C.plum,
      active: function (m, s) { return m.lastOutcome === 'LOST' && s.station === 'wire'; } });

    /* 재시도 판단소: 프레스(판단 기계) */
    put({ kind: 'press', x: 21, y: 26.2, color: C.brick,
      active: function (m, s) { return s.station === 'decide'; } });

    /* 결과 부두: 컨테이너 + Job 개수 기둥 */
    put({ kind: 'containers', x: 12.4, y: 31.6, color: C.sage });
    put({ kind: 'column', x: 20.6, y: 31.4, color: C.sage,
      fill: function (m) { return m.jobs.length / 2; },
      text: function (m) { return 'Job ' + m.jobs.length; },
      sub: '한 번 눌렀다' });

    var spots = [[14, 13], [26, 17], [34, 17], [14, 17], [4, 26], [44, 13], [44, 27], [30, 33], [7, 32], [26, 4], [12, 26], [38, 31]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = [OUT, RETRY, OUT2, DOCK].some(function (r) {
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
    GW: 48, GH: 36,
    routes: { out: OUT, retry: RETRY, out2: OUT2, dock: DOCK },
    routeStyles: {
      retry: { width: 2.2, surface: '#ddd2c4', dash: 'rgba(168,90,68,0.5)' },
      out2: { surface: '#d8d3c6' }
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
      title: '재시도 우체국',
      subtitle: '응답이 사라졌을 때 — 같은 키로 다시 보낼 것인가',
      origin: 'https://github.com/kakaotechcampus-4/ktc4-kyungpook-1/pull/57',
      limit: '첫 요청이 서버에 도달해 Job이 만들어졌고 응답만 유실됐다고 가정한다(이 지도가 다루려는 정확한 상황). 재시도 횟수 상한·지수 백오프·서킷 브레이커는 범위 밖이다.',
      sources: [
        ['Stripe — Designing robust APIs with idempotency', 'https://stripe.com/blog/idempotency'],
        ['토스페이먼츠 — 멱등성이 뭔가요?', 'https://docs.tosspayments.com/blog/what-is-idempotency'],
        ['MDN — Idempotent', 'https://developer.mozilla.org/en-US/docs/Glossary/Idempotent']
      ]
    },
    scenarios: [
      { id: 'blind', label: '사고 장면 — 실패하면 무조건 새 키' },
      { id: 'smart', label: '안전 장면 — 결과를 모를 때만 같은 키' }
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
