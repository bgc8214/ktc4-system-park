/* ui.js: DOM 패널, 컨트롤, 내레이션 — 6개 주제 공용.
 *
 * 캔버스가 메커니즘을 보여주고 이 파일이 숫자를 보여준다. 모든 위젯은
 * Sim.state.m을 World의 훅으로 읽는다 — 숫자를 두 번 저장하지 않는다.
 */
(function (global) {
  'use strict';

  var Sim = global.Sim, World = global.World;

  var $ = function (id) { return document.getElementById(id); };

  var el = {};
  var activeDistrict = null;
  var pinnedDistrict = null;
  var lastPaint = 0;
  var flyTo = null;
  var sheetOpen = false;

  function init() {
    [
      'stage-chip', 'stage-tag', 'stage-name', 'stage-short', 'stage-body',
      'dwell', 'dwell-bar', 'dwell-hint',
      'state-list', 'verdict', 'sources', 'district-chips', 'scenario',
      'hud-phase', 'hud-scene', 'hud-cargo', 'hud-stops', 'hud-note',
      'inspector', 'btn-run', 'btn-play', 'play-glyph', 'btn-step', 'btn-reset',
      'speed', 'v-speed', 'follow', 'labels',
      'btn-about', 'about', 'about-close', 'btn-panel', 'tooltip',
      'sheet-handle', 'btn-tune', 'dock', 'dock-tune'
    ].forEach(function (id) { el[id] = $(id); });

    document.title = World.meta.title + ' — 시스템 파크';
    var brand = document.querySelector('.brand-text h1');
    var brandSub = document.querySelector('.brand-text p');
    if (brand) brand.textContent = World.meta.title;
    if (brandSub) brandSub.textContent = World.meta.subtitle;

    buildScenario();
    buildChips();
    buildSources();
    wire();
    applyResponsiveLabels();

    Sim.on(function (name, payload) {
      if (name === 'station') onStation(payload);
      if (name === 'reset') { pinnedDistrict = null; paint(true); }
    });
  }

  function buildScenario() {
    el.scenario.innerHTML = World.scenarios.map(function (s) {
      return '<option value="' + s.id + '">' + escapeHtml(s.label) + '</option>';
    }).join('');
    el.scenario.value = Sim.state.scenario;
  }

  function buildChips() {
    World.districts.forEach(function (d) {
      var b = document.createElement('button');
      b.textContent = d.name;
      b.dataset.id = d.id;
      b.addEventListener('click', function () {
        showDistrict(d, true);
        flyTo = { x: d.x, y: d.y };
      });
      el['district-chips'].appendChild(b);
    });
  }

  function buildSources() {
    var links = (World.meta.sources || []).map(function (s) {
      return '<a href="' + s[1] + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s[0]) + '</a>';
    });
    if (World.meta.origin) {
      links.unshift('<a href="' + World.meta.origin + '" target="_blank" rel="noopener noreferrer">학생 PR 질문과 멘토 답변 원문</a>');
    }
    el.sources.innerHTML = links.join('');
  }

  function wire() {
    el['btn-run'].addEventListener('click', function () { Sim.run(); paint(true); });
    el['btn-play'].addEventListener('click', function () { Sim.toggle(); paint(true); });
    el['btn-step'].addEventListener('click', function () { Sim.step(); });
    el['btn-reset'].addEventListener('click', function () { Sim.replayTour(); Sim.run(); paint(true); });

    el.scenario.addEventListener('change', function () {
      Sim.setScenario(el.scenario.value);
      Sim.run();
      paint(true);
    });

    bindRange('speed', 'v-speed', function (v) { Sim.state.speed = v; return v.toFixed(2) + '×'; });

    el.labels.addEventListener('change', function () { global.Renderer.setLabels(el.labels.checked); });

    el['btn-about'].addEventListener('click', function () { el.about.hidden = false; });
    el['about-close'].addEventListener('click', function () { el.about.hidden = true; });
    el.about.addEventListener('click', function (e) { if (e.target === el.about) el.about.hidden = true; });

    el['btn-panel'].addEventListener('click', function () {
      var hidden = el.inspector.classList.toggle('hidden');
      el['btn-panel'].setAttribute('aria-expanded', String(!hidden));
      applyResponsiveLabels();
    });
    window.addEventListener('resize', applyResponsiveLabels);

    el['sheet-handle'].addEventListener('click', function () { setSheet(!sheetOpen); });
    el['btn-tune'].addEventListener('click', function () {
      var open = el.dock.classList.toggle('tune-open');
      el['btn-tune'].setAttribute('aria-expanded', String(open));
    });
  }

  function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

  function applyResponsiveLabels() {
    var hidden = el.inspector.classList.contains('hidden');
    var narrow = isMobile();
    el['btn-panel'].textContent = narrow ? (hidden ? '패널' : '접기')
                                         : (hidden ? '패널 열기' : '패널 접기');
    el['btn-about'].textContent = narrow ? '정확성' : '정확성 · 무엇이 진짜인가';
    el['dwell-hint'].innerHTML = narrow
      ? '읽기 정차: 아래 <b>❚❚</b>를 누르면 여기 멈춰 있습니다'
      : '읽기 정차: <kbd>Space</kbd>를 누르면 여기 멈춰 있습니다';
  }

  function setSheet(open) {
    sheetOpen = open;
    el.inspector.classList.toggle('open', open);
    el['sheet-handle'].setAttribute('aria-expanded', String(open));
    if (open) el.inspector.scrollTop = 0;
  }

  function bindRange(id, out, fn) {
    var input = el[id];
    var apply = function () { el[out].textContent = fn(parseFloat(input.value)); };
    input.addEventListener('input', apply);
    apply();
  }

  /* -------------------------------------------------------------- narration */

  function onStation(station) {
    var id = station === 'done' ? null : (World.stationToDistrict[station] || station);
    activeDistrict = id;
    if (!pinnedDistrict && id) {
      var d = World.districtById[id];
      if (d) writeCard(d, station);
    }
    if (station === 'done') writeDone();
    paint(true);
  }

  function writeCard(d, station) {
    el['stage-chip'].textContent = d.chip || d.name;
    el['stage-chip'].style.color = d.color;
    el['stage-chip'].style.background = global.Iso.rgba(d.color, 0.14);
    el['stage-chip'].style.borderColor = global.Iso.rgba(d.color, 0.3);
    el['stage-tag'].textContent = d.tag;
    el['stage-name'].textContent = d.name;
    /* 시나리오에 따라 다른 글을 보여줄 수 있다 */
    var v = d.variants && d.variants[Sim.state.scenario];
    el['stage-short'].textContent = (v && v.short) || d.short;
    el['stage-body'].textContent = (v && v.body) || d.body;
  }

  function writeDone() {
    var card = World.doneCard(Sim.state.m, Sim.state.scenario);
    el['stage-chip'].textContent = '완료';
    el['stage-tag'].textContent = card.tag || '';
    el['stage-name'].textContent = card.title;
    el['stage-short'].textContent = card.short;
    el['stage-body'].textContent = card.body +
      ' 위의 「비교 장면」을 바꿔 다시 돌리면 같은 길에서 무엇이 달라지는지 볼 수 있습니다.';
  }

  function showDistrict(d, pin) {
    pinnedDistrict = pin ? d.id : null;
    writeCard(d, Sim.state.station);
    if (pin) {
      el['stage-chip'].textContent = '고정';
      el['stage-tag'].textContent = d.tag + ' · 빈 땅을 누르면 해제';
      if (isMobile()) setSheet(true);
    }
    updateChips();
  }

  function updateChips() {
    var kids = el['district-chips'].children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('on', kids[i].dataset.id === (pinnedDistrict || activeDistrict));
    }
  }

  /* ------------------------------------------------------------------ paint */

  function paint(force) {
    var now = performance.now();
    if (!force && now - lastPaint < 90) return;
    lastPaint = now;

    var s = Sim.state;

    el['play-glyph'].textContent = s.paused || s.finished ? '▶' : '❚❚';

    var dName = s.station && s.station !== 'done'
      ? (World.districtById[World.stationToDistrict[s.station] || s.station] || {}).name
      : null;
    el['hud-phase'].textContent = s.finished ? '완료' : (dName || '대기');
    var sc = World.scenarios.find(function (x) { return x.id === s.scenario; });
    el['hud-scene'].textContent = sc ? sc.label : '';
    el['hud-cargo'].textContent = World.hudCargo(s.m, s) || '—';
    el['hud-stops'].textContent = s.visited + ' / ' + totalStations();
    el['hud-note'].textContent = hudNote(s);

    var showing = s.reading && s.dwellTotal > 0 && s.dwellLeft > 0;
    el.dwell.hidden = !showing;
    if (showing) {
      el['dwell-bar'].style.width = (s.dwellLeft / s.dwellTotal * 100).toFixed(1) + '%';
    }

    paintState(s);
    updateChips();
  }

  var totalCache = 0;
  function totalStations() {
    if (!totalCache) {
      var ids = Object.create(null);
      Object.keys(World.stations).forEach(function (k) {
        World.stations[k].forEach(function (st) { ids[st.id] = 1; });
      });
      totalCache = Object.keys(ids).length;
    }
    return totalCache;
  }

  function hudNote(s) {
    if (s.finished) return '「비교 장면」을 바꿔 다시 실행해 보세요.';
    if (s.reading) return '⏸ 읽는 동안 여기 멈춰 있습니다';
    if (!s.running) return '실행을 누르면 차량이 출발합니다.';
    if (s.tourDone) return '⏩ 모든 구역을 읽었으므로 빠르게 돕니다 (속도 슬라이더로 조절)';
    return '';
  }

  function paintState(s) {
    var rows = World.stateBoard(s.m, s) || [];
    el['state-list'].innerHTML = rows.map(function (r) {
      return '<div class="stat' + (r[2] ? ' warn' : '') + '"><span class="k">' +
        escapeHtml(r[0]) + '</span><b>' + escapeHtml(String(r[1])) + '</b></div>';
    }).join('');
    el.verdict.textContent = World.verdict ? (World.verdict(s.m, s) || '') : '';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.UI = {
    init: init,
    paint: paint,
    run: function () { Sim.run(); paint(true); },
    resetAll: function () { Sim.replayTour(); Sim.run(); paint(true); },
    showDistrict: showDistrict,
    unpin: function () { pinnedDistrict = null; updateChips(); },
    activeDistrict: function () { return pinnedDistrict || activeDistrict; },
    takeFlyTo: function () { var f = flyTo; flyTo = null; return f; },
    el: el
  };
})(window);
