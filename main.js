/* =========================================================
   main.js — 화면 만들기, 지도, 펜툴 핸들
   내용은 data.js에서 고치세요. 이 파일은 보통 손대지 않아도 됩니다.
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, root = document) => root.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const val = (o) => (o && typeof o === "object" ? o.value : o);
  const isEst = (o) => !!(o && typeof o === "object" && o.estimated);
  const COLOR = { person: "var(--yellow)", phone: "var(--pink)" };
  const NO_GUIDE = "var(--ink-3)";
  const f1 = (n) => n.toFixed(1);
  const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;
  const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  const EST = `<span class="est">${esc(TEXT.est)}</span>`;
  const MAX_ACTUAL = Math.max(...POINTS.map((p) => val(p.actual) || 1));
  const ratioOf = (p) => { const a = val(p.actual) || 1; return (val(p.felt) || a) / a; };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* =========================================================
     지도: 단순화한 스탠리파크 (SVG 좌표)
     ========================================================= */
  const VIEW = [150, 120, 770, 760];
  // 경로: 대여점 → 01 입구 → 둘레길 → 02 Burrard 근처 → 공원 가운데(숲 사이)를 가로질러 공원 밖으로 → 03 차도 → 대여점
  const ROUTE = [[720, 645], [690, 595], [650, 545], [690, 470], [760, 390], [720, 300], [600, 235], [505, 222],
    [462, 262], [478, 350], [525, 445], [548, 540], [575, 628], [640, 668]];
  const PARK = [[640, 575], [720, 480], [800, 385], [755, 270], [610, 200], [468, 180], [320, 225], [232, 342],
    [228, 475], [283, 590], [372, 655], [470, 640], [560, 610]];
  const CITY = [[300, 900], [372, 690], [470, 672], [560, 642], [650, 605], [740, 512], [900, 470], [900, 900]];

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  }
  function sampleClosed(pts, n) {
    const out = [], N = pts.length;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < n; k++) out.push(catmull(pts[(i - 1 + N) % N], pts[i], pts[(i + 1) % N], pts[(i + 2) % N], k / n));
    }
    out.push(out[0]);
    return out;
  }
  const smoothClosedPath = (pts) => "M" + sampleClosed(pts, 12).map(pt).join(" L") + " Z";

  const SAMPLES = sampleClosed(ROUTE, 60);
  const CUM = [0];
  for (let i = 1; i < SAMPLES.length; i++) {
    CUM.push(CUM[i - 1] + Math.hypot(SAMPLES[i][0] - SAMPLES[i - 1][0], SAMPLES[i][1] - SAMPLES[i - 1][1]));
  }
  const LOOP = CUM[CUM.length - 1];
  function P(s) {
    s = ((s % LOOP) + LOOP) % LOOP;
    let lo = 0, hi = CUM.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] <= s) lo = m; else hi = m; }
    const t = (s - CUM[lo]) / (CUM[hi] - CUM[lo] || 1);
    return [lerp(SAMPLES[lo][0], SAMPLES[hi][0], t), lerp(SAMPLES[lo][1], SAMPLES[hi][1], t)];
  }
  function T(s) { const a = P(s - 2), b = P(s + 2); return norm([b[0] - a[0], b[1] - a[1]]); }
  const CENTER = ROUTE.reduce((c, p) => [c[0] + p[0] / ROUTE.length, c[1] + p[1] / ROUTE.length], [0, 0]);
  function outward(s) {
    const t = T(s), p = P(s);
    let n = [-t[1], t[0]];
    if (n[0] * (p[0] - CENTER[0]) + n[1] * (p[1] - CENTER[1]) < 0) n = [-n[0], -n[1]];
    return n;
  }

  /* ---------- 지형 (얇은 검정 외곽선 + 단색 면) ---------- */
  const OUT = { stroke: "var(--ink)", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" };
  const withOut = (a) => Object.assign({}, OUT, a);
  // 물결 테두리 덩어리 (나무)
  function scallop(cx, cy, r, n = 9, rot = 0) {
    let d = "";
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) d += `M${f1(x)} ${f1(y)}`;
      else d += ` A${f1(r * 0.36)} ${f1(r * 0.36)} 0 0 1 ${f1(x)} ${f1(y)}`;
    }
    return d + " Z";
  }
  function star(x, y, r) {
    const q = r * 0.28;
    return `M${x} ${y - r} L${x + q} ${y - q} L${x + r} ${y} L${x + q} ${y + q} L${x} ${y + r} L${x - q} ${y + q} L${x - r} ${y} L${x - q} ${y - q} Z`;
  }
  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const near = (p, pts, d) => pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < d);
  const PARK_C = PARK.reduce((c, p) => [c[0] + p[0] / PARK.length, c[1] + p[1] / PARK.length], [0, 0]);
  const TREES = [[430, 330, 34], [515, 290, 30], [600, 330, 36], [372, 410, 30], [462, 405, 38], [556, 412, 32],
    [646, 392, 28], [412, 500, 32], [508, 495, 36], [600, 478, 30], [342, 318, 24], [690, 330, 22], [470, 560, 22], [300, 470, 20]];
  // 공원을 가로지르는 길 위에 있는 나무는 길 옆으로 비켜 놓는다
  const TREES_CLEAR = TREES.map(([x, y, r]) => {
    const q = SAMPLES.reduce((m, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(m[0] - x, m[1] - y) ? p : m), SAMPLES[0]);
    const d = Math.hypot(q[0] - x, q[1] - y), need = r + 14;
    if (d >= need) return [x, y, r];
    const v = norm(d > 0.1 ? [x - q[0], y - q[1]] : [1, 0]);
    return [q[0] + v[0] * need, q[1] + v[1] * need, r];
  });
  const TREE_FILLS = ["var(--tree-1)", "var(--tree-2)", "var(--tree-3)"];
  const BLOCK_FILLS = ["var(--blk-1)", "var(--blk-2)", "var(--blk-3)", "var(--blk-4)", "#ffffff"];
  // 차도 지점(scene: "road") 주변의 넓은 도로
  const ROAD_P = POINTS.find((p) => p.scene === "road");
  const ROAD_PTS = [];
  if (ROAD_P) {
    const s = ROAD_P.at * LOOP, half = LOOP * 0.035 + 70;
    for (let x = s - half; x <= s + half; x += 8) ROAD_PTS.push(P(x));
  }
  const SHOP = add(SAMPLES[0], [8, 52]);
  const FORK_P = POINTS.find((p) => p.scene === "fork");
  let FORK = null;
  if (FORK_P) {
    const s = FORK_P.at * LOOP, q = P(s), t = T(s);
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    const cand = [1.75, -1.75].map((a) => rot(t, a));
    const dir = cand.find((d) => inPoly(add(q, d, 80), PARK)) || cand[0];
    const bend = rot(dir, dir[0] < 0 ? 0.35 : -0.35);
    FORK = [q, add(q, dir, 30), add(add(q, dir, 30), bend, 40), add(add(q, dir, 30), bend, 72)];
  }

  function drawTerrain(svg) {
    const [vx, vy, vw, vh] = VIEW;
    el("rect", { x: vx - 1500, y: vy - 1500, width: vw + 3000, height: vh + 3000, fill: "var(--sea)" }, svg);
    [[230, 215], [800, 250], [215, 610], [880, 600], [600, 150], [330, 820]].forEach(([x, y]) =>
      el("path", withOut({ d: `M${x} ${y} q7 -6 14 0 t14 0 t14 0`, fill: "none" }), svg));
    // 시내 + 건물 블록
    el("path", withOut({ d: "M" + CITY.map(pt).join(" L") + " L900 1400 L300 1400 Z", fill: "var(--land)" }), svg);
    let n = 0;
    for (let gx = -6; gx < 16; gx++) {
      for (let gy = -2; gy < 10; gy++) {
        const c = [300 + gx * 46 + gy * 22, 560 + gy * 40 - gx * 10];
        if (!inPoly(c, CITY) || near(c, SAMPLES, 30) || near(c, ROAD_PTS, 34) || Math.hypot(c[0] - SHOP[0], c[1] - SHOP[1]) < 40) continue;
        if (![[18, 0], [-18, 0], [0, 16], [0, -16]].every((o) => inPoly(add(c, o), CITY))) continue;
        el("rect", withOut({ x: f1(c[0] - 16), y: f1(c[1] - 13), width: 32, height: 26, rx: 2, fill: BLOCK_FILLS[(n++ * 7 + gx * 3 + 50) % BLOCK_FILLS.length], transform: `rotate(-14 ${f1(c[0])} ${f1(c[1])})` }), svg);
      }
    }
    // 공원 땅 + 둘레길 + 숲
    el("path", withOut({ d: smoothClosedPath(PARK), fill: "var(--grass)" }), svg);
    const wall = smoothClosedPath(PARK.map((p) => [PARK_C[0] + (p[0] - PARK_C[0]) * 0.93, PARK_C[1] + (p[1] - PARK_C[1]) * 0.93]));
    el("path", { d: wall, fill: "none", stroke: "var(--ink)", "stroke-width": 12 }, svg);
    el("path", { d: wall, fill: "none", stroke: "var(--sand)", "stroke-width": 9.6 }, svg);
    if (FORK) {
      const fd = "M" + FORK.map(pt).join(" L");
      el("path", { d: fd, fill: "none", stroke: "var(--ink)", "stroke-width": 12, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      el("path", { d: fd, fill: "none", stroke: "var(--sand)", "stroke-width": 9.6, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    }
    TREES_CLEAR.forEach(([x, y, r], i) => el("path", withOut({ d: scallop(x, y, r, 8 + (i % 3), i * 0.7), fill: TREE_FILLS[i % 3] }), svg));
    // 넓은 차도와 차
    if (ROAD_PTS.length > 1) {
      const rd = "M" + ROAD_PTS.map(pt).join(" L");
      el("path", { d: rd, fill: "none", stroke: "var(--ink)", "stroke-width": 34, "stroke-linejoin": "round" }, svg);
      el("path", { d: rd, fill: "none", stroke: "var(--road)", "stroke-width": 31.6, "stroke-linejoin": "round" }, svg);
      el("path", { d: rd, fill: "none", stroke: "#fff", "stroke-width": 2, "stroke-dasharray": "10 9" }, svg);
      [0.06, 0.2, 0.33, 0.46, 0.6, 0.73, 0.87].forEach((f, i) => {
        const k = Math.floor(f * (ROAD_PTS.length - 2)), a = ROAD_PTS[k], b = ROAD_PTS[k + 1];
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const nrm = norm([-(b[1] - a[1]), b[0] - a[0]]), c = add(a, nrm, i % 2 ? 7.5 : -7.5);
        const car = el("g", { transform: `translate(${f1(c[0])} ${f1(c[1])}) rotate(${f1(ang)})` }, svg);
        el("rect", withOut({ x: -11, y: -5.5, width: 22, height: 11, rx: 3, fill: ["var(--car-1)", "var(--car-2)", "var(--car-3)"][i % 3] }), car);
        el("rect", withOut({ x: 1, y: -3.5, width: 6, height: 7, rx: 1, fill: "#fff" }), car);
      });
    }
    // 자전거 대여점
    const shop = el("g", { transform: `translate(${f1(SHOP[0])} ${f1(SHOP[1])})` }, svg);
    el("rect", withOut({ x: -20, y: -14, width: 40, height: 26, fill: "var(--blk-2)" }), shop);
    el("path", withOut({ d: "M-25 -13 L0 -30 L25 -13 Z", fill: "var(--car-1)" }), shop);
    el("rect", withOut({ x: -6, y: -2, width: 12, height: 14, fill: "#fff" }), shop);
    [-13, 13].forEach((x) => el("circle", withOut({ cx: x, cy: 4, r: 4.5, fill: "#fff" }), shop));
    [[190, 175, 7], [885, 300, 6], [180, 830, 6], [890, 790, 7]].forEach(([x, y, r]) => el("path", withOut({ d: star(x, y, r), fill: "var(--blk-2)" }), svg));
  }

  /* ---------- 지도 하나 만들기 ----------
     지형은 확대하면 같이 커지고, 경로 선·번호·글자·자전거·화살표 머리는 화면에서 늘 같은 크기 */
  function buildMap(svg, focus, opt = {}) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    drawTerrain(svg);
    let known = SAMPLES;
    if (opt.cut != null) {
      // 아직 이어지지 않은 길: 공간에 있는 길(모래색)만 보이고, 잉크 선은 끝점에서 끊김
      known = SAMPLES.filter((_, i) => CUM[i] <= opt.cut).concat([P(opt.cut)]);
      const rest = "M" + [P(opt.cut)].concat(SAMPLES.filter((_, i) => CUM[i] > opt.cut)).map(pt).join(" L");
      el("path", { d: rest, fill: "none", stroke: "var(--ink)", "stroke-width": 7, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
      el("path", { d: rest, fill: "none", stroke: "var(--sand)", "stroke-width": 4.6, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
    }
    const route = "M" + known.map(pt).join(" L");
    el("path", { d: route, fill: "none", stroke: "#fff", "stroke-width": 7, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
    el("path", { d: route, fill: "none", stroke: "var(--ink)", "stroke-width": 3, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
    const arrowLayer = el("g", {}, svg);

    const fixed = []; // 화면 크기에 고정되는 것들 { g, p, rot }
    const pin = (p, cls, parent = svg) => { const g = el("g", { class: cls }, parent); const f = { g, p, rot: 0 }; fixed.push(f); return f; };
    const label = (g, x, y, t, anchor, cls) => { const e = el("text", { x, y, "text-anchor": anchor, class: cls }, g); e.textContent = t; return e; };
    let box = VIEW.slice(), k = 1;
    const place = (f) => {
      f.g.setAttribute("transform", `translate(${f1(f.p[0])} ${f1(f.p[1])}) rotate(${f1(f.rot)}) scale(${k.toFixed(4)})`);
      // 말 라벨은 화면 밖으로 나가지 않게 안쪽으로 민다
      if (f.span) {
        const m = 10 * k, lx = f.p[0] + f.span[0] * k, rx = f.p[0] + f.span[1] * k;
        let dx = 0;
        if (rx > box[0] + box[2] - m) dx = box[0] + box[2] - m - rx;
        if (lx + dx < box[0] + m) dx = box[0] + m - lx;
        f.inner.setAttribute("transform", `translate(${f1(dx / k)} 0)`);
      }
    };

    [[205, 690, "ENGLISH BAY"], [845, 452, "COAL HARBOUR"], [500, 160, "BURRARD INLET"]].forEach(([x, y, t]) =>
      label(pin([x, y], "m-water").g, 0, 0, t, "middle", "m-water-t"));

    const start = pin(SAMPLES[0], "m-start").g;
    el("rect", { x: -6, y: -6, width: 12, height: 12, class: "m-start-sq" }, start);
    label(start, 12, 22, TEXT.start, "start", "m-name");

    POINTS.forEach((p) => {
      const s = p.at * LOOP, o = outward(s), q = P(s);
      const g = pin(q, "m-point" + (focus && focus !== p ? " dim" : "")).g;
      el("circle", { r: 14, class: "m-dot" }, g);
      label(g, 0, 4.5, p.id, "middle", "m-no");
      const anchor = o[0] > 0.35 ? "start" : o[0] < -0.35 ? "end" : "middle";
      label(g, o[0] * 24, o[1] * 24 + 5, p.name, anchor, "m-name");
    });

    // 자전거 그림 (주인공과 앞서 가는 사람이 같이 씀)
    const bikeGlyph = (parent) => {
      const flip = el("g", {}, parent);
      [-12, 12].forEach((x) => el("circle", { cx: x, cy: 0, r: 9, fill: "#fff", stroke: "var(--ink)", "stroke-width": 2.4 }, flip));
      el("path", { d: "M-12 0 L-3 -12 L9 -12 L12 0 M-3 -12 L0 0 L-12 0 M9 -12 L7 -17 L12 -17 M-3 -12 L-5 -16 M-4 -16 L2 -27", fill: "none", stroke: "var(--ink)", "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }, flip);
      el("circle", { cx: 3, cy: -32, r: 5, fill: "var(--ink)" }, flip);
      return flip;
    };
    const faceAt = (flip, s) => flip.setAttribute("transform", `translate(0 -10)${T(s)[0] < -0.05 ? " scale(-1 1)" : ""}`);

    // 주인공 자전거 (말 없이 이동만)
    const bikeF = pin(SAMPLES[0], "m-bike");
    if (!focus) bikeF.g.setAttribute("visibility", "hidden"); // 전체 지도에서는 출발 전
    const flip = bikeGlyph(bikeF.g);

    const hooks = { box: [], bike: [] };
    const map = {
      svg, arrowLayer,
      pin, place,
      k: () => k,
      on(type, fn) { hooks[type].push(fn); },
      setBox(b) {
        box = b;
        svg.setAttribute("viewBox", b.map(f1).join(" "));
        k = b[2] / (svg.clientWidth || 600);
        fixed.forEach(place);
        hooks.box.forEach((fn) => fn(k));
      },
      setBike(s) {
        bikeF.p = P(s);
        faceAt(flip, s);
        place(bikeF);
        hooks.bike.forEach((fn) => fn(s));
      },
      // 화면 비율에 맞춘 상자
      fit(b) {
        const a = (svg.clientWidth || 1) / (svg.clientHeight || 1);
        let [x, y, w, h] = b;
        const cx = x + w / 2, cy = y + h / 2;
        if (w / h < a) w = h * a; else h = w / a;
        return [cx - w / 2, cy - h / 2, w, h];
      },

      /* 안내 화살표: 선은 지도 좌표 위에, 머리와 끝 라벨은 화면 크기 고정.
         set(f) = 그려진 비율 (끝까지 그려지면 라벨이 나옴) */
      arrow(pts, color, o = {}) {
        const g = el("g", { class: "m-arrow" }, arrowLayer);
        const w = o.wide ? 9 : o.thin ? 4 : 5.5;
        const halo = el("path", { fill: "none", stroke: "#fff", "stroke-width": w + 4, "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, g);
        const line = el("path", { fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, g);
        if (o.dashed) { line.setAttribute("stroke-dasharray", "2 11"); halo.setAttribute("stroke-dasharray", "2 11"); }
        const head = pin(pts[pts.length - 1], "m-head");
        el("path", { d: `M${f1(w + 8)} 0 L-4 ${f1(-(w + 4))} L-4 ${f1(w + 4)} Z`, fill: color, stroke: "var(--ink)", "stroke-width": 1.2, "stroke-linejoin": "round" }, head.g);
        let tag = null;
        if (o.label) {
          tag = pin(pts[pts.length - 1], "m-say");
          const tw = o.label.length * 13 + 20;
          const end = pts[pts.length - 1], prev = pts[Math.max(0, pts.length - 4)], d = norm([end[0] - prev[0], end[1] - prev[1]]);
          // 화살표가 가는 방향 앞쪽에, 오른쪽이면 오른쪽으로
          const x = d[0] > 0.3 ? 18 : d[0] < -0.3 ? -18 - tw : -tw / 2;
          const y = d[1] > 0.5 ? 16 : d[1] < -0.5 ? -46 : -15;
          tag.inner = el("g", {}, tag.g);
          tag.span = [x, x + tw];
          el("rect", { x: f1(x), y: f1(y), width: f1(tw), height: 28, rx: 14, class: "m-say-bg", stroke: color }, tag.inner);
          label(tag.inner, f1(x + tw / 2), f1(y + 19), o.label, "middle", "m-say-t");
        }
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const total = cum[cum.length - 1] || 1;
        return {
          set(f) {
            f = clamp(f);
            const want = total * f, out = [pts[0]];
            let i = 1;
            for (; i < pts.length && cum[i] <= want; i++) out.push(pts[i]);
            if (i < pts.length) { const t = (want - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]); }
            const d = out.length > 1 ? "M" + out.map(pt).join(" L") : "";
            line.setAttribute("d", d); halo.setAttribute("d", d);
            g.setAttribute("visibility", f > 0.01 ? "visible" : "hidden");
            const a = out[out.length - 1], b = out[Math.max(0, out.length - 2)];
            head.p = a;
            head.rot = (Math.atan2(a[1] - b[1], a[0] - b[0]) * 180) / Math.PI;
            head.g.setAttribute("visibility", f > 0.06 ? "visible" : "hidden");
            place(head);
            if (tag) tag.g.setAttribute("visibility", f >= 1 ? "visible" : "hidden");
          }
        };
      },

      /* 다시 이어준 사람: woman / couple / cyclist(앞서 가는 자전거) */
      person(kind, s) {
        const q = P(s), side = outward(s);
        const f = pin(kind === "cyclist" ? q : add(q, side, -26), "m-person");
        f.g.setAttribute("opacity", 0);
        let flipC = null;
        const body = (x) => {
          el("circle", { cx: x, cy: -21, r: 4.6, fill: "var(--ink)" }, f.g);
          el("path", { d: `M${x - 6} 0 L${x} -16 L${x + 6} 0 Z`, fill: "#fff", stroke: "var(--ink)", "stroke-width": 1.8, "stroke-linejoin": "round" }, f.g);
        };
        if (kind === "woman") body(0);
        else if (kind === "couple") { body(-6); body(7); }
        else flipC = bikeGlyph(f.g);
        return {
          show(o) { f.g.setAttribute("opacity", o.toFixed(2)); },
          at(s2) { if (s2 == null || !flipC) return; f.p = P(s2); faceAt(flipC, s2); place(f); },
          moveTo(q2) { f.p = q2; place(f); }
        };
      }
    };
    return map;
  }

  /* =========================================================
     체감 곡선
     A–B 빨간 직선 = 실제 시간 (모든 지점이 같은 축척: 1분 = 같은 길이)
     왼쪽 핸들은 고정, 오른쪽 핸들만 당김. 곡선 길이 ÷ 직선 길이 × 실제 = 체감.
     곡선이 화면 높이를 넘어야 할 만큼 길어지면 꼭대기가 고리처럼 꼬인다.
     ========================================================= */
  const DIR = [Math.cos((100 * Math.PI) / 180), -Math.sin((100 * Math.PI) / 180)];
  const bz = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]); };

  const ring = (ro, ri) => `M${ro} 0 A${ro} ${ro} 0 1 0 ${-ro} 0 A${ro} ${ro} 0 1 0 ${ro} 0 Z M${ri} 0 A${ri} ${ri} 0 1 0 ${-ri} 0 A${ri} ${ri} 0 1 0 ${ri} 0 Z`;
  const polyD = (pts) => "M" + pts.map(pt).join(" L");
  const topOf = (pts) => pts.reduce((m, q) => (q[1] < m[1] ? q : m), pts[0]);
  const loopRho = (H, chord10) => clamp(Math.min(H * 0.05, chord10 * 0.07), 8, 44);

  // o.gain: 손잡이를 당긴 만큼보다 곡선이 더 부풀게 (화면 안에서 충분히 길게)
  // o.topLimit: 곡선 꼭대기가 넘지 않을 높이 / o.knobTop: 손잡이가 갈 수 있는 가장 위 / o.band: 고리용 띠 높이
  function feltModel(A, B, o) {
    const chord = B[0] - A[0], rho = o.rho, gain = o.gain || 1;
    const c1 = [A[0] + 0.2 * chord, A[1] - 0.08 * chord];
    const rest = [B[0] - (0.2 * chord) / gain, B[1] - (0.08 * chord) / gain];
    const c2Of = (k) => [B[0] + (k[0] - B[0]) * gain, B[1] + (k[1] - B[1]) * gain];

    // n = 고리 수. 고리는 곡선 가운데(길이 기준 22~78%)에만 생긴다
    // k1 = 왼쪽 핸들 길이 비율, kr = 고리 크기 비율 (곡선이 펴질 때 둘 다 0으로 줄어듦)
    function shape(knob, n, k1 = 1, kr = 1) {
      const c2 = c2Of(knob), cc = [lerp(A[0], c1[0], k1), lerp(A[1], c1[1], k1)], N = 360, base = [];
      for (let i = 0; i <= N; i++) base.push(bz(A, cc, c2, B, i / N));
      const cum = [0];
      for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
      const tot = cum[N] || 1, pts = [];
      let len = 0;
      for (let i = 0; i <= N; i++) {
        let q = base[i];
        if (n > 0.001) {
          const u = clamp((cum[i] / tot - 0.22) / 0.56);
          if (u > 0 && u < 1) {
            const a = base[i - 1], b = base[i + 1], t = norm([b[0] - a[0], b[1] - a[1]]), nv = [-t[1], t[0]];
            const w = kr * Math.pow(Math.sin(Math.PI * u), 2), th = 2 * Math.PI * n * u;
            q = [q[0] + w * rho * (-Math.sin(th) * t[0] + (1 - Math.cos(th)) * nv[0]),
              q[1] + w * rho * (-Math.sin(th) * t[1] + (1 - Math.cos(th)) * nv[1])];
          }
        }
        if (i) len += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
        pts.push(q);
      }
      return { pts, len, ratio: len / chord };
    }
    const RESTR = shape(rest, 0).ratio;

    // 손잡이가 위로 갈 수 있는 끝 = 곡선 꼭대기가 topLimit에 닿거나, 손잡이가 고리 띠에 닿는 곳
    const knobAt = (m) => add(B, DIR, m);
    let mMax = isFinite(o.knobTop) ? Math.max(0, (A[1] - o.knobTop - o.band) / -DIR[1]) : chord * 20;
    if (topOf(shape(knobAt(mMax), 0).pts)[1] < o.topLimit) {
      let lo = 0, hi = mMax;
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (topOf(shape(knobAt(m), 0).pts)[1] < o.topLimit) hi = m; else lo = m; }
      mMax = lo;
    }
    const capKnob = knobAt(mMax), capY = capKnob[1];

    // 기록된 체감 비율이 되는 모양: 먼저 위로 부풀고, 모자라면 고리
    function ghost(r) {
      if (r <= RESTR + 0.02) return { knob: rest.slice(), n: 0 };
      if (shape(capKnob, 0).ratio >= r) {
        let lo = 0, hi = mMax;
        for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (shape(knobAt(m), 0).ratio < r) lo = m; else hi = m; }
        return { knob: knobAt(lo), n: 0 };
      }
      let lo = 0, hi = 120;
      for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (shape(capKnob, m).ratio < r) lo = m; else hi = m; }
      return { knob: capKnob.slice(), n: lo };
    }
    return { A, B, c1, rest, chord, capY, shape, ghost, RESTR };
  }


  /* ---------- 체감 화면 ----------
     ① 거의 일직선 + 짧은 핸들 → ② 오른쪽 핸들을 점선까지 당기면 자석처럼 맞춤
     → ③ 작은 바퀴가 늘어난 곡선을 힘겹게 굴러감 (시간 ∝ 체감, 숫자가 같이 올라감)
     → ④ 끝에 가까워질수록 핸들이 줄고 곡선이 빨간 직선 위로 펴짐
     → ⑤ 도착 앵커 옆 주석 카드 → ⑥ 아래로 안내                              */
  const MAX_FELT = Math.max(...POINTS.map((q) => val(q.felt) || 0));
  const ROLL_MAX_MS = 6000;

  function feltView(svg, p) {
    const sec = svg.closest(".felt");
    const src = p.guide && p.guide.source, hc = COLOR[src] || NO_GUIDE;
    const r = ratioOf(p), felt = val(p.felt) || 0;
    let W, H, M, ghost, ghostKnob, knobTop, pitch, base, n, refs, anim, roll;
    let state = "idle"; // idle → playing → done

    function layout() {
      W = svg.clientWidth; H = svg.clientHeight;
      const wide = W >= 900 && W / H >= 1.2;
      const R = wide ? Math.min(H * 0.33, W * 0.2) : Math.min(H * 0.17, W * 0.34);
      const G = H * 0.8, cx = R * 0.62;
      knobTop = wide ? 96 : 120;
      const k = Math.min(W - cx - 40, 1.5 * (G - knobTop)) / MAX_ACTUAL; // 1분 = k px (세 지점 공통)
      const A = [cx, G], B = [cx + k * (val(p.actual) || 1), G];
      const band = (G - knobTop) * 0.24; // 손잡이를 이 띠까지 당기면 고리
      M = feltModel(A, B, { gain: 2.2, topLimit: knobTop + 30, knobTop, band, rho: loopRho(H, k * MAX_ACTUAL) });
      ghost = M.ghost(r);
      pitch = ghost.n > 0 ? ((M.capY - knobTop) * 0.75) / ghost.n : band / 4;
      ghostKnob = ghost.n > 0 ? [ghost.knob[0], M.capY - ghost.n * pitch] : ghost.knob;

      svg.setAttribute("viewBox", `0 0 ${f1(W)} ${f1(H)}`);
      let spokes = "";
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        spokes += `<line x1="${f1(Math.cos(a) * R * 0.07)}" y1="${f1(Math.sin(a) * R * 0.07)}" x2="${f1(Math.cos(a) * R * 0.86)}" y2="${f1(Math.sin(a) * R * 0.86)}"/>`;
      }
      const rw = clamp(H * 0.022, 11, 17);
      svg.innerHTML = `
        <line class="f-ground" x1="0" y1="${f1(G)}" x2="${f1(W)}" y2="${f1(G)}"/>
        <g transform="translate(${f1(cx)} ${f1(G - R)})">
          <path class="f-tire" fill-rule="evenodd" d="${ring(f1(R), f1(R * 0.86))}"/>
          <g class="f-spokes">${spokes}</g>
          <circle class="f-hub" r="${f1(R * 0.07)}"/>
        </g>
        <g class="f-target"><path class="f-ghost" d="${polyD(M.shape(ghost.knob, ghost.n).pts)}"/>
          <circle class="f-ghost-knob" r="9" cx="${f1(ghostKnob[0])}" cy="${f1(ghostKnob[1])}"/></g>
        <line class="f-real" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(B[0])}" y2="${f1(G)}"/>
        <path class="f-curve"/>
        <g class="f-left"><line class="f-handle" stroke="${hc}" x1="${f1(A[0])}" y1="${f1(G)}"/><circle class="f-knob" fill="${hc}" r="5.5"/></g>
        <g class="f-drag"><line class="f-handle" stroke="${hc}"/><circle class="f-knob" fill="${hc}" r="9"/><circle class="f-hit" r="28"/></g>
        ${[A, B].map((q) => `<rect class="f-anchor" x="${f1(q[0] - 6)}" y="${f1(q[1] - 6)}" width="12" height="12"/>`).join("")}
        <text class="f-t f-real-t" x="${f1((A[0] + B[0]) / 2)}" y="${f1(G + 30)}" text-anchor="middle">실제 ${val(p.actual)}분</text>
        <text class="f-t f-felt-t" text-anchor="middle"><tspan class="f-day"></tspan><tspan class="f-min"></tspan></text>
        <g class="f-roll" visibility="hidden"><g class="f-roll-w">
          <circle class="f-roll-tire" r="${f1(rw)}"/>${[0, 45, 90, 135].map((d) => `<line x1="${f1(-rw)}" y1="0" x2="${f1(rw)}" y2="0" transform="rotate(${d})"/>`).join("")}
        </g></g>`;
      refs = {
        curve: $(".f-curve", svg), drag: $(".f-drag", svg), dragLine: $(".f-drag line", svg), dragKnobs: svg.querySelectorAll(".f-drag circle"),
        leftLine: $(".f-left line", svg), leftKnob: $(".f-left circle", svg),
        text: $(".f-felt-t", svg), day: $(".f-day", svg), min: $(".f-min", svg),
        roll: $(".f-roll", svg), rollW: $(".f-roll-w", svg), rw
      };
      refs.drag.addEventListener("pointerdown", start);
      refs.drag.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    }

    // 손잡이 위치 → 곡선 모양 (고리 띠 위로 당기면 고리가 늘어남)
    const knobOf = () => (n > 0 ? [base[0], M.capY - n * pitch] : base);
    function fromKnob(q) {
      if (q[1] >= M.capY) { base = q; n = 0; }
      else { base = [q[0], M.capY]; n = (M.capY - q[1]) / pitch; }
    }

    // 곡선 + 양쪽 핸들. knob = 화면에 보이는 오른쪽 손잡이, k1 = 왼쪽 핸들 길이 비율
    function drawShape(s, knob, k1) {
      refs.curve.setAttribute("d", polyD(s.pts));
      refs.dragLine.setAttribute("x1", f1(M.B[0])); refs.dragLine.setAttribute("y1", f1(M.B[1]));
      refs.dragLine.setAttribute("x2", f1(knob[0])); refs.dragLine.setAttribute("y2", f1(knob[1]));
      refs.dragKnobs.forEach((ci) => { ci.setAttribute("cx", f1(knob[0])); ci.setAttribute("cy", f1(knob[1])); });
      const c = [lerp(M.A[0], M.c1[0], k1), lerp(M.A[1], M.c1[1], k1)];
      refs.leftLine.setAttribute("x2", f1(c[0])); refs.leftLine.setAttribute("y2", f1(c[1]));
      refs.leftKnob.setAttribute("cx", f1(c[0])); refs.leftKnob.setAttribute("cy", f1(c[1]));
    }
    function label(s, minutes, day) {
      const top = topOf(s.pts), flat = M.A[1] - top[1] < 40;
      // 거의 펴졌으면 직선 가운데 위에
      const x = f1(clamp(flat ? (M.A[0] + M.B[0]) / 2 : top[0], 90, W - 90)), y = Math.min(top[1] - 18, M.A[1] - 22);
      refs.text.setAttribute("x", x); refs.text.setAttribute("y", f1(y));
      refs.day.setAttribute("x", x); refs.day.setAttribute("dy", "-1.6em");
      refs.day.textContent = day ? TEXT.matched : "";
      refs.min.setAttribute("x", x); refs.min.setAttribute("dy", day ? "1.6em" : "0");
      refs.min.textContent = `체감 ${Math.round(minutes)}분`;
    }
    function draw() {
      const s = M.shape(base, n);
      drawShape(s, knobOf(), 1);
      label(s, (val(p.actual) || 0) * s.ratio, false);
    }

    function start(e) {
      if (state !== "idle") return;
      e.preventDefault();
      cancelAnimationFrame(anim);
      const target = e.currentTarget;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 드래그는 계속 */ }
      const stop = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", end);
        target.removeEventListener("pointercancel", end);
      };
      const end = () => { stop(); springBack(); };
      function move(ev) {
        const b = svg.getBoundingClientRect();
        fromKnob([clamp(ev.clientX - b.left, 10, W - 10), clamp(ev.clientY - b.top, knobTop - 40, M.A[1] + 30)]);
        // 점선 목표 가까이 오면 자석처럼 딱 맞추고 바로 굴러가기 시작
        if (r > M.RESTR + 0.1 && Math.abs(M.shape(base, n).ratio - r) < r * 0.1) {
          base = ghost.knob.slice(); n = ghost.n;
          stop();
          play();
          return;
        }
        draw();
      }
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", end);
      target.addEventListener("pointercancel", end);
    }

    // 점선까지 못 당기고 놓으면 제자리로
    function springBack() {
      const from = knobOf(), t0 = performance.now(), dur = RM.matches ? 1 : 600;
      const step = (now) => {
        const t = clamp((now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
        fromKnob([lerp(from[0], M.rest[0], e), lerp(from[1], M.rest[1], e)]);
        draw();
        if (t < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    // 폴리라인 위 길이 비율 f 지점과 진행 방향
    function along(pts, f) {
      const seg = [];
      let L = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
      let want = L * clamp(f), i = 0;
      while (i < seg.length - 1 && want > seg[i]) { want -= seg[i]; i++; }
      const a = pts[i], b = pts[i + 1], t = seg[i] ? want / seg[i] : 0;
      return { p: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], dir: norm([b[0] - a[0], b[1] - a[1]]), dist: L * clamp(f) };
    }

    // ③ 늘어난 곡선을 따라 굴러감. f = 0..1 진행 (펴짐은 해결 화면에서)
    let travelled = 0, lastAt = null;
    function frame(f) {
      const shown = ghost.n > 0 ? ghostKnob : ghost.knob;
      const s = M.shape(ghost.knob, ghost.n);
      drawShape(s, shown, 1);
      label(s, felt * f, true);
      // 작은 바퀴: 곡선 위를 굴러감 + 살짝 덜컹
      const at = along(s.pts, f), up = [at.dir[1], -at.dir[0]];
      if (lastAt) travelled += Math.hypot(at.p[0] - lastAt[0], at.p[1] - lastAt[1]);
      lastAt = at.p;
      const bump = f < 1 ? Math.abs(Math.sin(travelled / 11)) * 2.2 : 0;
      const c = add(at.p, up, refs.rw + 1.5 + bump);
      refs.roll.setAttribute("visibility", "visible");
      refs.roll.setAttribute("transform", `translate(${f1(c[0])} ${f1(c[1])})`);
      refs.rollW.setAttribute("transform", `rotate(${f1((travelled / refs.rw) * 57.3)})`);
    }

    function play() {
      state = "playing";
      sec.classList.add("playing");
      cancelAnimationFrame(anim);
      travelled = 0; lastAt = null;
      const dur = RM.matches ? 500 : Math.max(2200, (ROLL_MAX_MS * felt) / (MAX_FELT || 1));
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / dur);
        // 힘겹게: 느리게 출발하고, 속도가 고르지 않게 (조금씩 멈칫)
        const f = RM.matches ? t : clamp(ease(t) + 0.012 * Math.sin(t * Math.PI * 14) * Math.sin(t * Math.PI));
        frame(f);
        if (t < 1) roll = requestAnimationFrame(step);
        else finish();
      };
      roll = requestAnimationFrame(step);
    }

    // 끝까지 굴러감: 바퀴는 도착 앵커에 멈춰 있고, 아래로 안내
    function finish() {
      state = "done";
      frame(1);
      sec.classList.remove("playing");
      sec.classList.add("done");
    }

    function render() {
      cancelAnimationFrame(anim);
      layout();
      if (state === "idle") { base = M.rest.slice(); n = 0; draw(); return; }
      cancelAnimationFrame(roll);
      finish();
    }
    return { render };
  }

  /* ---------- 범례 기호 ---------- */
  const knobGlyph = (c, hollow) => `<svg class="glyph-k" viewBox="0 0 34 22" aria-hidden="true"><line x1="3" y1="19" x2="25" y2="5" stroke="${c}" stroke-width="1.6"/><circle cx="25" cy="5" r="4.5" fill="${hollow ? "var(--bg)" : c}" stroke="${hollow ? c : "none"}" stroke-width="1.4"/></svg>`;
  const arrowGlyph = (c) => `<svg class="glyph-k" viewBox="0 0 34 22" aria-hidden="true"><path d="M3 15 L24 9" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/><path d="M31 7 L21 4.5 L23.5 13.5 Z" fill="${c}" stroke="var(--ink)" stroke-width="0.8" stroke-linejoin="round"/></svg>`;
  const GLYPH = {
    real: `<svg viewBox="0 0 64 26" aria-hidden="true"><line x1="5" y1="20" x2="59" y2="20" stroke="var(--red)" stroke-width="3.5"/><rect x="1" y="16" width="8" height="8" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/><rect x="55" y="16" width="8" height="8" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/></svg>`,
    felt: `<svg viewBox="0 0 64 26" aria-hidden="true"><path d="M5 20 C 14 16, 50 -12, 59 20" fill="none" stroke="var(--ink)" stroke-width="2.6"/><line x1="59" y1="20" x2="50" y2="2" stroke="var(--ink-2)" stroke-width="1.3"/><circle cx="50" cy="2" r="3.6" fill="var(--ink-2)"/></svg>`,
    pull: `<svg viewBox="0 0 64 26" aria-hidden="true"><line x1="5" y1="22" x2="59" y2="22" stroke="var(--red)" stroke-width="2"/><path d="M5 22 C 20 18, 46 -2, 59 22" fill="none" stroke="var(--ink-3)" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/><line x1="59" y1="22" x2="48" y2="4" stroke="var(--ink-2)" stroke-width="1.3"/><circle cx="48" cy="4" r="4" fill="var(--ink-2)"/><path d="M38 10 l6 -6 M38 4 l6 0 l0 6" fill="none" stroke="var(--ink)" stroke-width="1.4"/></svg>`,
    match: `<svg viewBox="0 0 64 26" aria-hidden="true"><path d="M2 22 C 20 22, 30 12, 62 10" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M2 22 C 20 22, 30 12, 62 10" fill="none" stroke="var(--ink)" stroke-width="2.4"/><path d="M8 22 C 22 21, 30 13, 50 11" fill="none" stroke="var(--yellow)" stroke-width="3.4" stroke-linecap="round"/><path d="M58 10.5 L48 6.5 L49 15.5 Z" fill="var(--yellow)" stroke="var(--ink)" stroke-width="0.8"/><path d="M8 22 L40 25" stroke="var(--pink)" stroke-width="2.6" stroke-dasharray="1.5 4" stroke-linecap="round"/><path d="M47 25.6 L38 21 L37.5 28.5 Z" fill="var(--pink)" stroke="var(--ink)" stroke-width="0.8"/></svg>`
  };

  // 비교 표의 아주 작은 화살표 장면: 실제 길(검정) + 안내 화살표
  function miniScene(p, which) {
    const path = `<path d="M3 21 C 16 21, 26 13, 45 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M3 21 C 16 21, 26 13, 45 9" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/>`;
    const onPath = (c, w) => `<path d="M8 20.6 C 18 20, 25 14, 37 10.8" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/><path d="M44 9.3 L35.5 6.6 L37 14 Z" fill="${c}" stroke="var(--ink)" stroke-width="0.6"/>`;
    let extra = "";
    if (p.scene === "forest") extra += `<circle cx="34" cy="23" r="4.5" fill="var(--tree-2)" stroke="var(--ink)" stroke-width="0.6"/><circle cx="41" cy="20" r="4" fill="var(--tree-1)" stroke="var(--ink)" stroke-width="0.6"/>`;
    if (p.scene === "road") extra += [[14, 21.5], [24, 16.5]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 2}" width="6" height="4" rx="1" fill="var(--car-1)" stroke="var(--ink)" stroke-width="0.5"/>`).join("");
    let arrow = "";
    const g = p.guide || {};
    if (which === "guide" && g.source) {
      arrow = g.to
        ? `<path d="M8 21 L38 24.5" stroke="${COLOR[g.source]}" stroke-width="2.4" stroke-linecap="round" ${g.dashed ? 'stroke-dasharray="1.5 3.5"' : ""}/><path d="M45 25.3 L36.5 21 L36 28.5 Z" fill="${COLOR[g.source]}" stroke="var(--ink)" stroke-width="0.6"/>`
        : onPath(COLOR[g.source], 3.4);
    }
    if (which === "human") {
      if (g.source && !g.to) arrow += onPath(COLOR[g.source], 4.6);
      arrow += onPath(COLOR[p.fix.source] || NO_GUIDE, 2.4);
    }
    const dot = which === "guide" && !g.source ? `<circle cx="8" cy="20.6" r="2.6" fill="var(--ink)"/>` : "";
    return `<svg class="mini" viewBox="0 0 48 30" aria-hidden="true">${path}${extra}${arrow}${dot}</svg>`;
  }

  /* =========================================================
     화면 만들기
     ========================================================= */
  const kicker = (p, est) => `<p class="kicker"><span class="no">${esc(p.id)}</span>${esc(p.title || p.name)}${est ? EST : ""}</p>`;
  const lineGlyph = (src) => knobGlyph(COLOR[src] || NO_GUIDE, !src);

  // 1-① 문장 + 전체 지도
  $("#intro").innerHTML = `<div class="intro-text">${TEXT.intro.map((t) => `<p>${esc(t)}</p>`).join("")}</div>
    <svg class="map" id="map-intro" role="img" aria-label="스탠리파크 한 바퀴 경로와 길을 잃은 세 지점"></svg>
    <p class="place en">${esc(TEXT.place)}</p>`;
  const introMap = buildMap($("#map-intro"));

  /* =========================================================
     지도 위 사진 프레임: 찍은 곳에 점 + 가는 선으로 연결
     여유로운 구간은 크게, 돌아오는 숲길은 작게, 고속도로는 빈 점선 프레임
     ========================================================= */
  const VW = TEXT.viewer;
  const photoTime = (ph) => (ph.time ? ph.time + (ph.timeEst ? " 추정" : "") : "시각 ?");
  const FRAME = { large: [58, 72], small: [38, 48], phone: [32, 66], none: [48, 48] };
  const frameKind = (ph) => (ph.kind === "phone" || ph.kind === "none" ? ph.kind : ph.size === "small" ? "small" : "large");

  // 프레임 그림 (화면 px 단위, 가운데 = 0,0)
  function frameSvg(ph, i) {
    const k = frameKind(ph), [w, h] = FRAME[k], x = -w / 2, y = -h / 2;
    const src = ph.file ? `photos/${esc(ph.file)}` : "";
    const ph0 = (px, py, pw, phh) => `<rect class="pf-ph" x="${px}" y="${py}" width="${pw}" height="${phh}"/>
      <text class="pf-file" x="${px + pw / 2}" y="${py + phh / 2 + 2}" text-anchor="middle">${esc(ph.file)}</text>
      <image data-src="${src}" x="${px}" y="${py}" width="${pw}" height="${phh}" preserveAspectRatio="xMidYMid slice"/>`;
    if (k === "none") {
      return `<rect class="pf-none" x="${x}" y="${y}" width="${w}" height="${h}"/>
        <text class="pf-empty" x="0" y="3" text-anchor="middle">${esc(VW.empty)}</text>`;
    }
    if (k === "phone") {
      return `<rect class="pf-phone" x="${x}" y="${y}" width="${w}" height="${h - 12}" rx="6"/>${ph0(x + 4, y + 7, w - 8, h - 26)}
        <text class="pf-time" x="0" y="${y + h - 1}" text-anchor="middle">${esc(photoTime(ph))}</text>`;
    }
    const m = k === "small" ? 3 : 4, pw = w - m * 2;
    const rot = i % 2 ? 3 : -3;
    return `<g transform="rotate(${rot})"><rect class="pf-card" x="${x}" y="${y}" width="${w}" height="${h}"/>${ph0(x + m, y + m, pw, pw)}
      <text class="pf-time${k === "small" ? " sm" : ""}" x="0" y="${y + h - (k === "small" ? 4 : 6)}" text-anchor="middle">${esc(photoTime(ph))}</text></g>`;
  }

  function photoFrames(map) {
    const svg = map.svg;
    const leads = el("g", { class: "pf-leads" }, svg), dots = el("g", {}, svg), layer = el("g", {}, svg);
    const items = PHOTOS.filter((ph) => !ph.hidden).map((ph, i) => {
      const s = ph.at * LOOP, q = P(s);
      const lead = el("line", { class: "pf-lead" }, leads);
      const dot = el("circle", { class: "pf-dot" }, dots);
      const g = el("g", { class: "pf", tabindex: 0, role: "button", "aria-label": `${photoTime(ph)} ${ph.place}` }, layer);
      g.innerHTML = `<g class="pf-in">${frameSvg(ph, i)}</g>`;
      g.setAttribute("visibility", "hidden"); lead.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden");
      const im = $("image", g);
      if (im && ph.file) { const pre = new Image(); pre.onload = () => im.setAttribute("href", im.dataset.src); pre.src = im.dataset.src; }
      g.addEventListener("click", () => viewer.open(ph));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); viewer.open(ph); } });
      return { ph, s, q, g, lead, dot, wh: FRAME[frameKind(ph)], off: [0, 0], on: false };
    });
    let sc = 1;

    // 찍은 곳 바깥쪽에 놓고, 서로·지점 번호와 겹치지 않게 밀어낸다.
    // 전체 지도 크기에서 화면 px로 계산해 두고, 확대해도 찍은 곳에서 같은 px 거리에 둔다
    function layout() {
      const W = svg.clientWidth, H = svg.clientHeight;
      if (!W) return;
      const ref = map.fit(VIEW), k = ref[2] / W, gap = 6 * (sc = W < 640 ? 0.66 : 1);
      const vb = { x: ref[0], y: ref[1] };
      const toPx = (p) => [(p[0] - vb.x) / k, (p[1] - vb.y) / k];
      const n = items.map((it) => {
        const a = toPx(it.q), o = outward(it.s), w = it.wh[0] * sc, h = it.wh[1] * sc, d = 30 * sc + Math.max(w, h) / 2;
        return { a, w, h, hx: a[0] + o[0] * d, hy: a[1] + o[1] * d, x: a[0] + o[0] * d, y: a[1] + o[1] * d };
      });
      // 피해야 할 것: 지점 번호와 이름, 경로 선, 찍은 곳 점
      const blocks = [];
      POINTS.forEach((p) => {
        const s = p.at * LOOP, a = toPx(P(s)), o = outward(s);
        blocks.push({ x: a[0], y: a[1], w: 34, h: 34 }, { x: a[0] + o[0] * 28, y: a[1] + o[1] * 28, w: 64, h: 22 });
      });
      const st = toPx(SAMPLES[0]);
      blocks.push({ x: st[0] + 50, y: st[1] + 18, w: 84, h: 20 }); // 자전거 대여점 이름
      for (let i = 0; i < SAMPLES.length; i += 6) { const a = toPx(SAMPLES[i]); blocks.push({ x: a[0], y: a[1], w: 6, h: 6 }); }
      n.forEach((m) => blocks.push({ x: m.a[0], y: m.a[1], w: 10, h: 10 }));
      const push = (m, b, both) => {
        const dx = m.x - b.x, dy = m.y - b.y;
        const ox = (m.w + b.w) / 2 + gap - Math.abs(dx), oy = (m.h + b.h) / 2 + gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) return;
        const f = both ? 0.5 : 1;
        const sy = (dy >= 0 ? 1 : -1) * oy * f, yOut = m.y + sy < m.h / 2 + 6 || m.y + sy > H - m.h / 2 - 6;
        // 위아래로 밀 자리가 없으면 옆으로
        if (ox < oy || yOut) { const s = (dx >= 0 ? 1 : -1) * ox * f; m.x += s; if (both) b.x -= s; }
        else { m.y += sy; if (both) b.y -= sy; }
      };
      for (let it = 0; it < 240; it++) {
        for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) push(n[i], n[j], true);
        n.forEach((m) => {
          m.x += (m.hx - m.x) * 0.02; m.y += (m.hy - m.y) * 0.02;
          blocks.forEach((b) => push(m, b, false));
          m.x = clamp(m.x, m.w / 2 + 6, W - m.w / 2 - 6); m.y = clamp(m.y, m.h / 2 + 6, H - m.h / 2 - 6);
        });
      }
      items.forEach((itm, i) => { itm.off = [n[i].x - n[i].a[0], n[i].y - n[i].a[1]]; });
    }
    map.on("box", (k) => items.forEach((itm) => {
      const c = [itm.q[0] + itm.off[0] * k, itm.q[1] + itm.off[1] * k];
      itm.g.setAttribute("transform", `translate(${f1(c[0])} ${f1(c[1])}) scale(${(k * sc).toFixed(4)})`);
      itm.lead.setAttribute("x1", f1(itm.q[0])); itm.lead.setAttribute("y1", f1(itm.q[1]));
      itm.lead.setAttribute("x2", f1(c[0])); itm.lead.setAttribute("y2", f1(c[1]));
      itm.dot.setAttribute("cx", f1(itm.q[0])); itm.dot.setAttribute("cy", f1(itm.q[1])); itm.dot.setAttribute("r", f1(3.2 * k));
    }));
    // 자전거가 찍은 곳을 지나면 하나씩 떠오르고, 되돌아가면 사라진다
    map.on("bike", (s) => items.forEach((itm) => {
      const on = s >= itm.s - 1;
      if (on === itm.on) return;
      itm.on = on;
      const v = on ? "visible" : "hidden";
      [itm.g, itm.lead, itm.dot].forEach((e) => e.setAttribute("visibility", v));
      itm.g.classList.remove("pop");
      if (on) { void itm.g.getBoundingClientRect(); itm.g.classList.add("pop"); }
    }));
    return { layout };
  }

  /* ---------- 사진 보기: 아이폰 사진 정보처럼 ----------
     가운데 크게 → 위로 밀면 아래에 시각·장소·작은 지도 핀 → 바깥이나 X로 닫기 */
  const viewer = (function () {
    const box = document.createElement("div");
    box.className = "viewer";
    box.hidden = true;
    box.innerHTML = `<button class="v-close" type="button" aria-label="${esc(VW.close)}">×</button>
      <div class="v-scroll">
        <div class="v-stage"><figure class="v-photo"><span class="v-file"></span><img alt=""></figure>
          <p class="v-none"></p><p class="v-more">⌃ ${esc(VW.more)}</p></div>
        <div class="v-info"><p class="v-time"></p><p class="v-place"></p><svg class="v-map" aria-hidden="true"></svg></div>
      </div>`;
    document.body.appendChild(box);
    const scroll = $(".v-scroll", box), fig = $(".v-photo", box), img = $("img", box);
    let mini = null, pin = null, last = null;
    img.addEventListener("load", () => {
      fig.classList.add("loaded");
      if (!box.classList.contains("is-phone")) {
        // 사진 원래 비율 그대로, 화면 안에서 가장 크게
        const r = img.naturalWidth / img.naturalHeight;
        fig.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        fig.style.width = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.72 * r) + "px";
      }
    });
    img.addEventListener("error", () => fig.classList.remove("loaded"));

    function open(ph) {
      last = document.activeElement;
      const none = ph.kind === "none";
      box.classList.toggle("is-none", none);
      box.classList.toggle("is-phone", ph.kind === "phone");
      $(".v-none", box).textContent = none ? VW.noPhoto : "";
      fig.classList.remove("loaded");
      fig.style.aspectRatio = ""; fig.style.width = "";
      $(".v-file", box).textContent = ph.file || "";
      if (!none && ph.file) img.src = "photos/" + ph.file; else img.removeAttribute("src");
      $(".v-time", box).textContent = photoTime(ph);
      $(".v-place", box).textContent = ph.place;
      box.hidden = false;
      document.documentElement.classList.add("v-lock");
      scroll.scrollTop = 0;
      if (!none) {
        if (!mini) { mini = buildMap($(".v-map", box)); pin = el("circle", { class: "v-pin" }, mini.svg); }
        const q = P(ph.at * LOOP), b = mini.fit([q[0] - 200, q[1] - 135, 400, 270]);
        mini.setBox(b);
        pin.setAttribute("cx", f1(q[0])); pin.setAttribute("cy", f1(q[1])); pin.setAttribute("r", f1((b[2] / (mini.svg.clientWidth || 300)) * 8));
      }
      $(".v-close", box).focus();
    }
    function close() {
      box.hidden = true;
      document.documentElement.classList.remove("v-lock");
      if (last && last.focus) last.focus();
    }
    $(".v-close", box).addEventListener("click", close);
    // 사진·정보 바깥을 누르면 닫힘
    box.addEventListener("click", (e) => { if (!e.target.closest(".v-photo, .v-info, .v-close")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) close(); });
    return { open };
  })();

  // 1-② 읽는 법
  const L = TEXT.legend;
  $("#legend").innerHTML = `<ul class="legend-list">
    <li>${GLYPH.real}<span>${esc(L.real)}</span></li>
    <li>${GLYPH.felt}<span>${esc(L.felt)}</span></li>
    <li><span class="glyph-pair">${arrowGlyph("var(--yellow)")}${arrowGlyph("var(--pink)")}</span><span>${esc(L.guide[0])}<br>${esc(L.guide[1])}</span></li>
    <li>${GLYPH.match}<span>${esc(L.match)}</span></li>
    <li class="pull">${GLYPH.pull}<span>${esc(L.pull)}</span></li>
  </ul>`;

  /* ---------- 지점 지도 장면 ----------
     in : 확대 → 자전거 도착 → 그때의 안내 화살표 (없으면 아무것도 안 나옴)
     out: 사람이 나타나고 노랑 화살표가 실제 길 위에 겹침 → 자전거가 그 길로 출발 */
  const alongPts = (s0, s1) => { const out = []; for (let s = s0; s < s1; s += 5) out.push(P(s)); out.push(P(s1)); return out; };
  function scenePts(p) {
    const s = p.at * LOOP, lead = LOOP * 0.008, g = p.guide || {};
    let guide = null;
    if (g.source && g.to) {
      const a = P(s + lead * 0.5), out = [];
      for (let k = 0; k <= 24; k++) out.push([lerp(a[0], g.to[0], k / 24), lerp(a[1], g.to[1], k / 24)]);
      guide = out;
    } else if (g.source && g.along) guide = alongPts(s + lead, s + g.along * LOOP);
    const fix = alongPts(s + lead, s + (p.fix.along || 0.05) * LOOP);
    return { guide, fix, depart: s + (p.fix.along || 0.05) * LOOP };
  }
  function sceneBox(map, p, sp) {
    const all = [P(p.at * LOOP)].concat(sp.guide || [], sp.fix);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    all.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const pad = 70, w = Math.max(240, x1 - x0 + pad * 2), h = Math.max(240, y1 - y0 + pad * 2);
    return map.fit([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h]);
  }

  const frameSets = [];
  function inScene(sec, p, from) {
    const map = buildMap($(".map", sec), p), sp = scenePts(p), to = p.at * LOOP;
    frameSets.push(photoFrames(map));
    const g = p.guide || {};
    const guide = sp.guide ? map.arrow(sp.guide, COLOR[g.source], { dashed: g.dashed, label: g.label }) : null;
    const DUR = guide ? 3000 : 2000;
    return {
      sec, DUR,
      apply(t) {
        const full = map.fit(VIEW), z = sceneBox(map, p, sp);
        const ez = ease(clamp((t - 500) / 1300));
        map.setBox(full.map((v, k) => lerp(v, z[k], ez)));
        map.setBike(lerp(from, to, ease(clamp(t / 1800))));
        if (guide) guide.set(clamp((t - 2000) / 800));
      }
    };
  }

  /* =========================================================
     해결 화면: 길을 다시 찾은 방법 = 펜툴의 세 동작
       add   펜 툴: 점 추가      — 끊긴 길 끝에서 새 앵커를 찍어 노랑 선을 그림
       move  직접 선택 툴: 점 옮기기 — 숲속 분홍 앵커를 실제 길 위 자리로 끌어 옮김
       align 스마트 가이드: 정렬   — 비켜 있던 노랑 경로를 분홍 경로 위에 겹침
     끝나면: 아래 체감 곡선이 펴지고 → 카드 → 선이 다음 길로 이어지고 자전거가 출발
     ========================================================= */
  const RS = TEXT.resolve;

  // 아래쪽 작은 체감 곡선 (체감 화면에서 늘어난 그대로 → 해결되면 펴짐)
  function miniFelt(svg, p) {
    const r = ratioOf(p);
    let M, gh, W, H;
    function layout() {
      W = svg.clientWidth; H = svg.clientHeight;
      const k = Math.min(W * 0.62, 520) / MAX_ACTUAL, G = H - 28;
      const A = [18, G], B = [18 + k * (val(p.actual) || 1), G];
      const rho = clamp(H * 0.06, 5, 10);
      M = feltModel(A, B, { topLimit: 10 + 2 * rho, knobTop: -Infinity, band: 0, rho });
      gh = M.ghost(r);
      svg.setAttribute("viewBox", `0 0 ${f1(W)} ${f1(H)}`);
      svg.innerHTML = `<line class="f-ground" x1="0" y1="${f1(G)}" x2="${f1(W)}" y2="${f1(G)}"/>
        <line class="f-real" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(B[0])}" y2="${f1(G)}"/>
        <path class="r-curve"/>
        ${[A, B].map((q) => `<rect class="f-anchor" x="${f1(q[0] - 5)}" y="${f1(q[1] - 5)}" width="10" height="10"/>`).join("")}
        <text class="r-t r-real" x="${f1((A[0] + B[0]) / 2)}" y="${f1(G + 19)}" text-anchor="middle">실제 ${val(p.actual)}분</text>
        <text class="r-t r-felt" x="${f1(B[0] + 12)}" y="${f1(G - 12)}">체감 ${val(p.felt)}분</text>`;
    }
    function set(g) {
      const kb = [lerp(gh.knob[0], M.B[0], g), lerp(gh.knob[1], M.B[1], g)];
      $(".r-curve", svg).setAttribute("d", polyD(M.shape(kb, gh.n * (1 - g), 1 - g, (1 - g) * (1 - g)).pts));
      $(".r-felt", svg).setAttribute("opacity", f1(1 - g));
      $(".r-curve", svg).setAttribute("opacity", g >= 1 ? 0 : 1); // 다 펴지면 빨간 직선만
    }
    return { layout, set, endX: () => M.B[0], endY: () => M.B[1] };
  }

  // 화면 좌표 → 지도 좌표
  function toMap(svg, e) {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [q.x, q.y];
  }
  const pxDist = (map, a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / map.k();
  function distToPolyline(q, pts) {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const t = clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2);
      best = Math.min(best, Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t));
    }
    return best;
  }

  function resolveScene(sec, p) {
    const s = p.at * LOOP, sp = scenePts(p), g = p.guide || {}, act = p.fix.action;
    const map = buildMap($(".map", sec), p, { cut: s });
    frameSets.push(photoFrames(map));
    const svg = map.svg, YEL = COLOR[p.fix.source] || NO_GUIDE;
    const tip = sp.fix[sp.fix.length - 1];
    const mini = miniFelt($(".r-felt-svg", sec), p);
    const card = $(".r-card", sec), tool = $(".r-tool", sec), skip = $(".r-skip", sec);
    let state = "idle", raf = 0;

    // 사람 (01 여성 · 02 커플은 지점 옆, 03 아저씨는 노랑 경로 끝)
    const who = map.person(p.fix.who, s);
    who.show(1);

    // 노랑으로 깜빡이는 빈 원 = 사람이 알려준 자리
    const blink = map.pin(tip, "r-blink" + (act === "align" ? " off" : ""));
    el("circle", { r: 15, stroke: YEL }, blink.g);
    if (p.fix.label) {
      el("rect", { x: 20, y: -14, width: p.fix.label.length * 13 + 20, height: 28, rx: 14, class: "m-say-bg", stroke: YEL }, blink.g);
      const t = el("text", { x: 30 + (p.fix.label.length * 13) / 2, y: 5, "text-anchor": "middle", class: "m-say-t" }, blink.g);
      t.textContent = p.fix.label;
    }

    // 다시 이어진 길 (노랑)
    const fixArrow = map.arrow(sp.fix, YEL, { thin: act === "align" });
    fixArrow.set(0);

    // 동작별 준비
    let pinkAnchor = null, pinkLine = null, anchorPos = null, yel = null, off = [0, 0], guideArrow = null, smart = null;
    if (act === "add") {
      // 길이 끝점에서 끊겨 있음: 끝점 표시
      const end = map.pin(P(s), "r-end");
      el("rect", { x: -6, y: -6, width: 12, height: 12 }, end.g);
    }
    if (act === "move") {
      const from = P(s + LOOP * 0.004);
      pinkLine = el("path", { class: "r-pink-line", stroke: COLOR[g.source] }, map.arrowLayer);
      pinkAnchor = map.pin(g.to, "r-anchor");
      el("rect", { x: -9, y: -9, width: 18, height: 18, fill: COLOR[g.source] }, pinkAnchor.g);
      el("circle", { r: 26, class: "f-hit" }, pinkAnchor.g);
      anchorPos = g.to.slice();
      pinkAnchor.from = from;
    }
    if (act === "align") {
      guideArrow = map.arrow(sp.guide, COLOR[g.source], { wide: true, label: g.label });
      guideArrow.set(1);
      // 비켜 있는 노랑 경로 (끌 수 있음)
      yel = el("g", { class: "r-yel" }, map.arrowLayer);
      el("path", { d: polyD(sp.fix), class: "r-yel-halo" }, yel);
      el("path", { d: polyD(sp.fix), class: "r-yel-line", stroke: YEL }, yel);
      el("path", { d: polyD(sp.fix), class: "r-yel-hit" }, yel);
      // 스마트 가이드: 분홍 경로를 양쪽으로 늘인 얇은 선 + "정렬됨"
      const a = sp.guide[0], b = sp.guide[sp.guide.length - 1], d0 = norm([sp.guide[1][0] - a[0], sp.guide[1][1] - a[1]]);
      const n = sp.guide.length, d1 = norm([b[0] - sp.guide[n - 2][0], b[1] - sp.guide[n - 2][1]]);
      smart = { line: el("path", { class: "r-smart" }, map.arrowLayer), tag: map.pin(sp.guide[Math.floor(n / 2)], "r-smart-tag"), a, b, d0, d1 };
      el("rect", { x: -34, y: -40, width: 68, height: 22, rx: 3 }, smart.tag.g);
      el("text", { x: 0, y: -24, "text-anchor": "middle" }, smart.tag.g).textContent = RS.aligned;
    }

    // 지금 상태 그리기 (화면 크기가 바뀌어도 다시 그릴 수 있게)
    function draw() {
      const k = map.k();
      if (act === "move") {
        const pts = [pinkAnchor.from, anchorPos];
        pinkLine.setAttribute("d", polyD(pts));
        pinkAnchor.p = anchorPos; map.place(pinkAnchor);
      }
      if (act === "align") {
        yel.setAttribute("transform", `translate(${f1(off[0])} ${f1(off[1])})`);
        who.moveTo(add(tip, off));
        const { a, b, d0, d1 } = smart, ext = 60 * k;
        smart.line.setAttribute("d", `M${pt(add(a, d0, -ext))} L${polyD(sp.guide).slice(1)} L${pt(add(b, d1, ext))}`);
      }
    }

    function layout() {
      mini.layout();
      mini.set(state === "done" ? 1 : 0);
      map.setBox(sceneBox(map, p, sp));
      if (act === "align" && state === "idle") {
        // 처음에는 아저씨 경로가 분홍 옆으로 살짝 비켜 있음
        const a = sp.guide[0], b = sp.guide[sp.guide.length - 1], d = norm([b[0] - a[0], b[1] - a[1]]);
        const nv = [d[1], -d[0]];
        off = [nv[0] * 26 * map.k(), nv[1] * 26 * map.k()];
      }
      draw();
      if (state === "done") { fixArrow.set(1); map.setBike(sp.depart - (act === "align" ? LOOP * 0.012 : 0)); placeCard(); }
      else map.setBike(s);
    }

    /* ---------- 끝났을 때 ---------- */
    function placeCard() {
      card.classList.add("on");
      const panel = $(".r-panel", sec), x = clamp(mini.endX() - 24, 12, sec.clientWidth - card.offsetWidth - 12);
      card.style.left = f1(x) + "px";
      card.style.bottom = f1(panel.offsetHeight + 14) + "px";
      card.style.setProperty("--lx", f1(mini.endX() - x) + "px");
      card.style.setProperty("--lh", f1(14 + mini.endY() - 6) + "px"); // 지시선이 도착 앵커까지
      card.classList.add("on");
    }
    function complete() {
      if (state === "done") return;
      state = "done";
      sec.classList.add("done");
      unlock(sec);
      const t0 = performance.now(), D = RM.matches ? 1 : 1200;
      const step = (now) => {
        const t = clamp((now - t0) / D);
        mini.set(ease(t));
        if (t < 1) raf = requestAnimationFrame(step);
        else { placeCard(); depart(); }
      };
      raf = requestAnimationFrame(step);
    }
    // 선이 다음 길로 이어지고 자전거가 다시 출발
    function depart() {
      const t0 = performance.now(), D = RM.matches ? 1 : 1800;
      const step = (now) => {
        const t = clamp((now - t0) / D);
        if (act !== "align") fixArrow.set(clamp(t / 0.5));
        map.setBike(lerp(s, sp.depart - (act === "align" ? LOOP * 0.012 : 0), ease(clamp((t - 0.2) / 0.8))));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    // 노랑 선 그리기 (점 추가 · 점 옮기기)
    function drawYellow(then) {
      const t0 = performance.now(), D = RM.matches ? 1 : 900;
      const step = (now) => {
        const t = clamp((now - t0) / D);
        fixArrow.set(t);
        if (t < 1) raf = requestAnimationFrame(step); else then();
      };
      raf = requestAnimationFrame(step);
    }

    /* ---------- 동작 ---------- */
    function snapAdd() {
      blink.g.classList.add("hit");
      const a = map.pin(tip, "r-new-anchor");
      el("rect", { x: -7, y: -7, width: 14, height: 14, fill: YEL }, a.g);
      map.place(a);
      drawYellow(complete);
    }
    function snapMove() {
      anchorPos = tip.slice(); draw();
      pinkLine.classList.add("gone"); pinkAnchor.g.classList.add("gone");
      blink.g.classList.add("hit");
      drawYellow(complete);
    }
    function snapAlign() {
      off = [0, 0]; draw();
      sec.classList.add("aligned");
      fixArrow.set(1);
      complete();
    }
    const SNAP = { add: snapAdd, move: snapMove, align: snapAlign };

    // 커서 옆 툴 이름
    function showTool(e) {
      if (state !== "idle") return;
      const b = sec.getBoundingClientRect();
      tool.style.transform = `translate(${f1(e.clientX - b.left + 16)}px, ${f1(e.clientY - b.top + 14)}px)`;
      tool.classList.add("on");
    }
    svg.addEventListener("pointermove", showTool);
    svg.addEventListener("pointerleave", () => tool.classList.remove("on"));

    svg.addEventListener("pointerdown", (e) => {
      if (state !== "idle") return;
      showTool(e);
      const q = toMap(svg, e);
      if (act === "add") {
        if (pxDist(map, q, tip) < 40) { e.preventDefault(); state = "busy"; snapAdd(); }
        return;
      }
      let grab = null;
      if (act === "move" && pxDist(map, q, anchorPos) < 34) grab = { from: anchorPos.slice(), q };
      if (act === "align" && distToPolyline([q[0] - off[0], q[1] - off[1]], sp.fix) / map.k() < 26) grab = { from: off.slice(), q };
      if (!grab) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 계속 */ }
      sec.classList.add("dragging");
      const move = (ev) => {
        showTool(ev);
        const q2 = toMap(svg, ev), d = [q2[0] - grab.q[0], q2[1] - grab.q[1]];
        if (act === "move") {
          anchorPos = [grab.from[0] + d[0], grab.from[1] + d[1]];
          draw();
          if (pxDist(map, anchorPos, tip) < 30) { stop(); state = "busy"; snapMove(); }
        } else {
          off = [grab.from[0] + d[0], grab.from[1] + d[1]];
          draw();
          if (Math.hypot(off[0], off[1]) / map.k() < 7) { stop(); state = "busy"; snapAlign(); }
        }
      };
      const stop = () => {
        svg.removeEventListener("pointermove", move);
        svg.removeEventListener("pointerup", stop);
        svg.removeEventListener("pointercancel", stop);
        sec.classList.remove("dragging");
      };
      svg.addEventListener("pointermove", move);
      svg.addEventListener("pointerup", stop);
      svg.addEventListener("pointercancel", stop);
    });

    // 건너뛰기: 동작을 대신 해 준다
    skip.addEventListener("click", () => {
      if (state !== "idle") return;
      state = "busy";
      if (act === "add") { snapAdd(); return; }
      const t0 = performance.now(), D = RM.matches ? 1 : 700, f0 = act === "move" ? anchorPos.slice() : off.slice();
      const step = (now) => {
        const t = ease(clamp((now - t0) / D));
        if (act === "move") anchorPos = [lerp(f0[0], tip[0], t), lerp(f0[1], tip[1], t)];
        else off = [lerp(f0[0], 0, t), lerp(f0[1], 0, t)];
        draw();
        if (t < 1) raf = requestAnimationFrame(step); else SNAP[act]();
      };
      raf = requestAnimationFrame(step);
    });

    return { sec, layout, isDone: () => state !== "idle" };
  }

  /* ---------- 동작 전에는 다음 화면으로 넘어가지 않게 잠깐 고정 ----------
     위로는 자유롭게. 5초 뒤 "건너뛰기"가 나온다 */
  let lockSec = null, lockTimer = 0;
  const lockTop = () => lockSec.getBoundingClientRect().top + window.scrollY;
  function lock(sec) {
    if (lockSec === sec) return;
    lockSec = sec;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => sec.classList.add("can-skip"), 5000);
  }
  function unlock(sec) { if (lockSec === sec) { lockSec = null; clearTimeout(lockTimer); } }
  const pastLock = () => lockSec && window.scrollY >= lockTop() - 2;
  window.addEventListener("wheel", (e) => { if (e.deltaY > 0 && pastLock()) e.preventDefault(); }, { passive: false });
  let touchY = null;
  window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (touchY != null && e.touches[0].clientY < touchY && pastLock() && !e.target.closest(".r-yel, .r-anchor")) e.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "PageDown", "End", " "].includes(e.key) && pastLock() && !e.target.closest("button, input, textarea")) e.preventDefault();
  });
  window.addEventListener("scroll", () => { if (lockSec && window.scrollY > lockTop() + 2) window.scrollTo(0, lockTop()); }, { passive: true });

  // 2. 지점마다 같은 순서: 지도(안내) → 체감 → 지도(다시 이어짐)
  const host = $("#points");
  const scenes = [], felts = [], resolves = [];
  POINTS.forEach((p, i) => {
    const est = isEst(p.actual) || isEst(p.felt);
    const photo = p.photo
      ? `<figure class="polaroid"><div class="ph missing"><span>${esc(TEXT.photoSlot)}<br>${esc(p.photo)}</span></div></figure>`
      : `<figure class="polaroid empty"><div class="ph"><span>${esc(p.photoNote || "")}</span></div></figure>`;
    const wrap = document.createElement("div");
    wrap.className = "point";
    wrap.innerHTML = `
      <section class="screen loc" id="p${esc(p.id)}-in"><div class="loc-head">${kicker(p)}<p class="loc-space">${esc(p.space)}</p>${p.note ? `<p class="loc-space">${esc(p.note)}</p>` : ""}</div>
        <svg class="map" role="img" aria-label="${esc(p.id + " " + p.name)}: ${esc(p.space)}"></svg>${photo}</section>
      <section class="screen felt" id="p${esc(p.id)}-felt">${kicker(p, est)}
        <svg class="felt-svg" role="img" aria-label="실제 ${val(p.actual)}분, 체감 ${val(p.felt)}분"></svg>
        <p class="down">↓ ${esc(TEXT.scrollDown)}</p>
      </section>
      <section class="screen loc resolve act-${esc(p.fix.action)}" id="p${esc(p.id)}-out"><div class="loc-head">${kicker(p)}</div>
        <svg class="map" role="img" aria-label="${esc(p.id + " " + p.name)}: ${esc(p.fix.tool + " — " + p.fix.text)}"></svg>
        <p class="r-tool">${esc(p.fix.tool)}</p>
        <div class="r-panel"><svg class="r-felt-svg" aria-hidden="true"></svg></div>
        <div class="f-card r-card"><p class="f-card-who">${lineGlyph(p.fix.source)}<span style="--c:${COLOR[p.fix.source] || NO_GUIDE}">${esc(p.fix.text)}</span></p>
          <p class="f-card-line">${esc(p.fix.line || "")}</p></div>
        <button class="r-skip" type="button">${esc(TEXT.resolve.skip)}</button>
        <p class="down">↓ ${esc(TEXT.scrollDown)}</p>
      </section>`;
    host.appendChild(wrap);

    const img = wrap.querySelector(".ph.missing");
    if (img) {
      const im = new Image();
      im.alt = "";
      im.onload = () => img.classList.remove("missing");
      im.src = "photos/" + p.photo;
      img.appendChild(im);
    }

    const prev = i ? scenePts(POINTS[i - 1]).depart : 0;
    scenes.push(inScene($(`#p${p.id}-in`, wrap), p, prev));
    felts.push(feltView($(".felt-svg", wrap), p));
    resolves.push(resolveScene($(`#p${p.id}-out`, wrap), p));
  });

  // 3-① 비교: 같은 기준선, 같은 축척 + 아래 표
  const maxR = Math.max(...POINTS.map(ratioOf));
  const estIds = POINTS.filter((p) => isEst(p.actual) || isEst(p.felt)).map((p) => p.id);
  const TB = TEXT.table;
  const row = (key, cell) => `<div class="tr"><p class="th">${esc(TB[key])}</p>${POINTS.map((p) => `<div class="td${ratioOf(p) === maxR ? " max" : ""}">${cell(p)}</div>`).join("")}</div>`;
  $("#compare").innerHTML = `<p class="cmp-est">${estIds.length ? `${esc(estIds.join("·"))} ${EST}` : ""}</p>
    <div class="cmp-grid">
      <div class="tr cmp-chart"><span></span><svg class="cmp-svg" role="img" aria-label="세 지점의 실제 시간과 체감 시간 비교"></svg></div>
      <div class="tr cmp-head"><span></span>${POINTS.map((p) => `<p class="td${ratioOf(p) === maxR ? " max" : ""}"><span class="no">${esc(p.id)}</span> ${esc(p.name)}</p>`).join("")}</div>
      ${row("guide", (p) => `${miniScene(p, "guide")}<span>${esc(p.table.guide)}</span>`)}
      ${row("problem", (p) => `<span>${esc(p.table.problem)}</span>`)}
      ${row("time", (p) => `<span><b class="r">${val(p.actual)}</b> → <b>${val(p.felt)}분</b></span>`)}
      ${row("human", (p) => `${miniScene(p, "human")}<span><b class="verb">${esc(p.table.human)}</b><small>${esc(p.table.humanSub || "")}</small></span>`)}
      <div class="tr"><p class="th">${esc(TB.photos)}</p><div class="td td-all">${esc(TB.photosAll)}</div></div>
    </div>`;

  function drawCompare() {
    const svg = $(".cmp-svg"), W = svg.clientWidth, H = svg.clientHeight;
    const cols = POINTS.length, colW = W / cols, pad = Math.min(16, colW * 0.08);
    const G = H - 8, top = 8, k = (colW - 2 * pad) / MAX_ACTUAL;
    const rho = loopRho(H * 1.3, k * MAX_ACTUAL);
    svg.setAttribute("viewBox", `0 0 ${f1(W)} ${f1(H)}`);
    let out = `<line class="f-ground" x1="0" y1="${f1(G)}" x2="${f1(W)}" y2="${f1(G)}"/>`;
    POINTS.forEach((p, i) => {
      const A = [i * colW + pad, G], B = [A[0] + k * (val(p.actual) || 1), G];
      const M = feltModel(A, B, { topLimit: top + 2 * rho, knobTop: -Infinity, band: 0, rho }), g = M.ghost(ratioOf(p));
      out += `<path class="cmp-curve${ratioOf(p) === maxR ? " max" : ""}" d="${polyD(M.shape(g.knob, g.n).pts)}"/>
        <line class="f-real" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(B[0])}" y2="${f1(G)}"/>
        ${[A, B].map((q) => `<rect class="f-anchor" x="${f1(q[0] - 4)}" y="${f1(q[1] - 4)}" width="8" height="8"/>`).join("")}`;
    });
    svg.innerHTML = out;
  }

  // 3-② 깨달음
  // 사진 시간 막대: 사진마다 점, 길을 잃은 뒤는 비어 있음
  const TL = TEXT.timeline;
  const mins = (t) => { const m = /(\d+):(\d+)\s*(AM|PM)?/i.exec(t || ""); if (!m) return null; let h = +m[1] % 12; if (/pm/i.test(m[3] || "")) h += 12; return h * 60 + +m[2]; };
  const t0 = mins(TL.start), t1 = mins(TL.end), tl = mins(TL.lost);
  const pct = (t) => (((t - t0) / (t1 - t0)) * 100).toFixed(2) + "%";
  const shots = PHOTOS.filter((ph) => ph.kind === "photo" && mins(ph.time) != null);
  const timeline = `<div class="tl">
      <p class="tl-title">${esc(TL.title)}</p>
      <div class="tl-bar">
        <span class="tl-on" style="width:${pct(tl)}"></span><span class="tl-off" style="left:${pct(tl)}"></span>
        ${shots.map((ph) => `<i class="tl-dot" style="left:${pct(mins(ph.time))}" title="${esc(ph.time + " " + ph.place)}"></i>`).join("")}
        <b class="tl-lost" style="left:${pct(tl)}"><span>${esc(TL.lostLabel)}</span></b>
      </div>
      <div class="tl-axis"><span style="left:0">${esc(TL.start)}</span><span style="left:${pct(tl)}">${esc(TL.lost)}</span><span style="left:100%">${esc(TL.end)}</span></div>
      <p class="tl-after" style="left:${pct((tl + t1) / 2)}">${esc(TL.after)}</p>
    </div>`;
  $("#thesis").innerHTML = timeline + `<p class="def"><b>${esc(TEXT.definition[0])}</b><span>${esc(TEXT.definition[1])}</span></p>
    <p class="big">${TEXT.thesis.map((t) => `<span>${esc(t)}</span>`).join("")}</p>`;

  /* =========================================================
     지도 장면 재생: 화면에 들어오면 처음부터, 나가면 처음 상태로
     ========================================================= */
  function sceneReset(sc) { cancelAnimationFrame(sc.raf); sc.played = false; sc.apply(0); }
  function sceneEnd(sc) { sc.apply(sc.DUR); }
  function scenePlay(sc) {
    if (sc.played) return;
    sc.played = true;
    if (RM.matches) { sceneEnd(sc); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(sc.DUR, now - t0);
      sc.apply(t);
      if (t < sc.DUR) sc.raf = requestAnimationFrame(step);
    };
    sc.raf = requestAnimationFrame(step);
  }

  function layoutAll() {
    introMap.setBox(introMap.fit(VIEW));
    introMap.setBike(0);
    frameSets.forEach((f) => f.layout());
    scenes.forEach((sc) => (sc.played ? sceneEnd(sc) : sceneReset(sc)));
    felts.forEach((f) => f.render());
    resolves.forEach((r) => r.layout());
    drawCompare();
  }
  layoutAll();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layoutAll, 120); });

  /* =========================================================
     스크롤 바퀴: 오른쪽 끝 세로 트랙을 따라 바퀴가 굴러간다
     이동 거리 ÷ 바퀴 둘레만큼 회전 (아래로 = 앞으로, 위로 = 거꾸로). 끌어도 스크롤
     ========================================================= */
  const wheelNav = (function () {
    const nav = document.createElement("div");
    nav.className = "wnav";
    nav.setAttribute("aria-hidden", "true");
    let spokes = "";
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; spokes += `<line x1="${f1(Math.cos(a) * 2.6)}" y1="${f1(Math.sin(a) * 2.6)}" x2="${f1(Math.cos(a) * 15.5)}" y2="${f1(Math.sin(a) * 15.5)}"/>`; }
    nav.innerHTML = `<div class="wnav-track"></div><div class="wnav-marks"></div>
      <svg class="wnav-wheel" viewBox="-20 -20 40 40"><g class="wnav-rot">
        <circle class="wnav-tire" r="17.5"/><g class="wnav-spokes">${spokes}</g><circle class="wnav-hub" r="2.6"/>
      </g></svg>`;
    document.body.appendChild(nav);
    const wheel = $(".wnav-wheel", nav), rot = $(".wnav-rot", nav), marks = $(".wnav-marks", nav);
    const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const span = () => nav.clientHeight - wheel.clientHeight;

    function update() {
      const y = clamp(window.scrollY / maxScroll()) * span();
      wheel.style.transform = `translateY(${f1(y)}px)`;
      // 굴러간 거리 = 이동 거리, 한 바퀴 = 바퀴 둘레
      if (!RM.matches) rot.setAttribute("transform", `rotate(${f1((y / (Math.PI * wheel.clientHeight)) * 360)})`);
      else rot.removeAttribute("transform");
    }
    // NODE 01·02·03 위치 표시
    function placeMarks() {
      marks.innerHTML = POINTS.map((p) => {
        const sec = document.getElementById(`p${p.id}-in`);
        if (!sec) return "";
        const top = sec.getBoundingClientRect().top + window.scrollY;
        const y = clamp(top / maxScroll()) * span() + wheel.clientHeight / 2;
        return `<i style="top:${f1(y)}px" title="${esc(p.id)}"></i>`;
      }).join("");
      update();
    }
    // 바퀴를 끌면 스크롤 바처럼
    wheel.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { wheel.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 계속 */ }
      const y0 = e.clientY, s0 = window.scrollY;
      const move = (ev) => window.scrollTo(0, s0 + ((ev.clientY - y0) / (span() || 1)) * maxScroll());
      const up = () => { wheel.removeEventListener("pointermove", move); wheel.removeEventListener("pointerup", up); wheel.removeEventListener("pointercancel", up); nav.classList.remove("drag"); };
      nav.classList.add("drag");
      wheel.addEventListener("pointermove", move);
      wheel.addEventListener("pointerup", up);
      wheel.addEventListener("pointercancel", up);
    });
    let ticking = false;
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });
    window.addEventListener("load", placeMarks);
    return { placeMarks };
  })();
  wheelNav.placeMarks();
  window.addEventListener("resize", () => setTimeout(wheelNav.placeMarks, 160));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      const rv = resolves.find((x) => x.sec === en.target);
      if (rv) {
        if (en.intersectionRatio >= 0.55 && !rv.isDone()) lock(rv.sec);
        else if (!en.isIntersecting) unlock(rv.sec);
        return;
      }
      const sc = scenes.find((x) => x.sec === en.target);
      if (sc) {
        if (en.intersectionRatio >= 0.55) scenePlay(sc);
        else if (!en.isIntersecting) sceneReset(sc);
      } else if (en.isIntersecting) en.target.classList.add("in");
    }), { threshold: [0, 0.3, 0.55] });
    scenes.forEach((sc) => io.observe(sc.sec));
    resolves.forEach((r) => io.observe(r.sec));
    io.observe($("#legend"));
  } else {
    scenes.forEach(sceneEnd);
    $("#legend").classList.add("in");
  }
})();
