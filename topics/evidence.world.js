/* evidence.world.js: AI 근거 공장 — 그럴듯한 초안이 사실이 되려면.
 *
 * 검문소에서 길이 갈라진다: 두 검사(존재·일치)를 통과한 카드만 출고장으로,
 * 못 넘은 카드는 보류장으로 — 재질문이 아니라 근거 보완이 필요한 곳이다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;
  var M = global.EvidenceModel;
  var makeRoute = Iso.makeRoute;

  var MAIN = makeRoute([
    [2, 18],       // 출발 도입부
    [2, 8],
    [7, 8],        // 2 수집 창고
    [16, 8],       // 3 후보 압축기
    [25, 8],       // 4 LLM 초안소
    [33, 8],       // corner
    [33, 15],      // 6 GitHub 기록소
    [33, 21]       // 7 근거 검문소
  ]);

  /* 통과: 출고장으로 */
  var PASS = makeRoute([
    [33, 21],
    [33, 26],
    [24, 26],      // 2 카드 출고장
    [15, 26]
  ]);

  /* 차단: 보류장으로 빠지는 옆길 */
  var HOLD = makeRoute([
    [33, 21],
    [26, 21],      // 1
    [20, 21],      // 2 보류장
    [15, 22],
    [15, 26]
  ]);

  function station(route, idx, id, dwell) {
    return { dist: route.cum[idx], id: id, dwell: dwell == null ? 0.9 : dwell };
  }

  var STATIONS = {
    main: [
      station(MAIN, 2, 'collect', 1.6),
      station(MAIN, 3, 'compress', 1.6),
      station(MAIN, 4, 'generate', 1.8),
      station(MAIN, 6, 'lookup', 1.8),
      station(MAIN, 7, 'gate', 2.2)
    ],
    pass: [
      station(PASS, 2, 'ship', 1.8)
    ],
    hold: [
      station(HOLD, 2, 'ship', 1.8)
    ]
  };

  /* pass와 hold의 종점은 같은 글(출고 심사 결과)을 쓴다 — 두 번 읽히지 않게 */
  var STATION_TO_DISTRICT = {
    collect: 'collect', compress: 'compress', generate: 'generate',
    lookup: 'lookup', gate: 'gate', ship: 'ship'
  };

  var C = {
    steel: '#4a7a9b', violet: '#6f63a8', ochre: '#c2913c', rose: '#b05470',
    sage: '#6d9068', teal: '#3f8a86', orange: '#c07a3c', brick: '#a85a44',
    plum: '#8b5f96', road: '#c9c4b6', roadTop: '#d8d3c6'
  };

  var DISTRICTS = [
    {
      id: 'collect', name: '수집 창고', x: 7, y: 8, r: 3.6, color: C.steel,
      tag: 'GitHub API의 일',
      short: '실제 기록(커밋 47개)을 수집합니다. 수집은 LLM 호출이 아닙니다.',
      body: '이 공장에서 무엇이 모델의 일이고 무엇이 아닌지부터 갈라두자. 저장소를 읽어 오는 것은 GitHub API의 일이고, FastAPI 서버가 있다고 해서 그게 LLM인 것도 아니다. 패널의 「LLM 호출」 계수기가 이 정거장에서 움직이지 않는 것을 확인하라 — 이 계수기는 이 지도의 끝까지 딱 한 번 오른다.'
    },
    {
      id: 'compress', name: '후보 압축기', x: 16, y: 8, r: 3.6, color: C.violet,
      tag: '규칙 — LLM 0',
      short: '규칙 로직이 47개 기록을 후보 5개로 좁힙니다. 여기도 모델은 없습니다.',
      body: '압축을 규칙으로 하는 이유는 두 가지다: 비용이 0이고, 같은 입력이면 같은 후보가 나와 재현된다. 모델의 자리는 이 다음 — 좁혀진 재료로 문장을 쓰는 일이다. 비싸고 비결정적인 도구는 가장 좁은 자리에만 쓴다는 원칙이 이 벨트의 배치다.'
    },
    {
      id: 'generate', name: 'LLM 초안소', x: 25, y: 8, r: 3.8, color: C.plum,
      tag: '주장이 태어나는 곳',
      variants: {
        missing: { short: '모델이 초안과 함께 SHA ffff00을 근거로 붙였습니다 — 이 저장소에 없는 번호입니다.', body: '문장은 자연스럽고 SHA는 형식이 완벽하다. 그래서 화면만 봐서는 못 잡는다. 지금 차량에 실린 것은 사실이 아니라 "사실이라는 주장"이고, 이 구분이 공장 전체의 존재 이유다. 초안소는 검증하지 않는다 — 만든 쪽이 검증까지 하면 "모델에게 다시 물어보자"가 답이 되어버리기 때문이다.' },
        mismatch: { short: '모델이 실존하는 SHA a1b2c3에 "결제 기능 구현"이라는 주장을 붙였습니다 — 그 커밋의 실제 변경은 로그인 수정입니다.', body: '이쪽이 더 교묘한 실패다. SHA는 진짜라서 존재 검사는 통과한다. 틀린 것은 주장과 실제 변경의 연결이다. "SHA가 있으면 사실"이라는 검증은 이 카드를 통과시킨다 — 그래서 검문소의 검사가 두 개여야 한다.' },
        valid: { short: '모델이 실존 SHA a1b2c3에 실제 변경과 일치하는 주장을 붙였습니다.', body: '정상 케이스다. 단, 이 지도의 "정상"은 저장소·작성자·관련성 확인까지 충족했다고 가정한 사례라는 것을 기억하라. 잘 되는 경우조차 초안은 여전히 주장이고, 확정은 검문소를 지나야 나온다.' }
      },
      short: '모델이 문장과 근거 SHA를 제안한다.',
      body: '아직 검증된 사실이 아니다.'
    },
    {
      id: 'lookup', name: 'GitHub 기록소', x: 33, y: 15, r: 3.8, color: C.orange,
      tag: '권위 있는 기록 재조회',
      variants: {
        missing: { short: '이 저장소에서 SHA ffff00을 찾지 못했습니다.', body: '대조는 결정적 재조회다 — 모델의 자신감이 아니라 기록의 존재가 판정한다. 주의 하나: 현실의 조회 실패에는 없는 SHA 외에도 인증 만료·권한·네트워크 오류가 있다. 그 오류들을 전부 "없는 SHA"로 뭉개면 멀쩡한 근거가 억울하게 죽는다 — 실패의 종류를 구분하는 것도 검증기의 일이다.' },
        mismatch: { short: '커밋을 찾았습니다. 그런데 실제 변경 내용은 "로그인 오류 수정"입니다.', body: '존재 검사는 통과했고, 이제 두 번째 질문이 남았다: 이 커밋이 정말 그 주장을 뒷받침하는가. 기록소의 드럼에 남은 실제 변경과 차량에 실린 주장을 나란히 놓으면 어긋남이 보인다. SHA의 존재는 서술 전체의 사실성을 보증하지 않는다.' },
        valid: { short: '커밋을 찾았고, 실제 변경이 주장과 부합합니다.', body: '존재도 내용도 맞았다. 이 지도는 여기에 저장소·작성자·관련성 확인까지 이미 충족됐다고 가정하고 있다 — 실전 검증기는 그 조건들을 각각 명시적으로 확인해야 한다.' }
      },
      short: '주장된 SHA를 실제 기록과 대조한다.',
      body: '판정의 근거는 기록이다.'
    },
    {
      id: 'gate', name: '근거 검문소', x: 33, y: 21, r: 4.2, color: C.brick,
      tag: '두 검사 — 존재 · 일치',
      variants: {
        missing: { short: '존재 ✗ — 차단기가 내려갑니다. 재질문으로는 사실이 증명되지 않습니다.', body: '여기서 가장 위험한 유혹이 "모델에게 다시 물어보자"다. 재질문은 더 그럴듯한 문장을 만들 뿐 없는 커밋을 만들어내지 못한다. 차단된 카드에 필요한 것은 더 나은 문장이 아니라 실재하는 근거다. 차량이 출고장이 아닌 보류장 길로 꺾이는 것을 보라.' },
        mismatch: { short: '존재 ✓ · 일치 ✗ — 한 검사만 통과한 카드도 차단됩니다.', body: '검사가 하나뿐이었다면 이 카드는 출고됐을 것이다. "SHA 존재"와 "주장-변경 일치"는 다른 질문이고, 확정은 둘 다 통과해야 나온다. 검증을 코드(결정적 대조)에 두고 모델 밖에 두는 이유가 이 장면에 있다.' },
        valid: { short: '존재 ✓ · 일치 ✓ — 차단기가 올라가고 출고장 길이 열립니다.', body: '두 검사를 다 통과했다. 통과가 "이 카드의 모든 문장이 참"이라는 뜻은 아니다 — 이 지도의 검사 범위(존재·일치) 안에서 근거가 섰다는 뜻이다. 검증의 범위를 정직하게 말하는 것까지가 검증이다.' }
      },
      short: '존재와 일치, 두 검사를 모두 통과해야 출고된다.',
      body: '판정은 모델이 아니라 코드가 한다.'
    },
    {
      id: 'ship', name: '출고 심사 결과', x: 22, y: 24, r: 4.4, color: C.sage,
      tag: '확정 또는 보류',
      variants: {
        missing: { short: '보류장에 내려놓습니다. 근거를 보완해야 다시 심사받을 수 있습니다.', body: '보류는 실패가 아니라 방어가 작동한 기록이다. 보류장이 늘 비어 있는 공장이라면 오히려 검문소를 의심해야 한다. 위의 「비교 장면」을 「주장 불일치」와 「근거 충족」으로 바꿔, 같은 공장이 세 종류의 초안을 어떻게 다르게 처리하는지 보라.' },
        mismatch: { short: '보류장행 — SHA가 진짜여도 주장이 다르면 카드는 나가지 못합니다.', body: '이 장면이 검증기 설계의 핵심 시험지다. 존재 검사만 있는 검증기는 이 카드를 출고시킨다. 사용자는 면접에서 "결제 기능을 구현했다"고 말하게 되고, 면접관이 커밋을 열면 로그인 수정이 나온다. 그 자리를 지키는 것이 두 번째 검사다.' },
        valid: { short: '카드가 출고장에 적재됩니다 — 근거 링크가 붙은 채로.', body: '출고된 카드의 가치는 문장이 아니라 링크에 있다. 읽는 사람이 3초 안에 원본 커밋을 열어 확인할 수 있다는 것 — 그것이 이 공장이 파는 신뢰다.' }
      },
      short: '검문 결과에 따라 카드의 최종 자리가 정해진다.',
      body: '보류는 방어의 기록이고, 출고는 링크가 붙은 신뢰다.'
    }
  ];

  var DISTRICT_BY_ID = {};
  DISTRICTS.forEach(function (d) { DISTRICT_BY_ID[d.id] = d; });

  function readSeconds(stationId) {
    var d = DISTRICT_BY_ID[STATION_TO_DISTRICT[stationId] || stationId];
    if (!d) return 9;
    var v = d.variants && (d.variants.missing || d.variants.valid);
    var chars = (d.short.length + (v ? v.body.length : d.body.length));
    return Math.min(24, Math.max(9, chars / 16 + 4));
  }

  var OPS = {
    collect: function (m) { M.collect(m); },
    compress: function (m) { M.compress(m); },
    generate: function (m) { M.generate(m); },
    lookup: function (m) { M.verify(m); },
    gate: function (m) { M.ship(m); },
    ship: function (m) { /* 적재/보류 — 판정은 검문소에서 끝났다 */ }
  };

  function nextRoute(cur, m) {
    if (cur === 'main') return m.shipped ? 'pass' : 'hold';
    return null;
  }

  function stateBoard(m) {
    return [
      ['수집 커밋', m.collected || '—'],
      ['후보', m.candidates || '—'],
      ['LLM 호출', m.llm],
      ['주장 SHA', m.draft ? m.draft.sha : '—', m.draft && m.draft.sha === 'ffff00'],
      ['존재 검사', m.checks ? (m.checks.exists ? '통과' : '미발견') : '대조 전', m.checks && !m.checks.exists],
      ['일치 검사', m.checks ? (m.checks.context ? '통과' : '불일치') : '대조 전', m.checks && !m.checks.context],
      ['카드 확정', m.shipped ? '1' : '0', m.blocked]
    ];
  }

  function verdict(m) {
    if (m.shipped) return '두 검사를 통과한 카드만 나갔다 — 검증의 범위(존재·일치) 안에서의 확정이다.';
    if (m.blocked) return m.checks.exists
      ? 'SHA는 실존하지만 주장이 실제 변경과 다르다. 존재 검사 하나로는 이 카드를 못 막는다.'
      : '이 저장소에 없는 SHA다. 필요한 것은 재질문이 아니라 실재하는 근거다.';
    if (m.draft) return '지금 실린 것은 사실이 아니라 "사실이라는 주장"이다. 판정은 기록소의 대조가 한다.';
    if (m.candidates) return '여기까지 LLM 호출 0회 — 수집과 압축은 규칙의 일이다.';
    return '그럴듯함과 사실 사이에 검문소가 있다.';
  }

  function vanInfo(m) {
    var chips = [];
    if (m.draft) chips.push({ color: m.draft.sha === 'ffff00' ? '#b05470' : '#c2913c' });
    if (m.checks) {
      chips.push({ color: m.checks.exists ? '#6d9068' : '#b05470' });
      chips.push({ color: m.checks.context ? '#6d9068' : '#b05470' });
    }
    return {
      text: m.cargo,
      sub: m.draft ? 'SHA ' + m.draft.sha : 'LLM ' + m.llm + '회',
      gauge: null,
      crates: m.shipped ? 1 : (m.draft ? 1 : 0),
      crateColor: m.shipped ? '#6d9068' : (m.blocked ? '#b05470' : '#c2913c'),
      chips: chips
    };
  }

  function doneCard(m, scenario) {
    if (scenario === 'valid') {
      return {
        tag: '확정 1 · LLM 1회',
        title: '근거 링크가 붙은 카드가 나갔다',
        short: '수집과 압축은 규칙이, 문장은 모델이, 판정은 코드가 했다 — 각자의 자리가 지켜졌을 때만 이 카드의 링크는 신뢰가 된다.',
        body: '「비교 장면」을 사고 장면 둘로 바꿔 보라. 없는 SHA는 존재 검사에서, 진짜 SHA에 붙은 틀린 주장은 일치 검사에서 각각 걸린다.'
      };
    }
    if (scenario === 'mismatch') {
      return {
        tag: '보류 · 존재 ✓ 일치 ✗',
        title: 'SHA가 진짜라서 더 위험한 카드였다',
        short: '존재 검사만 있는 검증기는 이 카드를 통과시킨다. 주장과 실제 변경의 일치까지 봐야 "SHA는 있는데 이야기가 다른" 초안이 걸린다.',
        body: '검증기를 시험할 때는 없는 SHA만이 아니라 "있는 SHA + 틀린 주장"을 반드시 케이스에 넣어야 한다는 것 — 이 지도의 한 줄 결론이다.'
      };
    }
    return {
      tag: '보류 · 존재 ✗',
      title: '차단이 이 공장의 정상 동작이다',
      short: '그럴듯한 문장과 형식이 완벽한 SHA — 화면으로는 못 잡는 초안을 기록과의 대조가 잡았다. 재질문은 답이 아니다: 모델은 없는 커밋을 만들어내지 못한다.',
      body: '보류장이 차 있는 것은 방어가 작동한 기록이다. 「비교 장면」을 바꿔 존재 검사를 통과하는 두 경우(불일치·정상)도 확인해 보라.'
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

    /* 수집 창고: 크레인 */
    put({ kind: 'crane', x: 6.4, y: 3.4, color: C.steel,
      active: function (m, s) { return s.station === 'collect'; } });

    /* 후보 압축기: 프레스 */
    put({ kind: 'press', x: 16, y: 3.6, color: C.violet,
      active: function (m, s) { return s.station === 'compress'; } });

    /* LLM 초안소: 말풍선 키오스크 + 호출 계수 기둥 */
    put({ kind: 'kiosk', x: 25, y: 3.6, color: C.plum, bubble: '✎',
      active: function (m, s) { return s.station === 'generate'; } });
    put({ kind: 'column', x: 28.6, y: 4.2, color: C.plum,
      fill: function (m) { return m.llm; },
      text: function (m) { return 'LLM ' + m.llm + '회'; } });

    /* GitHub 기록소: 드럼 = 권위 있는 기록 */
    put({ kind: 'drums', x: 38.2, y: 14.2, color: C.orange,
      count: function () { return 6; },
      text: function (m) { return m.checks ? (m.checks.exists ? 'a1b2c3 발견' : 'ffff00 없음') : '실제 기록'; } });

    /* 근거 검문소: 차단기 — 항상 존재한다(판정 결과에 따라 열리고 닫힘) */
    put({ kind: 'toll', x: 33, y: 21, color: C.brick, which: 'gate', axis: 'y',
      on: function (m) { return !m.shipped; } });

    /* 카드 출고장 */
    put({ kind: 'containers', x: 21.6, y: 29.2, color: C.sage });
    put({ kind: 'bench', x: 26.6, y: 29.6, color: C.sage,
      slots: function (m) { return [{ color: m.shipped ? '#6d9068' : '#d9d3c6' }]; },
      text: function (m) { return m.shipped ? '확정 1' : '출고장'; } });

    /* 보류장: 통 — 차단된 카드가 쌓인다 */
    put({ kind: 'bin', x: 20, y: 17.4, color: C.brick,
      fill: function (m) { return m.blocked ? 0.5 : 0; },
      fillColor: '#d8cfbe',
      text: function (m) { return m.blocked ? '보류 1' : '보류장'; } });

    var spots = [[11, 3], [21, 13], [11, 13], [28, 13], [39, 8], [40, 25], [8, 22], [8, 27], [28, 17], [38, 28], [12, 18], [4, 13]];
    spots.forEach(function (sp, i) {
      var n = Iso.hash2(sp[0], sp[1], 3);
      var near = [MAIN, PASS, HOLD].some(function (r) {
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
    routes: { main: MAIN, pass: PASS, hold: HOLD },
    routeStyles: { hold: { width: 2.0, surface: '#ddd2c4', dash: 'rgba(168,90,68,0.5)' } },
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
      title: 'AI 근거 공장',
      subtitle: '그럴듯한 초안의 근거 검사 — 후보 압축 · 생성 · SHA 검증',
      origin: 'https://bgc8214.github.io/ktc4-review-learning/?source=kyungpook-1-pr-4.md&line=51#evidence',
      limit: '세 장면은 미리 만든 사례이지 일반 자연어 검증 알고리즘이 아니다. 정상 장면은 저장소·작성자·관련성 확인까지 충족했다고 가정한다. 조회 실패에는 없는 SHA 외에 인증·권한·네트워크 오류도 있으므로 HTTP 오류 전부를 없는 SHA로 취급하면 안 된다.',
      sources: [
        ['GitHub · Get a commit', 'https://docs.github.com/en/rest/commits/commits#get-a-commit'],
        ['토스 · 테스트 전략', 'https://toss.tech/article/test-strategy-server']
      ]
    },
    scenarios: [
      { id: 'missing', label: '사고 장면 ① — 존재하지 않는 SHA' },
      { id: 'mismatch', label: '사고 장면 ② — SHA는 있지만 주장 불일치' },
      { id: 'valid', label: '정상 장면 — 근거 조건 충족' }
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
