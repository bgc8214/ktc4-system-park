/* sim.js: 차량 한 대를 지도에 통과시키는 상태 머신 — 6개 주제가 공유하는 엔진.
 *
 * 페이싱은 템플릿 그대로다:
 *   1. 차량은 거리로 움직이고, 정류장을 지나면 그 정류장이 모델 한 단계를 실행한다.
 *   2. 어떤 구역을 처음 읽을 때는 글 길이만큼 멈추고, 두 번째부터는 짧게 쉰다.
 *   3. 읽은 기록(tour)은 리셋 밖에 산다.
 *
 * 주제별 내용은 전부 World가 공급한다. World가 구현해야 하는 계약:
 *   newModel(scenarioId)        → 새 모델 상태 m (순수 데이터)
 *   OPS[stationId](m, scenario) → 정류장이 실행하는 실제 한 단계 (m을 변경)
 *   startRoute                  → 출발 루트 이름
 *   nextRoute(cur, m, scenario) → 다음 루트 이름 | null(끝)
 *   scenarios                   → [{id, label}]  비교 장면 목록
 *   stateBoard(m) · vanInfo(m) · doneCard(m, sc) · hudCargo(m)  (ui/render가 읽음)
 */
(function (global) {
  'use strict';

  var World = global.World;
  var Iso = global.Iso;

  var BASE_SPEED = 6;

  var tour = { seen: Object.create(null), done: false };

  var state = {
    running: false,
    paused: true,
    finished: false,

    station: null,
    stationT: 0,
    stepMode: false,
    speed: 1,

    scenario: World.scenarios[0].id,
    m: null,                 // 주제 모델 상태 — World.newModel()이 만든다

    reading: false,
    dwellLeft: 0,
    dwellTotal: 0,
    tourDone: false,
    visited: 0
  };

  var van = { routeName: World.startRoute, dist: 0, dwell: 0, stationIdx: 0 };
  var seenIds = Object.create(null);   // 이 런에서 밟은 고유 정류장

  var listeners = [];
  function emit(name, payload) {
    for (var i = 0; i < listeners.length; i++) listeners[i](name, payload);
  }

  function reset() {
    state.finished = false;
    state.m = World.newModel(state.scenario);
    state.station = null;
    state.visited = 0;
    seenIds = Object.create(null);
    state.tourDone = tour.done;
    state.reading = false;
    state.dwellLeft = 0;
    state.dwellTotal = 0;
    van.routeName = World.startRoute;
    van.dist = 0;
    van.stationIdx = 0;
    van.dwell = 0;
  }

  function run() {
    reset();
    state.running = true;
    state.paused = false;
    emit('reset');
  }

  function routeOf(name) { return World.routes[name]; }

  function travelBoost() { return state.tourDone ? 2.6 : 1; }
  function dwellBoost() { return state.tourDone ? 1.4 : 1; }

  function fire(st) {
    state.station = st.id;
    state.stationT = 0;
    if (!seenIds[st.id]) { seenIds[st.id] = 1; state.visited++; }
    var op = World.OPS[st.id];
    if (op) op(state.m, state.scenario);
    emit('station', st.id);
  }

  function advanceRoute() {
    var next = World.nextRoute(van.routeName, state.m, state.scenario);
    if (!next) {
      tour.done = true;
      state.tourDone = true;
      state.finished = true;
      state.paused = true;
      state.station = 'done';
      emit('station', 'done');
      return;
    }
    van.routeName = next;
    van.dist = 0;
    van.stationIdx = 0;
    van.dwell = 0.3;
  }

  function update(dt) {
    state.stationT += dt;
    if (!state.running || state.paused || state.finished) return;

    var sdt = dt * state.speed * travelBoost();

    if (van.dwell > 0) {
      /* 정차는 읽기 시간 단위 — 속도 슬라이더만 이걸 줄일 수 있다 */
      van.dwell -= dt * state.speed;
      state.dwellLeft = Math.max(0, van.dwell);
      if (van.dwell <= 0) { state.reading = false; state.dwellTotal = 0; }
      return;
    }

    var route = routeOf(van.routeName);
    van.dist += BASE_SPEED * sdt;

    var sts = World.stations[van.routeName] || [];
    if (van.stationIdx < sts.length) {
      var st = sts[van.stationIdx];
      if (van.dist >= st.dist) {
        van.dist = st.dist;
        van.stationIdx++;
        var topic = World.stationToDistrict[st.id] || st.id;
        var firstTime = !tour.seen[topic];
        fire(st);
        if (state.finished) return;
        tour.seen[topic] = true;
        van.dwell = firstTime ? World.readSeconds(st.id) : st.dwell / dwellBoost();
        state.reading = firstTime;
        state.dwellTotal = van.dwell;
        state.dwellLeft = van.dwell;
        if (state.stepMode) { state.paused = true; state.stepMode = false; }
        return;
      }
    }

    if (van.dist >= route.total) advanceRoute();
  }

  function vanPosition() {
    return Iso.smoothAt(routeOf(van.routeName), van.dist, 0.8);
  }

  global.Sim = {
    state: state,
    van: van,
    run: run,
    reset: function () { reset(); emit('reset'); },
    replayTour: function () { tour.seen = Object.create(null); tour.done = false; },
    setScenario: function (id) { state.scenario = id; },
    update: update,
    vanPosition: vanPosition,
    on: function (fn) { listeners.push(fn); },
    play: function () { if (!state.finished) { state.paused = false; state.running = true; } },
    pause: function () { state.paused = true; },
    toggle: function () { if (state.paused) this.play(); else this.pause(); },
    step: function () {
      if (state.finished) return;
      state.running = true;
      state.stepMode = true;
      state.paused = false;
      if (van.dwell > 0) van.dwell = 0;
    }
  };
})(window);
