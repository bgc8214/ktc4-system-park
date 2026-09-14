/* auth.world.js: 인증과 인가의 도시 — 길·정류장·구역·건물.
 *
 * 지형이 곧 규칙이다: 검문소에서 길이 갈라진다. 소유권 검사가 켜져 있으면
 * 차량은 창고에 못 들어가고 짧은 거절 길로 터미널로 돌아간다. 검사가 꺼져
 * 있으면 창고를 통과해 남의 카드를 싣고 나온다 — 노선 자체가 결론이다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.AuthModel;
  var makeRoute = Iso.makeRoute;

  /* ---- 길 ---- */

  var MAIN = makeRoute([
    [2, 16],       // 0 출발 (도입부 — 페이지가 뜨기 전에 첫 정류장이 발화하지 않게)
    [2, 6],
    [6, 6],        // 2 브라우저 책상
    [15, 6],       // 3 로그인 센터
    [24, 6],       // 4 세션 보관소
    [32, 6],       // corner
    [32, 12],      // 6 요청 게시대
    [32, 19]       // 7 인가 검문소
  ]);

  /* 통과: 창고를 거쳐 터미널로 */
  var PASS = makeRoute([
    [32, 19],
    [32, 26],      // corner
    [24, 26],      // 2 카드 창고
    [14, 26],      // 3
    [10, 26],
    [10, 20]       // 5 응답 터미널
  ]);

  /* 거절: 창고를 건너뛰는 짧은 길 — 지도에서 바로 보이는 차단 효과 */
  var DENY = makeRoute([
    [32, 19],
    [26, 19],
    [16, 19],      // 2 응답 터미널(같은 글)
    [10, 20]
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'browser', 1.4),
      station(MAIN, 3, 'login', 1.4),
      station(MAIN, 4, 'session', 1.6),
      station(MAIN, 6, 'request', 1.4),
      station(MAIN, 7, 'authz', 2.0)
    ],
    pass: [
      station(PASS, 2, 'warehouse', 1.8),
      station(PASS, 5, 'respond', 1.6)
    ],
    deny: [
      station(DENY, 2, 'respond', 1.6)
    ]
  };

  var STATION_TO_DISTRICT = {
    browser: 'browser', login: 'login', session: 'session', request: 'request',
    authz: 'authz', warehouse: 'warehouse', respond: 'respond'
  };

  /* ---- 팔레트 ---- */

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', stone: '#7d8b96',
    rose: '#b05470', sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c',
    brick: '#a85a44', plum: '#8b5f96', ink: '#4a4540',
    road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  /* ---- 구역과 글 ---- */

  var DISTRICTS = [
    {
      id: 'browser', name: '브라우저 책상', x: 6, y: 6, r: 3.8, color: C.steel,
      tag: '요청이 시작되는 곳',
      short: '차량은 사용자 A의 로그인 요청입니다. 아직 서버는 이 사람이 누구인지 모릅니다.',
      body: '지금 서버가 아는 것은 아무것도 없다 — 사용자도, 세션도 없다. 이 지도의 목적지는 카드 한 장인데, 그 카드에 도착하기 전에 두 개의 다른 질문을 통과해야 한다: "너는 누구인가"(인증)와 "그걸 봐도 되는가"(인가). 이 둘을 같은 질문으로 취급하는 순간이 사고의 시작이다.'
    },
    {
      id: 'login', name: '로그인 센터', x: 15, y: 6, r: 3.8, color: C.violet,
      tag: '인증 — 너는 누구인가',
      short: '아이디와 비밀번호로 사용자 A를 확인합니다. 권한 이야기는 아직 시작도 안 했습니다.',
      body: '로그인은 신원 확인까지만 한다. 여기서 A라는 것이 확인되어도, A가 무엇을 볼 수 있는지는 전혀 결정되지 않았다. 패널의 「인증 사용자」가 A로 바뀌는 것을 보라 — 바뀐 것은 그것 하나뿐이다.'
    },
    {
      id: 'session', name: '세션 보관소', x: 24, y: 6, r: 3.8, color: C.plum,
      tag: '서버의 기억',
      short: '서버가 s7 → A를 보관하고, 브라우저에는 쿠키로 SID만 전달합니다.',
      body: '쿠키와 세션은 같은 것이 아니다. 세션은 서버가 들고 있는 상태(s7이 A라는 기억)이고, 쿠키는 그 열쇠 번호를 나르는 봉투일 뿐이다. 봉투에 사용자 정보 전체를 담을 필요가 없다. 금고가 돌아가는 동안 차량 옆면에 SID 칩이 하나 붙는 것을 보라 — 이후 모든 요청에 이 칩이 자동으로 따라간다.'
    },
    {
      id: 'request', name: '요청 게시대', x: 32, y: 12, r: 3.6, color: C.ochre,
      tag: '문제의 요청',
      short: 'A가 B의 카드 UUID로 요청을 보냅니다. 주소를 아는 것과 권한이 있는 것은 다릅니다.',
      body: '이 지도는 "A가 B의 카드 UUID를 이미 알고 있다"를 조건으로 고정한다 — 링크 공유, 화면 캡처, 로그 유출 등 주소가 새는 경로는 현실에 많다. UUID는 추측을 어렵게 할 뿐 자물쇠가 아니다. 순차 번호를 UUID로 바꾸는 것은 문패를 가리는 일이고, 문을 잠그는 일은 다음 검문소의 몫이다.'
    },
    {
      id: 'authz', name: '인가 검문소', x: 32, y: 19, r: 4.2, color: C.brick,
      tag: '인가 — 봐도 되는가',
      short: '세션으로 A인 것은 안다. 묻는 것은 하나 — 이 카드의 소유자가 A인가?',
      variants: {
        secure: {
          short: '소유자 B ≠ 사용자 A. 차단기가 내려가고 차량은 창고에 들어가지 못합니다.',
          body: '검사는 한 줄 비교다: 자원의 소유자와 세션의 사용자가 같은가. 다르므로 거절이고, 이 예시는 자원의 존재 여부를 숨기기 위해 403 대신 404를 돌려준다. 지도를 보라 — 거절된 차량은 창고를 아예 지나지 않는 짧은 길로 빠진다. 검사가 서버 쪽에 있으므로 클라이언트가 무엇을 알든 우회할 수 없다.'
        },
        uuidOnly: {
          short: '검사가 꺼져 있습니다. UUID만 맞으면 통과 — 차단기가 아예 없습니다.',
          body: '이 장면에서 서버는 "UUID를 아는 사람 = 볼 자격이 있는 사람"으로 취급한다. 차단기 없는 검문소를 차량이 그대로 지나 창고로 들어가는 것을 보라. 로그인은 멀쩡히 있었다는 점이 중요하다 — 인증이 있어도 인가가 없으면, 이 길은 열려 있다.'
        }
      },
      body: '인증과 인가는 다른 질문이다. 세션은 "누구인가"까지만 답한다.'
    },
    {
      id: 'warehouse', name: '카드 창고', x: 24, y: 26, r: 4.0, color: C.teal,
      tag: '자원이 사는 곳',
      short: '검문을 통과한 요청은 카드를 연다 — 소유자가 누구든.',
      variants: {
        uuidOnly: {
          short: 'B의 보관함이 열렸습니다. A의 차량에 B의 카드가 실립니다.',
          body: '창고는 검문소를 믿는다. 여기까지 온 요청이면 열어 준다 — 그래서 검사는 창고 앞이 아니라 창고에 도착하기 전에 있어야 한다. 진열대에서 B 칸이 붉게 열린 것과, 차량 짐칸에 남의 카드 상자가 실리는 것을 보라. 이 상자는 이제 응답이 되어 A에게 배달된다.'
        }
      },
      body: '창고는 권한을 다시 묻지 않는다. 검문소가 통과시킨 요청을 그대로 처리한다. 소유권 검사가 켜진 장면에서는 차량이 여기 오지 않는다 — 그것이 이 검사의 전부다.'
    },
    {
      id: 'respond', name: '응답 터미널', x: 10, y: 20, r: 4.0, color: C.sage,
      tag: '최종 응답',
      short: '거절이면 404, 통과면 200과 카드.',
      variants: {
        secure: {
          short: '404 — B의 카드는 A에게 보이지 않았습니다. 존재 여부조차 숨겼습니다.',
          body: '안전한 거절이다. 쿠키도 세션도 정상이었지만 소유권이 달라서 멈췄다. 404를 쓴 것은 "그 카드가 있긴 있다"는 정보조차 주지 않기 위해서다(정책에 따라 403을 쓰기도 한다). 이 흐름에서 유일하게 중요한 코드는 검문소의 한 줄 비교였다.'
        },
        uuidOnly: {
          short: '200 — B의 카드가 A에게 반환됐습니다. 이 응답은 성공처럼 생긴 사고입니다.',
          body: '클라이언트 화면에는 아무 이상이 없다. 상태 코드도 200이다. 그래서 이런 결함은 화면 테스트로 잡히지 않고, "다른 사용자의 UUID로 요청하면 404인가"라는 테스트로만 잡힌다. 비교 장면을 「소유권 검사 있음」으로 바꿔 같은 길을 다시 달려 보라.'
        }
      },
      body: '응답 코드보다 중요한 것은 무엇이 실려 왔는가다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && d.variants.secure;
    var chars = (d.short + d.body + (v ? v.body : '')).length / (v ? 2 : 1);
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  /* ---- 모델 연결 ---- */

  var OPS = {
    browser: function (m) { /* 출발 — 상태 변화 없음 */ },
    login: function (m) { M.login(m); },
    session: function (m) { M.makeSession(m); },
    request: function (m) { M.requestCard(m); },
    authz: function (m) { M.authorize(m); },
    warehouse: function (m) { M.openCard(m); },
    respond: function (m) { M.respond(m); },
    
  };

  function nextRoute(cur, m) {
    if (cur === 'main') return m.denied ? 'deny' : 'pass';
    return null;
  }

  /* ---- 패널 ---- */

  function stateBoard(m) {
    return [
      ['인증 사용자', m.user || '없음'],
      ['세션', m.sid ? m.sid + ' → ' + m.user : '없음'],
      ['요청 대상', m.target + '의 카드'],
      ['소유권 검사', m.checkOn ? '켜짐' : '꺼짐', !m.checkOn],
      ['열린 카드', m.opened || '없음', m.opened === 'B'],
      ['응답', m.code || '—', m.code === '200' && m.opened === 'B']
    ];
  }

  function verdict(m) {
    if (m.code === '404') return '인증은 통과했지만 인가에서 멈췄다 — 두 검사는 서로 다른 질문이라 하나가 다른 하나를 대신하지 못한다.';
    if (m.opened === 'B') return 'B의 카드가 A에게 반환됐다. UUID가 복잡하다는 것은 방어가 아니었다 — 서버 쪽 소유권 비교 한 줄이 유일한 자물쇠다.';
    if (m.sid) return '차량 옆의 SID 칩은 "누구인가"만 증명한다. "봐도 되는가"는 검문소에서 결정된다.';
    return '서버는 아직 이 요청이 누구의 것인지 모른다.';
  }

  function vanInfo(m) {
    var chips = [];
    if (m.user) chips.push({ color: '#6f63a8' });                    // 신원
    if (m.sid) chips.push({ color: '#4a7a9b' });                     // SID 쿠키
    if (m.opened) chips.push({ color: m.opened === 'B' ? '#b05470' : '#6d9068' });
    return {
      text: m.cargo,
      sub: m.sid ? 'SID=' + m.sid : '쿠키 없음',
      gauge: null,
      crates: m.opened ? 1 : 0,
      crateColor: m.opened === 'B' ? '#b05470' : '#6d9068',
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'secure') {
      return {
        tag: '404 · 노출 0건',
        title: '거절이 이 지도의 정답이다',
        short: 'B의 카드는 A에게 보이지 않았다. 로그인·세션·쿠키가 전부 정상이어도, 소유권 비교 한 줄이 없으면 이 결과는 보장되지 않는다.',
        body: '비교 장면을 「UUID만 사용」으로 바꿔 보라. 같은 로그인, 같은 세션, 같은 요청이 창고를 통과해 남의 카드를 싣고 나온다.'
      };
    }
    return {
      tag: '200 · 노출 1건',
      title: 'B의 카드가 A에게 배달됐다',
      short: '화면에는 아무 오류가 없다 — 그래서 이 결함은 조용하다. 잡는 방법은 "남의 UUID로 요청하면 거절되는가"를 테스트로 두는 것뿐이다.',
      body: '비교 장면을 「소유권 검사 있음」으로 바꾸면 같은 차량이 검문소에서 멈추고, 창고 길이 통째로 잘리는 것을 볼 수 있다.'
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
    block(4.0, 2.6, { w: 3.0, d: 2.4, h: 2.2, color: '#c3d0d9', cols: 3, lit: C.steel, roof: '#9aa8b2', roofH: 0.6 });
    put({ kind: 'kiosk', x: 7.6, y: 10.2, color: C.steel, bubble: 'A',
      active: function (m, s) { return s.station === 'browser'; } });

    /* 로그인 센터 */
    block(13.4, 2.4, { w: 3.4, d: 2.6, h: 3.2, color: '#c4bedb', cols: 3, lit: C.violet });
    put({ kind: 'gatePost', x: 15.0, y: 4.3, color: C.violet });
    put({ kind: 'gateBeam', x: 15.0, y: 6.0, color: C.violet });
    put({ kind: 'gatePost', x: 15.0, y: 7.7, color: C.violet });

    /* 세션 보관소: 금고 — 세션을 만드는 동안 손잡이가 돈다 */
    put({ kind: 'safe', x: 24.0, y: 2.8, color: C.plum,
      spin: function (m, s) { return s.station === 'session'; } });

    /* 요청 게시대 */
    put({ kind: 'kiosk', x: 35.6, y: 12.0, color: C.ochre, bubble: 'B?',
      active: function (m, s) { return s.station === 'request'; } });

    /* 인가 검문소: 차단기 — 소유권 검사가 켜진 장면에서만 팔이 존재한다 */
    put({ kind: 'toll', x: 32, y: 19, color: C.brick, which: 'authz', axis: 'y',
      on: function (m) { return m.checkOn; } });
    block(36.2, 20.6, { w: 2.6, d: 2.2, h: 2.0, color: '#d6b8ac', cols: 3, lit: C.brick });

    /* 카드 창고: 진열대 — A함·B함. 열린 칸에 상태 색이 칠해진다 */
    put({
      x: 22.4, y: 29.6, z: 0, w: 5.2, d: 3.0, h: 2.6, color: '#a9c4c2',
      panels: { cols: 5, seed: 5, color: '#cfe0de' }, rooftop: C.teal
    });
    put({ kind: 'bench', x: 24.6, y: 23.2, color: C.teal,
      slots: function (m) {
        return [
          { color: m.opened === 'A' ? '#6d9068' : '#d9d3c6' },
          { color: m.opened === 'B' ? '#b05470' : '#d9d3c6' }
        ];
      },
      text: function (m) { return m.opened ? m.opened + '함 열림' : 'A함 · B함'; } });

    /* 응답 터미널 */
    block(6.6, 21.4, { w: 3.0, d: 2.4, h: 2.4, color: '#b9cdb4', cols: 3, lit: C.sage, roof: '#93a88e', roofH: 0.6 });
    put({ kind: 'kiosk', x: 11.2, y: 16.4, color: C.sage,
      bubble: '·',
      active: function (m, s) { return s.station === 'respond' || (s.finished && m.code); } });

    /* 배경 */
    var spots = [[10, 13], [19, 13], [27, 10], [38, 6], [40, 15], [38, 25], [30, 30], [16, 30], [5, 28], [18, 22], [26, 15], [3, 12]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = [MAIN, PASS, DENY].some(function (r) {
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
    GW: 44, GH: 34,
    routes: { main: MAIN, pass: PASS, deny: DENY },
    routeStyles: { deny: { width: 2.0, surface: '#ddd2c4', dash: 'rgba(168,90,68,0.5)' } },
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
      title: '인증과 인가의 도시',
      subtitle: '로그인한 A가 B의 주소를 알면 열리는가 — 세션 · 쿠키 · 소유권 검사',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kyungpook-1-pr-4.md&line=65#auth',
      limit: 'A가 B의 카드 UUID를 이미 알고 있다는 조건으로 고정했다. 실제 토큰을 발급하지 않으며, 세션 만료·CSRF·XSS는 별도 주제다. 404/403 선택은 정책의 문제다.',
      sources: [
        ['Spring Security · 인가', 'https://docs.spring.io/spring-security/reference/servlet/authorization/index.html'],
        ['MDN · 쿠키', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies'],
        ['JWT RFC 7519', 'https://www.rfc-editor.org/rfc/rfc7519']
      ]
    },
    scenarios: [
      { id: 'uuidOnly', label: '사고 장면 — UUID만 사용 (검사 없음)' },
      { id: 'secure', label: '안전 장면 — 소유권 검사 있음' }
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
