/* transaction.world.js: 트랜잭션 은행 — 동전 30개는 어디로 갔을까.
 *
 * 차량이 A 금고에서 동전을 싣고 B 금고로 가다 입금에 실패한다. 롤백 관리소에서
 * 결말이 갈린다: 한 트랜잭션이면 동전이 A로 되돌아가고, 출금을 먼저 커밋했으면
 * 동전은 허공에 뜬다 — 장부 기둥의 눈금(확정 합계)이 그 증거다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.TxModel;
  var makeRoute = Iso.makeRoute;

  var MAIN = makeRoute([
    [2, 16],       // 출발 도입부
    [2, 6],
    [7, 6],        // 2 이체 접수
    [16, 6],       // 3 계좌 A 금고
    [25, 6],       // 4 이체 처리소
    [33, 6],       // 5 계좌 B 금고
    [33, 14],      // corner
    [33, 21],      // 7 롤백 관리소
    [24, 21],      // corner
    [15, 21],      // 9 잔액 장부
    [8, 21]        // 종점
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'intake', 1.4),
      station(MAIN, 3, 'accountA', 1.8),
      station(MAIN, 4, 'transfer', 1.4),
      station(MAIN, 5, 'accountB', 1.8),
      station(MAIN, 7, 'settle', 2.0),
      station(MAIN, 9, 'audit', 1.6)
    ]
  };

  var STATION_TO_DISTRICT = {
    intake: 'intake', accountA: 'accountA', transfer: 'transfer',
    accountB: 'accountB', settle: 'settle', audit: 'audit'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'intake', name: '이체 접수', x: 7, y: 6, r: 3.6, color: C.steel,
      tag: 'A → B, 30',
      short: 'A와 B에 각각 100이 있습니다. 합계 200 — 이 숫자를 끝까지 지켜보세요.',
      body: '이체는 사실 두 개의 변경이다: A에서 빼기, B에 더하기. 이 지도의 유일한 질문은 "이 둘을 하나로 묶었는가"다. 오른쪽 패널의 「확정 합계」가 200에서 벗어나는 순간이 있다면, 그 장면이 바로 사고다.'
    },
    {
      id: 'accountA', name: '계좌 A 금고', x: 16, y: 6, r: 3.8, color: C.ochre,
      tag: '출금 — 30이 실린다',
      variants: {
        together: { short: '작업 장부에서만 A=70. 확정 장부는 아직 A=100입니다.', body: '트랜잭션 안의 변경은 임시다. 다른 세션이 지금 A의 잔액을 조회하면 여전히 100을 본다 — 커밋 전의 변경은 확정 잔액이 아니기 때문이다. 차량에 실린 동전 상자 3개(30)는 아직 "어디에도 확정되지 않은" 돈이다.' },
        separate: { short: '출금을 그 자리에서 커밋했습니다. 확정 장부가 이미 A=70입니다.', body: '여기서 이미 위험이 시작됐다. 출금이 혼자 확정됐으므로, 이후 무슨 일이 생기든 이 30은 자동으로는 돌아가지 않는다. 커밋은 "없던 일로 하기"의 권리를 포기하는 행위다 — 그 권리는 뒤의 입금이 성공할 때까지 들고 있어야 했다.' }
      },
      short: 'A에서 30이 빠진다.',
      body: '언제 확정하느냐가 이 지도의 갈림길이다.'
    },
    {
      id: 'transfer', name: '이체 처리소', x: 25, y: 6, r: 3.6, color: C.plum,
      tag: '입금 명령 전달',
      short: '처리소가 B 금고에 30 입금을 지시합니다. 차량은 동전을 실은 채 이동 중입니다.',
      body: '두 변경 사이의 구간이다. 현실에서는 이 사이에 무엇이든 낄 수 있다 — 제약 위반, 데드락, 네트워크 단절, 서버 재시작. "사이가 존재한다"는 사실 자체가 트랜잭션이 필요한 이유다. 사이가 없다면 묶을 것도 없다.'
    },
    {
      id: 'accountB', name: '계좌 B 금고', x: 33, y: 6, r: 3.8, color: C.brick,
      tag: '입금 실패',
      short: 'B의 DB 변경이 실패했습니다. B는 여전히 100 — 동전 30은 차량 위에 떠 있습니다.',
      body: '이 지도는 입금 실패를 고정 사건으로 둔다(교육 장면). 지금 상태를 보라: A에서는 빠졌고 B에는 안 들어갔다. 이 어정쩡한 중간 상태를 어떻게 끝내는가가 다음 정거장의 일이고, 그 선택지가 트랜잭션 유무에 따라 다르다.'
    },
    {
      id: 'settle', name: '롤백 관리소', x: 33, y: 21, r: 4.2, color: C.rose,
      tag: '결말이 갈리는 곳',
      variants: {
        together: { short: 'ROLLBACK — 임시 출금이 취소되고 동전이 A로 돌아갑니다.', body: '한 트랜잭션 안이었으므로 "없던 일로"가 가능하다. 미커밋 변경을 통째로 버리면 A는 다시 100이다. 롤백은 실패 처리 코드가 잘나서가 아니라, 확정을 미뤄뒀기 때문에 가능한 것이다. 차량의 동전 상자가 사라지는 것을 보라 — 이 동전은 애초에 확정된 적이 없다.' },
        separate: { short: '되돌릴 것이 없습니다 — 출금은 이미 별도 커밋됐습니다.', body: 'ROLLBACK은 미커밋 변경만 되돌린다. 출금은 이미 확정 장부에 들어갔으므로 이번 실패와는 별개의 과거가 됐다. 이제 선택지는 자동 복구가 아니라 보상(compensation)이다 — 반대 방향 이체를 새로 만들어야 하고, 그 보상마저 실패할 수 있다. 묶었으면 공짜였을 일이 설계 문제가 됐다.' }
      },
      short: '실패한 이체를 어떻게 끝낼 것인가.',
      body: '롤백의 힘은 커밋을 미뤄둔 만큼만 존재한다.'
    },
    {
      id: 'audit', name: '잔액 장부', x: 15, y: 21, r: 4.0, color: C.sage,
      tag: '확정 합계 검사',
      variants: {
        together: { short: 'A=100, B=100 — 합계 200. 실패한 이체의 흔적이 남지 않았습니다.', body: '원자성의 정의가 이 화면이다: 전부 성공하거나, 전부 없던 일이거나. 주의할 것 하나 — 이 지도가 보여준 것은 원자성이지 격리성이 아니다. 동시에 달리는 다른 이체와의 간섭(잠금, 격리 수준)은 별도 주제이고, DB 롤백이 외부 결제 API 호출까지 되돌려주지도 않는다.' },
        separate: { short: '합계 170. 동전 30이 어느 계좌에도 없습니다.', body: '돈이 증발한 게 아니라 "확정의 짝이 안 맞은" 것이다 — 출금만 확정되고 입금은 없던 일이 됐다. 장부 기둥이 200에 못 미치는 눈금이 그 증거다. 비교 장면을 「한 트랜잭션」으로 바꿔 같은 실패를 다시 달려 보라. 같은 오류, 다른 결말.' }
      },
      short: '합계가 200인가.',
      body: '이 숫자 하나가 설계의 성적표다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.separate || d.variants.together);
    var chars = (d.short.length + (v ? v.body.length : d.body.length));
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    intake: function (m) { /* 접수 */ },
    accountA: function (m) { M.withdraw(m); },
    transfer: function (m) { /* 이동 */ },
    accountB: function (m) { M.deposit(m); },
    settle: function (m) { M.settle(m); },
    audit: function (m) { M.audit(m); }
  };

  function nextRoute() { return null; }

  function stateBoard(m) {
    var sum = M.total(m);
    return [
      ['작업 A / B', m.A + ' / ' + m.B],
      ['확정 A / B', m.committedA + ' / ' + m.committedB],
      ['묶음', m.together ? '한 트랜잭션' : '별도 커밋', !m.together],
      ['단계', { ready: '시작', withdrawn: '출금됨', failed: '입금 실패', rolledback: '롤백 완료', partial: '부분 확정' }[m.phase] || m.phase],
      ['확정 합계', sum, sum !== 200]
    ];
  }

  function verdict(m) {
    var sum = M.total(m);
    if (m.phase === 'partial') return '합계 ' + sum + ' — 출금만 확정으로 남았다. 이제 필요한 것은 롤백이 아니라 별도의 보상 이체다.';
    if (m.phase === 'rolledback') return '합계 200 보존. 커밋을 미뤄뒀기 때문에 "없던 일로"가 가능했다.';
    if (m.phase === 'failed') return '중간 상태다: A에서는 빠졌고 B에는 안 들어갔다. 이걸 어떻게 끝내는가가 트랜잭션의 존재 이유다.';
    if (m.phase === 'withdrawn') return m.together ? '출금은 아직 임시다 — 다른 세션은 여전히 A=100을 본다.' : '출금이 이미 확정됐다 — 이 시점부터 자동 복구는 불가능하다.';
    return '두 변경을 하나로 묶었는지가 이 이체의 운명을 정한다.';
  }

  function vanInfo(m) {
    var carrying = m.phase === 'withdrawn' || m.phase === 'failed';
    return {
      text: m.cargo,
      sub: '확정 합계 ' + M.total(m),
      gauge: M.total(m) / 200,
      crates: carrying ? 3 : (m.phase === 'partial' ? 3 : 0),
      crateColor: m.phase === 'partial' ? '#b05470' : '#c2913c',
      chips: [{ color: m.together ? '#6d9068' : '#b05470' }]
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'separate') {
      return {
        tag: '확정 합계 ' + M.total(m) + ' ⚠',
        title: '동전 30이 허공에 떴다',
        short: '출금을 먼저 커밋한 대가다. 같은 입금 실패였지만 롤백할 임시 변경이 없어서, 남은 길은 보상 이체라는 새 설계 문제뿐이다.',
        body: '비교 장면을 「한 트랜잭션」으로 바꿔 같은 실패를 다시 달려 보라 — 같은 오류에서 합계 200이 지켜진다.'
      };
    }
    return {
      tag: '확정 합계 200',
      title: '실패했는데 장부가 깨끗하다',
      short: '입금 실패는 똑같이 일어났다. 다른 것은 하나 — 두 변경이 한 트랜잭션에 묶여 있어 실패가 전체 취소로 끝났다.',
      body: '이 지도가 보여준 것은 원자성까지다. 격리 수준·잠금, 그리고 DB 밖(외부 API)의 변경은 트랜잭션이 지켜주지 않는 별도 주제다.'
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

    /* 이체 접수 */
    put({ kind: 'kiosk', x: 7, y: 2.6, color: C.steel, bubble: '30',
      active: function (m, s) { return s.station === 'intake'; } });

    /* 계좌 A 금고: 임시/확정이 갈리는 금고 — 출금 중 손잡이가 돈다 */
    put({ kind: 'safe', x: 16, y: 2.2, color: C.ochre,
      spin: function (m, s) { return s.station === 'accountA'; } });

    /* 이체 처리소 */
    block(24.2, 2.6, { w: 3.0, d: 2.4, h: 2.6, color: '#cbb6d3', cols: 3, lit: C.plum, rooftop: C.plum });

    /* 계좌 B 금고 + 오류 굴뚝 */
    put({ kind: 'safe', x: 36.8, y: 3.2, color: C.brick,
      spin: function (m, s) { return s.station === 'accountB'; } });
    put({ kind: 'stack', x: 38.6, y: 8.4, color: C.brick,
      active: function (m, s) { return m.phase === 'failed' || s.station === 'accountB'; } });

    /* 롤백 관리소: 프레스(되돌리는 기계) */
    put({ kind: 'press', x: 37.4, y: 21.4, color: C.rose,
      active: function (m, s) { return s.station === 'settle'; } });

    /* 잔액 장부: 확정 합계 기둥 (가득 = 200) + A/B 진열대 */
    put({ kind: 'column', x: 14.4, y: 25.6, color: C.sage,
      fill: function (m) { return M.total(m) / 200; },
      text: function (m) { return '합계 ' + M.total(m); },
      sub: '확정 장부' });
    put({ kind: 'bench', x: 19.4, y: 24.8, color: C.sage,
      slots: function (m) {
        return [
          { color: m.committedA === 100 ? '#6d9068' : '#c2913c' },
          { color: m.committedB === 100 ? '#6d9068' : '#c2913c' }
        ];
      },
      text: function (m) { return 'A ' + m.committedA + ' · B ' + m.committedB; } });

    var spots = [[12, 12], [21, 12], [28, 12], [12, 2], [30, 2], [40, 14], [28, 25], [6, 26], [22, 16], [5, 12], [40, 25], [9, 16]];
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
    GW: 46, GH: 30,
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
      title: '트랜잭션 은행',
      subtitle: '동전 30개는 어디로 갔을까 — 커밋 · 롤백 · 원자성',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kangwon-3-pr-59.md&line=307#transaction',
      limit: '입금 실패를 고정 사건으로 둔 교육 장면이다. 같은 DB 안의 두 계좌이며, 격리 수준·잠금·실제 계좌 시스템·외부 결제 API는 재현하지 않는다. DB 롤백은 외부 HTTP 요청을 되돌리지 못한다.',
      sources: [
        ['PostgreSQL · Transactions', 'https://www.postgresql.org/docs/current/tutorial-transactions.html'],
        ['우아한형제들 · 재고 관리', 'https://techblog.woowahan.com/2709/']
      ]
    },
    scenarios: [
      { id: 'separate', label: '사고 장면 — 출금을 먼저 커밋' },
      { id: 'together', label: '안전 장면 — 한 트랜잭션으로 묶기' }
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
