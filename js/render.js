/* render.js: 캔버스 2D 화가 알고리즘 렌더러 — 6개 주제가 공유한다.
 *
 * 층 순서: 하늘 → 땅 → 구역 워시 → 도로 → 발자국 있는 모든 것의 정렬 패스(x+y)
 * → 화면 공간 라벨. 랜드마크는 장식이 아니라 계기판이다 — 동적인 조각은 전부
 * 건물에 달린 콜백(value·text·active)으로 모델 상태 m을 직접 읽는다.
 * 숫자를 두 번 저장하지 않는다.
 *
 * 주제 고유의 랜드마크가 필요하면 World.customKinds = { name: fn(H, b) } 로
 * 등록한다. H = { ctx, Iso, P, m, state, t, label } 헬퍼 묶음이다.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso, World = global.World, Sim = global.Sim;
  var P = Iso.project;

  var cam = null, ctx = null, t = 0;
  var labels = [];
  var showLabels = true;
  var C = World.palette;

  function pushLabel(L) { labels.push(L); }

  /* ------------------------------------------------------------------ sky */

  function drawSky(w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#eef3f6');
    g.addColorStop(0.55, '#e9eef0');
    g.addColorStop(1, '#e3e6e2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* --------------------------------------------------------------- ground */

  function plate(inset, z) {
    return [
      P(inset, inset, z), P(World.GW - inset, inset, z),
      P(World.GW - inset, World.GH - inset, z), P(inset, World.GH - inset, z)
    ];
  }

  var GRASS = ['#8aa96a', '#93b073', '#83a463', '#9ab77c'];

  function drawGround() {
    ctx.fillStyle = 'rgba(120,124,110,0.30)';
    Iso.poly(ctx, plate(-0.9, -0.35));
    ctx.fillStyle = '#93b073';
    Iso.poly(ctx, plate(0, 0));
    for (var gx = 1; gx < World.GW; gx += 2) {
      for (var gy = 1; gy < World.GH; gy += 2) {
        var n = Iso.hash2(gx, gy, 17);
        if (n < 0.45) continue;
        ctx.fillStyle = GRASS[(n * 4) | 0];
        Iso.disc(ctx, gx + n, gy + (1 - n), 0, 0.7 + n * 0.5);
      }
    }
    ctx.strokeStyle = 'rgba(74,69,64,0.28)';
    ctx.lineWidth = 1.4;
    Iso.polyLine(ctx, plate(0, 0), true);
  }

  function drawZones(activeId) {
    for (var i = 0; i < World.districts.length; i++) {
      var d = World.districts[i];
      var on = d.id === activeId;
      ctx.fillStyle = Iso.rgba(d.color, on ? 0.16 : 0.055);
      Iso.disc(ctx, d.x, d.y, 0.01, d.r);
      if (on) {
        ctx.strokeStyle = Iso.rgba(d.color, 0.5);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        var p = P(d.x, d.y, 0.01);
        ctx.ellipse(p.x, p.y, d.r * Iso.TW * 1.41421, d.r * Iso.TH * 1.41421, 0, 0, 6.2832);
        ctx.stroke();
      }
    }
  }

  /* ---------------------------------------------------------------- roads */

  function roadQuad(a, b, width, dz) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len * width / 2, ny = dx / len * width / 2;
    var za = (a.z || 0) + (dz || 0), zb = (b.z || 0) + (dz || 0);
    Iso.poly(ctx, [
      P(a.x + nx, a.y + ny, za), P(b.x + nx, b.y + ny, zb),
      P(b.x - nx, b.y - ny, zb), P(a.x - nx, a.y - ny, za)
    ]);
  }

  function drawRoute(route, opts) {
    var width = opts.width || 2.4, i, s;
    ctx.fillStyle = opts.shoulder || C.road;
    for (i = 0; i < route.segs.length; i++) {
      s = route.segs[i];
      roadQuad(s.a, s.b, width + 0.5, 0);
      Iso.disc(ctx, s.a.x, s.a.y, s.a.z || 0, (width + 0.5) / 2);
    }
    var last = route.pts[route.pts.length - 1];
    Iso.disc(ctx, last.x, last.y, last.z || 0, (width + 0.5) / 2);

    ctx.fillStyle = opts.surface || C.roadTop;
    for (i = 0; i < route.segs.length; i++) {
      s = route.segs[i];
      roadQuad(s.a, s.b, width, 0.005);
      Iso.disc(ctx, s.a.x, s.a.y, (s.a.z || 0) + 0.005, width / 2);
    }
    Iso.disc(ctx, last.x, last.y, (last.z || 0) + 0.005, width / 2);

    ctx.strokeStyle = opts.dash || 'rgba(96,90,78,0.35)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    for (i = 0; i < route.pts.length; i++) {
      var p = P(route.pts[i].x, route.pts[i].y, (route.pts[i].z || 0) + 0.01);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRoads() {
    Object.keys(World.routes).forEach(function (name) {
      drawRoute(World.routes[name], (World.routeStyles || {})[name] || {});
    });
  }

  /* ------------------------------------------------- 랜드마크 라이브러리
     동적인 조각은 건물 레코드의 콜백으로 모델을 읽는다:
       b.fill(m)   → 0..1   (bin·column의 차오르는 정도)
       b.text(m)   → string (곁들일 라벨. null이면 라벨 없음)
       b.active(state) → bool (기계가 도는 중인가)                       */

  function val(fn, dflt) {
    var m = Sim.state.m;
    try { return fn ? fn(m, Sim.state) : dflt; } catch (e) { return dflt; }
  }

  function landmarkLabel(b, text, sub) {
    if (!text) return;
    pushLabel({
      x: b.x, y: b.y, z: b.labelZ || 2.8, lift: 12,
      text: text, sub: sub || null,
      color: '#5c564c', tint: b.color, size: 11.5, mono: true, pri: 1
    });
  }

  var KIND = {
    gatePost: function (b) {
      Iso.box(ctx, { x: b.x - 0.28, y: b.y - 0.28, z: 0, w: 0.56, d: 0.56, h: 3.1, color: b.color });
    },
    gateBeam: function (b) {
      Iso.box(ctx, { x: b.x - 0.3, y: b.y - 1.85, z: 3.1, w: 0.6, d: 3.7, h: 0.42, color: Iso.mix(b.color, '#ffffff', 0.25) });
    },

    /* 차단기: b.on(m,state)가 참일 때만 팔이 있고, 정차 중에 열린다 */
    toll: function (b) {
      var on = val(b.on, true);
      var active = Sim.state.station === b.which;
      var ax = b.axis === 'x' ? 1 : 0, ay = b.axis === 'x' ? 0 : 1;
      Iso.box(ctx, { x: b.x - ax * 0.4 - ay * 2.1, y: b.y - ay * 0.4 - ax * 2.1, z: 0, w: 0.8 + ay * 0.4, d: 0.8 + ax * 0.4, h: 2.2, color: b.color });
      Iso.box(ctx, { x: b.x - ax * 0.4 + ay * 1.5, y: b.y - ay * 0.4 + ax * 1.5, z: 0, w: 0.8 + ay * 0.4, d: 0.8 + ax * 0.4, h: 1.6, color: Iso.mix(b.color, '#ffffff', 0.2) });
      if (on) {
        var lift = active ? Math.min(1, Sim.state.stationT * 1.4) : 0;
        Iso.orientedBox(ctx, {
          x: b.x, y: b.y, z: 1.5 + lift * 1.4,
          hx: ay, hy: ax, len: 3.2 * (1 - lift * 0.55), wid: 0.16, h: 0.16,
          color: '#e4643f'
        });
      }
    },

    /* 통: fill(m)만큼 내용물이 쌓이고 text(m)를 곁에 단다 */
    bin: function (b) {
      var frac = Math.max(0, Math.min(1, val(b.fill, 0)));
      Iso.box(ctx, { x: b.x - 1.1, y: b.y - 0.9, z: 0, w: 2.2, d: 1.8, h: 1.3, color: Iso.mix(b.color, '#6a655c', 0.55) });
      if (frac > 0.02) {
        Iso.box(ctx, {
          x: b.x - 0.95, y: b.y - 0.75, z: 1.3, w: 1.9, d: 1.5, h: 0.15 + frac * 0.85,
          color: b.fillColor || '#d8cfbe', edge: false
        });
      }
      landmarkLabel(b, val(b.text, null));
    },

    /* 기둥 계기: fill(m)만큼 차오른다 */
    column: function (b) {
      var frac = Math.max(0, Math.min(1, val(b.fill, 0)));
      Iso.cylinder(ctx, { x: b.x, y: b.y, z: 0, r: 0.85, h: 4.4, color: '#d8cfbe', ring: 0.3 });
      if (frac > 0.01) {
        Iso.cylinder(ctx, { x: b.x, y: b.y, z: 0.05, r: 0.62, h: 0.1 + frac * 4.2, color: b.color });
      }
      landmarkLabel(b, val(b.text, null), b.sub);
    },

    kiosk: function (b) {
      Iso.box(ctx, { x: b.x - 1.0, y: b.y - 0.8, z: 0, w: 2.0, d: 1.6, h: 1.9, color: Iso.mix(b.color, '#ffffff', 0.35) });
      Iso.gableRoof(ctx, { x: b.x - 1.15, y: b.y - 0.95, z: 1.9, w: 2.3, d: 1.9, h: 0.6, color: b.color });
      if (val(b.active, false)) {
        var p = P(b.x + 0.4, b.y - 0.4, 3.4);
        ctx.fillStyle = '#fffdf7';
        ctx.strokeStyle = Iso.rgba(b.color, 0.9);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 6, 16, 10, 0, 0, 6.2832);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4a4540';
        ctx.font = '600 11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.bubble || '?', p.x, p.y - 2);
      }
    },

    /* 드럼통 무리: count(m)개가 서 있다 (저장소·DB) */
    drums: function (b) {
      var n = Math.max(0, Math.min(6, val(b.count, 6)));
      for (var i = 0; i < n; i++) {
        var col = i % 3, row = (i / 3) | 0;
        Iso.cylinder(ctx, {
          x: b.x - 1.4 + col * 1.4, y: b.y - 0.7 + row * 1.4, z: 0,
          r: 0.62, h: 1.5 + (i % 2) * 0.4, color: i % 2 ? Iso.mix(b.color, '#ffffff', 0.25) : Iso.mix(b.color, '#ffffff', 0.45), ring: 0.4
        });
      }
      landmarkLabel(b, val(b.text, null));
    },

    dish: function (b) {
      Iso.cylinder(ctx, { x: b.x, y: b.y, z: 0, r: 0.4, h: 1.6, color: '#b6b0a0' });
      var p = P(b.x, b.y, 1.6);
      ctx.fillStyle = Iso.shade(b.color, 1.02);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 10, 20, 11, -0.5, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,69,64,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    },

    stack: function (b) {
      Iso.cylinder(ctx, { x: b.x, y: b.y, z: 0, r: 0.7, h: 5.2, color: '#cbbfae', ring: 0.25 });
      var busy = val(b.active, false);
      for (var i = 0; i < 4; i++) {
        var ph = (t * 0.35 + i * 0.25) % 1;
        var p = P(b.x, b.y, 5.2 + ph * 3.4);
        ctx.fillStyle = Iso.rgba('#ffffff', (busy ? 0.5 : 0.24) * (1 - ph));
        ctx.beginPath();
        ctx.arc(p.x - ph * 12, p.y, 5 + ph * 13, 0, 6.2832);
        ctx.fill();
      }
    },

    press: function (b) {
      Iso.box(ctx, { x: b.x - 1.3, y: b.y - 1.0, z: 0, w: 2.6, d: 2.0, h: 0.5, color: Iso.mix(b.color, '#ffffff', 0.3) });
      var busy = val(b.active, false);
      var lift = busy ? 0.7 + Math.abs(Math.sin(t * 2.4)) * 0.9 : 1.3;
      Iso.box(ctx, { x: b.x - 1.0, y: b.y - 0.8, z: 0.5 + lift, w: 2.0, d: 1.6, h: 0.6, color: b.color });
      Iso.box(ctx, { x: b.x - 0.18, y: b.y - 0.18, z: 0.5, w: 0.36, d: 0.36, h: 2.6, color: Iso.mix(b.color, '#6a655c', 0.35) });
    },

    crane: function (b) {
      Iso.box(ctx, { x: b.x - 0.3, y: b.y - 0.3, z: 0, w: 0.6, d: 0.6, h: 4.6, color: '#a9b6bf' });
      Iso.box(ctx, { x: b.x - 0.2, y: b.y - 2.6, z: 4.6, w: 0.4, d: 5.4, h: 0.34, color: '#93a3ad' });
      var busy = val(b.active, false);
      var drop = busy ? 1.6 + Math.sin(t * 2) * 1.2 : 1.2;
      var p1 = P(b.x, b.y + 1.9, 4.6), p2 = P(b.x, b.y + 1.9, 4.6 - drop);
      ctx.strokeStyle = '#6d675c';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      Iso.box(ctx, { x: b.x - 0.24, y: b.y + 1.66, z: 4.6 - drop - 0.4, w: 0.48, d: 0.48, h: 0.4, color: b.color });
    },

    containers: function (b) {
      var cols = ['#7fa6bd', '#93b4c6', '#6f96ad'];
      for (var i = 0; i < 5; i++) {
        var cx = b.x + (i % 3) * 1.3, cy = b.y + ((i / 3) | 0) * 1.1;
        Iso.box(ctx, { x: cx, y: cy, z: (i === 4 ? 0.8 : 0), w: 1.2, d: 0.9, h: 0.8, color: cols[i % 3] });
      }
    },

    /* 금고문: b.spin(state)이 참일 때만 손잡이가 돈다 (세션·잠금 표현) */
    safe: function (b) {
      Iso.box(ctx, { x: b.x - 2.0, y: b.y - 1.5, z: 0, w: 4.0, d: 3.0, h: 2.8, color: Iso.mix(b.color, '#ffffff', 0.35),
        panels: { cols: 5, seed: 4, color: Iso.mix(b.color, '#ffffff', 0.6) } });
      var FACE_ANG = Math.atan2(Iso.TH, Iso.TW);
      var FACE_U = Math.hypot(Iso.TW, Iso.TH);
      var p = P(b.x, b.y + 1.5, 1.4);
      var rx = 1.0 * FACE_U, ry = 1.1 * Iso.TZ;
      ctx.fillStyle = Iso.shade(b.color, 0.95);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, FACE_ANG, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,52,64,0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      var spin = val(b.spin, false) ? t * 1.1 : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(FACE_ANG);
      ctx.strokeStyle = 'rgba(60,52,64,0.55)';
      ctx.lineWidth = 1.8;
      for (var i = 0; i < 4; i++) {
        var a = spin + i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * rx * 0.7, -Math.sin(a) * ry * 0.7);
        ctx.lineTo(Math.cos(a) * rx * 0.7, Math.sin(a) * ry * 0.7);
        ctx.stroke();
      }
      ctx.restore();
    },

    /* 진열대: slots(m) = [{label, color}] — 상태 색이 칠해진 칸들 */
    bench: function (b) {
      var slots = val(b.slots, []);
      for (var i = 0; i < slots.length; i++) {
        var bx = b.x - (slots.length - 1) * 0.8 + i * 1.6, by = b.y;
        Iso.box(ctx, { x: bx - 0.6, y: by - 0.5, z: 0, w: 1.2, d: 1.0, h: 0.9, color: Iso.mix(b.color, '#ffffff', 0.4) });
        Iso.box(ctx, {
          x: bx - 0.45, y: by - 0.38, z: 0.9, w: 0.9, d: 0.76, h: 0.28,
          color: slots[i].color || '#d9d3c6', edge: true
        });
      }
      landmarkLabel(b, val(b.text, null));
    }
  };

  /* -------------------------------------------------------- small props  */

  function drawLamp(p) {
    Iso.cylinder(ctx, { x: p.x, y: p.y, z: 0, r: 0.13, h: 2.7, color: '#9c968a' });
    Iso.box(ctx, { x: p.x - 0.28, y: p.y - 0.22, z: 2.7, w: 0.56, d: 0.44, h: 0.18, color: '#c8c2b2' });
  }

  function drawTree(p) {
    var n = Iso.hash2(p.x, p.y, p.seed || 1);
    Iso.cylinder(ctx, { x: p.x, y: p.y, z: 0, r: 0.18, h: 0.9 + n * 0.4, color: '#8a7358' });
    var r = 0.85 + n * 0.5;
    ctx.fillStyle = n < 0.5 ? '#5f8a52' : '#6d9068';
    Iso.disc(ctx, p.x, p.y, 1.5 + n * 0.8, r);
    ctx.fillStyle = Iso.rgba('#ffffff', 0.16);
    Iso.disc(ctx, p.x - r * 0.25, p.y - r * 0.25, 1.62 + n * 0.8, r * 0.6);
  }

  /* ----------------------------------------------------------------- 차량
     World.vanInfo(m, state)가 옆면을 정한다:
       gauge  0..1|null   옆면 게이지
       crates n           짐칸 상자 수 (최대 8)
       crateColor         상자 색
       chips  [{color}]   옆면 상태 칸들 (최대 4)                          */

  function drawVan(v) {
    var s = Sim.state;
    var info = World.vanInfo(s.m, s) || {};
    var hx = v.dx, hy = v.dy;
    var z = v.z || 0;

    ctx.fillStyle = 'rgba(80,76,66,0.22)';
    Iso.disc(ctx, v.x, v.y, z + 0.01, 1.05);

    Iso.orientedBox(ctx, { x: v.x, y: v.y, z: z + 0.16, hx: hx, hy: hy, len: 2.5, wid: 1.25, h: 0.34, color: '#5c6a72' });
    Iso.orientedBox(ctx, { x: v.x - hx * 0.35, y: v.y - hy * 0.35, z: z + 0.5, hx: hx, hy: hy, len: 1.7, wid: 1.2, h: 1.0, color: '#eae6da' });
    Iso.orientedBox(ctx, { x: v.x + hx * 0.85, y: v.y + hy * 0.85, z: z + 0.5, hx: hx, hy: hy, len: 0.85, wid: 1.1, h: 0.76, color: '#b8503f' });

    var px = -hy, py = hx;
    var side = (px + py) > 0 ? 1 : -1;

    var chips = info.chips || [];
    for (var i = 0; i < Math.min(4, chips.length); i++) {
      var off = -0.9 + i * 0.44;
      Iso.orientedBox(ctx, {
        x: v.x - hx * 0.35 + hx * off + px * side * 0.63,
        y: v.y - hy * 0.35 + hy * off + py * side * 0.63,
        z: z + 0.78, hx: hx, hy: hy, len: 0.34, wid: 0.05, h: 0.5,
        color: chips[i].color, edge: false
      });
    }

    if (info.gauge != null) {
      var frac = Math.max(0, Math.min(1, info.gauge));
      var GLEN = 1.5;
      var gx = v.x - hx * 0.35 + px * side * 0.63;
      var gy = v.y - hy * 0.35 + py * side * 0.63;
      Iso.orientedBox(ctx, { x: gx, y: gy, z: z + 0.56, hx: hx, hy: hy, len: GLEN, wid: 0.03, h: 0.16, color: '#6d675c', edge: false });
      if (frac > 0) {
        Iso.orientedBox(ctx, {
          x: gx - hx * (GLEN * (1 - frac) / 2), y: gy - hy * (GLEN * (1 - frac) / 2),
          z: z + 0.575, hx: hx, hy: hy, len: Math.max(0.07, GLEN * frac - 0.04),
          wid: 0.05, h: 0.13,
          color: frac > 0.66 ? '#e4643f' : frac > 0.33 ? '#e8b34a' : '#7fc06a', edge: false
        });
      }
    }

    var crates = Math.max(0, Math.min(8, info.crates || 0));
    for (var k = 0; k < crates; k++) {
      var row = k % 2, col = (k / 2) | 0;
      Iso.orientedBox(ctx, {
        x: v.x - hx * (0.9 - col * 0.42) + px * (row ? 0.28 : -0.28),
        y: v.y - hy * (0.9 - col * 0.42) + py * (row ? 0.28 : -0.28),
        z: z + 1.5, hx: hx, hy: hy, len: 0.38, wid: 0.4, h: 0.34,
        color: info.crateColor || (k % 3 === 0 ? '#c2913c' : k % 3 === 1 ? '#a8926a' : '#b8a577')
      });
    }

    ctx.fillStyle = '#3f3a34';
    [[0.8, 0.5], [0.8, -0.5], [-0.8, 0.5], [-0.8, -0.5]].forEach(function (o) {
      Iso.disc(ctx, v.x + hx * o[0] + px * o[1], v.y + hy * o[0] + py * o[1], z + 0.14, 0.22);
    });
  }

  /* -------------------------------------------------------------- labels  */

  function drawLabels() {
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    ctx.textBaseline = 'middle';
    labels.sort(function (a, b) { return (b.pri || 0) - (a.pri || 0); });

    var placed = [];
    var i;
    for (i = 0; i < labels.length; i++) {
      var L = labels[i];
      var p = P(L.x, L.y, L.z);
      L.ax = p.x * cam.scale + cam.ox;
      L.ay = p.y * cam.scale + cam.oy;
      L.px = (L.size || 12) * Math.min(1.15, Math.max(0.92, cam.scale));
      ctx.font = (L.bold ? '600 ' : '') + L.px + 'px ' + fontOf(L);
      var wpx = ctx.measureText(L.text).width;
      var subw = L.sub ? ctx.measureText(L.sub).width * 0.85 : 0;
      L.boxW = Math.max(wpx, subw) + 16;
      L.boxH = L.sub ? L.px * 2.4 : L.px * 1.75;
      L.sy = L.lift ? L.ay - L.lift - L.boxH / 2 : L.ay;
      for (var tries = 0; tries < 10 && overlaps(L, placed); tries++) {
        L.sy -= L.boxH * 0.92;
      }
      placed.push(L);
    }
    for (i = 0; i < labels.length; i++) drawPlate(labels[i]);
  }

  function fontOf(L) {
    return L.mono
      ? 'ui-monospace, Menlo, Consolas, monospace'
      : '"Apple SD Gothic Neo", "Noto Sans KR", Georgia, sans-serif';
  }

  function overlaps(L, placed) {
    for (var i = 0; i < placed.length; i++) {
      var o = placed[i];
      if (Math.abs(L.ax - o.ax) < (L.boxW + o.boxW) / 2 + 2 &&
          Math.abs(L.sy - o.sy) < (L.boxH + o.boxH) / 2 + 2) return true;
    }
    return false;
  }

  function drawPlate(L) {
    var ax = L.ax, ay = L.ay, sy = L.sy, size = L.px;
    var boxW = L.boxW, boxH = L.boxH;
    ctx.textAlign = 'center';
    ctx.font = (L.bold ? '600 ' : '') + size + 'px ' + fontOf(L);
    if (L.lift) {
      ctx.strokeStyle = Iso.rgba(L.tint || '#6e6250', 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ax, sy + boxH / 2);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.fillStyle = Iso.rgba(L.tint || '#6e6250', 0.85);
      ctx.beginPath();
      ctx.arc(ax, ay, 2.4, 0, 6.2832);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(96,84,66,0.26)';
    roundRect(ax - boxW / 2 + 1, sy - boxH / 2 + 2.5, boxW, boxH, 5);
    ctx.fill();
    ctx.fillStyle = L.tint ? Iso.mix('#fffdf7', L.tint, 0.14) : '#fffdf7';
    roundRect(ax - boxW / 2, sy - boxH / 2, boxW, boxH, 5);
    ctx.fill();
    ctx.strokeStyle = Iso.rgba(L.tint || '#6e6250', 0.85);
    ctx.lineWidth = L.bold ? 1.7 : 1.2;
    roundRect(ax - boxW / 2, sy - boxH / 2, boxW, boxH, 5);
    ctx.stroke();
    ctx.fillStyle = L.color || '#3a352e';
    ctx.fillText(L.text, ax, sy + (L.sub ? -size * 0.42 : 0));
    if (L.sub) {
      ctx.font = (size * 0.85) + 'px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillStyle = 'rgba(88,80,68,0.75)';
      ctx.fillText(L.sub, ax, sy + size * 0.62);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- draw  */

  function key(o) { return o.x + o.y + ((o.w || 0) + (o.d || 0)) * 0.5; }

  function draw(canvas, camera, time, activeDistrict, hoverDistrict) {
    ctx = canvas.getContext('2d');
    cam = camera;
    t = time;
    labels.length = 0;

    var w = canvas.width / cam.dpr, h = canvas.height / cam.dpr;
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    drawSky(w, h);

    ctx.setTransform(cam.scale * cam.dpr, 0, 0, cam.scale * cam.dpr,
                     cam.ox * cam.dpr, cam.oy * cam.dpr);

    drawGround();
    drawZones(activeDistrict);
    drawRoads();

    var items = [];
    var i, s = Sim.state;
    var kinds = Object.assign({}, KIND, World.customKinds || {});

    for (i = 0; i < World.buildings.length; i++) {
      var b = World.buildings[i];
      if (b.kind && kinds[b.kind]) items.push({ k: b.x + b.y, f: kinds[b.kind], a: b });
      else items.push({ k: key(b), f: null, a: b });
    }
    for (i = 0; i < World.props.length; i++) {
      var pr = World.props[i];
      items.push({ k: pr.x + pr.y, f: pr.kind === 'tree' ? drawTree : drawLamp, a: pr });
    }
    /* 주제가 동적으로 만들어내는 지형지물 (확정 카드 상자 등) */
    if (World.dynamicItems) {
      World.dynamicItems(s.m, s).forEach(function (d) {
        items.push({ k: d.x + d.y, f: kinds[d.kind], a: d });
      });
    }
    var v = Sim.vanPosition();
    items.push({ k: v.x + v.y + 0.2, f: drawVan, a: v });

    items.sort(function (p, q) { return p.k - q.k; });
    var H = { ctx: null, Iso: Iso, P: P };
    for (i = 0; i < items.length; i++) {
      if (items[i].f) { items[i].f(items[i].a); continue; }
      var o = items[i].a;
      Iso.box(ctx, o);
      if (o.roof) {
        Iso.gableRoof(ctx, {
          x: o.x - 0.08, y: o.y - 0.08, z: o.z + o.h,
          w: o.w + 0.16, d: o.d + 0.16, h: o.roofH || 0.45, color: o.roof
        });
      } else if (o.rooftop) {
        var m2 = 0.5;
        Iso.box(ctx, {
          x: o.x + m2, y: o.y + m2, z: o.z + o.h, w: Math.max(0.8, o.w - m2 * 2),
          d: Math.max(0.8, o.d - m2 * 2), h: 0.4, color: Iso.mix(o.rooftop, '#ffffff', 0.35)
        });
      }
    }

    if (showLabels) {
      var declutter = cam.scale < 0.34;
      for (i = 0; i < World.districts.length; i++) {
        var d = World.districts[i];
        var isActive = d.id === activeDistrict || d.id === hoverDistrict;
        if (declutter && !isActive) continue;
        var sub = (World.districtSub ? World.districtSub(d, s.m, s) : null) || (isActive ? d.tag : null);
        pushLabel({
          x: d.x, y: d.y, z: 0, lift: isActive ? 34 : 26,
          text: d.name, sub: sub,
          color: isActive ? d.color : '#3d3831',
          tint: d.color,
          size: isActive ? 15.5 : 13, bold: isActive,
          pri: isActive ? 2 : 1
        });
      }
    }

    if (s.running) {
      var info = World.vanInfo(s.m, s) || {};
      pushLabel({
        x: v.x, y: v.y, z: (v.z || 0) + 2.4, lift: 8,
        text: info.text || '', sub: info.sub || null,
        color: '#3d3831', tint: '#8a8272', size: 13, bold: true, mono: true,
        pri: 3
      });
    }

    drawLabels();
  }

  global.Renderer = {
    draw: draw,
    setLabels: function (v) { showLabels = v; }
  };
})(window);
