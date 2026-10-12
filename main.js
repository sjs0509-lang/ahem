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
  // 한 바퀴 경로: 대여점 → 공원 입구 → 해안을 따라 반시계 방향 → 출구 → 시내 도로 → 대여점
  const ROUTE = [[720, 645], [690, 595], [650, 545], [690, 470], [760, 390], [720, 300], [600, 235], [470, 215],
    [345, 255], [265, 350], [260, 465], [305, 560], [385, 630], [480, 668], [600, 688]];
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
  const TREE_FILLS = ["var(--tree-1)", "var(--tree-2)", "var(--tree-3)"];
  const BLOCK_FILLS = ["var(--blk-1)", "var(--blk-2)", "var(--blk-3)", "var(--blk-4)", "#ffffff"];
  // 차도 지점(illus: "road") 주변의 넓은 도로
  const ROAD_P = POINTS.find((p) => p.illus === "road");
  const ROAD_PTS = [];
  if (ROAD_P) {
    const s = ROAD_P.at * LOOP, half = LOOP * 0.035 + 70;
    for (let x = s - half; x <= s + half; x += 8) ROAD_PTS.push(P(x));
  }
  const SHOP = add(SAMPLES[0], [8, 52]);

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
    TREES.forEach(([x, y, r], i) => el("path", withOut({ d: scallop(x, y, r, 8 + (i % 3), i * 0.7), fill: TREE_FILLS[i % 3] }), svg));
    // 넓은 차도와 차
    if (ROAD_PTS.length > 1) {
      const rd = "M" + ROAD_PTS.map(pt).join(" L");
      el("path", { d: rd, fill: "none", stroke: "var(--ink)", "stroke-width": 34, "stroke-linejoin": "round" }, svg);
      el("path", { d: rd, fill: "none", stroke: "var(--road)", "stroke-width": 31.6, "stroke-linejoin": "round" }, svg);
      el("path", { d: rd, fill: "none", stroke: "#fff", "stroke-width": 2, "stroke-dasharray": "10 9" }, svg);
      [0.18, 0.47, 0.8].forEach((f, i) => {
        const k = Math.floor(f * (ROAD_PTS.length - 2)), a = ROAD_PTS[k], b = ROAD_PTS[k + 1];
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const nrm = norm([-(b[1] - a[1]), b[0] - a[0]]), c = add(a, nrm, i % 2 ? 7.5 : -7.5);
        const car = el("g", { transform: `translate(${f1(c[0])} ${f1(c[1])}) rotate(${f1(ang)})` }, svg);
        el("rect", withOut({ x: -11, y: -5.5, width: 22, height: 11, rx: 3, fill: ["var(--car-1)", "var(--car-2)", "var(--car-3)"][i] }), car);
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
     지형은 확대하면 같이 커지고, 경로 선·번호·글자·자전거는 화면에서 늘 같은 크기 */
  function buildMap(svg, focus) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    drawTerrain(svg);
    const route = "M" + SAMPLES.map(pt).join(" L");
    el("path", { d: route, fill: "none", stroke: "#fff", "stroke-width": 7, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);
    el("path", { d: route, fill: "none", stroke: "var(--ink)", "stroke-width": 3, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, svg);

    const fixed = []; // 화면 크기에 고정되는 것들 [g, 위치]
    const pin = (p, cls) => { const g = el("g", { class: cls }, svg); fixed.push([g, p]); return g; };
    const label = (g, x, y, t, anchor, cls) => { const e = el("text", { x, y, "text-anchor": anchor, class: cls }, g); e.textContent = t; return e; };

    [[205, 690, "ENGLISH BAY"], [845, 452, "COAL HARBOUR"], [500, 160, "BURRARD INLET"]].forEach(([x, y, t]) =>
      label(pin([x, y], "m-water"), 0, 0, t, "middle", "m-water-t"));

    const start = pin(SAMPLES[0], "m-start");
    el("rect", { x: -6, y: -6, width: 12, height: 12, class: "m-start-sq" }, start);
    label(start, 12, 22, TEXT.start, "start", "m-name");

    // 자전거 (말 없이 이동만)
    const bike = pin(SAMPLES[0], "m-bike");
    if (!focus) bike.setAttribute("visibility", "hidden"); // 전체 지도에서는 출발 전
    const flip = el("g", {}, bike);
    [-12, 12].forEach((x) => el("circle", { cx: x, cy: 0, r: 9, fill: "#fff", stroke: "var(--ink)", "stroke-width": 2.4 }, flip));
    el("path", { d: "M-12 0 L-3 -12 L9 -12 L12 0 M-3 -12 L0 0 L-12 0 M9 -12 L7 -17 L12 -17 M-3 -12 L-5 -16 M-4 -16 L2 -27", fill: "none", stroke: "var(--ink)", "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }, flip);
    el("circle", { cx: 3, cy: -32, r: 5, fill: "var(--ink)" }, flip);
    const bikeEntry = fixed[fixed.length - 1];

    POINTS.forEach((p) => {
      const s = p.at * LOOP, o = outward(s), q = P(s);
      const g = pin(q, "m-point" + (focus && focus !== p ? " dim" : ""));
      el("circle", { r: 14, class: "m-dot" }, g);
      label(g, 0, 4.5, p.id, "middle", "m-no");
      const anchor = o[0] > 0.35 ? "start" : o[0] < -0.35 ? "end" : "middle";
      label(g, o[0] * 24, o[1] * 24 + 5, p.name, anchor, "m-name");
    });

    let box = VIEW.slice();
    const map = {
      svg,
      setBox(b) {
        box = b;
        svg.setAttribute("viewBox", b.map(f1).join(" "));
        const k = b[2] / (svg.clientWidth || 600);
        fixed.forEach(([g, p]) => g.setAttribute("transform", `translate(${f1(p[0])} ${f1(p[1])}) scale(${k.toFixed(4)})`));
      },
      setBike(s) {
        const p = P(s);
        bikeEntry[1] = [p[0], p[1]];
        flip.setAttribute("transform", `translate(0 -10)${T(s)[0] < -0.05 ? " scale(-1 1)" : ""}`);
        map.setBox(box);
      },
      // 화면 비율에 맞춘 상자
      fit(b) {
        const a = (svg.clientWidth || 1) / (svg.clientHeight || 1);
        let [x, y, w, h] = b;
        const cx = x + w / 2, cy = y + h / 2;
        if (w / h < a) w = h * a; else h = w / a;
        return [cx - w / 2, cy - h / 2, w, h];
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
    function shape(knob, n) {
      const c2 = c2Of(knob), N = 360, base = [];
      for (let i = 0; i <= N; i++) base.push(bz(A, c1, c2, B, i / N));
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
            const w = Math.pow(Math.sin(Math.PI * u), 2), th = 2 * Math.PI * n * u;
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


  function feltView(svg, p, onMatch) {
    const src = p.guide && p.guide.source, hc = COLOR[src] || NO_GUIDE;
    const r = ratioOf(p);
    let W, H, M, ghost, ghostKnob, knobTop, pitch, base, n, matched = false, anim, refs;

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
      svg.innerHTML = `
        <line class="f-ground" x1="0" y1="${f1(G)}" x2="${f1(W)}" y2="${f1(G)}"/>
        <g transform="translate(${f1(cx)} ${f1(G - R)})">
          <path class="f-tire" fill-rule="evenodd" d="${ring(f1(R), f1(R * 0.86))}"/>
          <g class="f-spokes">${spokes}</g>
          <circle class="f-hub" r="${f1(R * 0.07)}"/>
        </g>
        <path class="f-ghost" d="${polyD(M.shape(ghost.knob, ghost.n).pts)}"/>
        <circle class="f-ghost-knob" r="9" cx="${f1(ghostKnob[0])}" cy="${f1(ghostKnob[1])}"/>
        <line class="f-real" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(B[0])}" y2="${f1(G)}"/>
        <path class="f-curve"/>
        <line class="f-handle" stroke="${hc}" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(M.c1[0])}" y2="${f1(M.c1[1])}"/>
        <circle class="f-knob" fill="${hc}" r="5.5" cx="${f1(M.c1[0])}" cy="${f1(M.c1[1])}"/>
        <g class="f-drag"><line class="f-handle" stroke="${hc}"/><circle class="f-knob" fill="${hc}" r="9"/><circle class="f-hit" r="28"/></g>
        ${[A, B].map((q) => `<rect class="f-anchor" x="${f1(q[0] - 6)}" y="${f1(q[1] - 6)}" width="12" height="12"/>`).join("")}
        <text class="f-t f-real-t" x="${f1((A[0] + B[0]) / 2)}" y="${f1(G + 30)}" text-anchor="middle">실제 ${val(p.actual)}분</text>
        <text class="f-t f-felt-t" text-anchor="middle"><tspan class="f-day"></tspan><tspan class="f-min"></tspan></text>`;
      refs = {
        curve: $(".f-curve", svg), drag: $(".f-drag", svg), dragLine: $(".f-drag line", svg),
        knobs: svg.querySelectorAll(".f-drag circle"), text: $(".f-felt-t", svg), day: $(".f-day", svg), min: $(".f-min", svg)
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

    function draw() {
      const s = M.shape(base, n), knob = knobOf();
      refs.curve.setAttribute("d", polyD(s.pts));
      refs.dragLine.setAttribute("x1", f1(M.B[0])); refs.dragLine.setAttribute("y1", f1(M.B[1]));
      refs.dragLine.setAttribute("x2", f1(knob[0])); refs.dragLine.setAttribute("y2", f1(knob[1]));
      refs.knobs.forEach((ci) => { ci.setAttribute("cx", f1(knob[0])); ci.setAttribute("cy", f1(knob[1])); });
      const felt = matched ? val(p.felt) : (val(p.actual) || 0) * s.ratio;
      const top = topOf(s.pts);
      const x = f1(clamp(top[0], 90, W - 90)), y = Math.min(top[1] - 18, M.A[1] - 22);
      refs.text.setAttribute("x", x); refs.text.setAttribute("y", f1(y));
      refs.day.setAttribute("x", x); refs.day.setAttribute("dy", "-1.6em");
      refs.day.textContent = matched ? TEXT.matched : "";
      refs.min.setAttribute("x", x); refs.min.setAttribute("dy", matched ? "1.6em" : "0");
      refs.min.textContent = `체감 ${Math.round(felt)}분`;
    }

    function start(e) {
      e.preventDefault();
      cancelAnimationFrame(anim);
      const target = e.currentTarget;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 드래그는 계속 */ }
      const move = (ev) => {
        const b = svg.getBoundingClientRect();
        fromKnob([clamp(ev.clientX - b.left, 10, W - 10), clamp(ev.clientY - b.top, knobTop - 40, M.A[1] + 30)]);
        // 점선 목표 가까이 오면 자석처럼 딱 맞춤
        const near = Math.abs(M.shape(base, n).ratio - r) < r * 0.1;
        if (r > M.RESTR + 0.1 && near) {
          base = ghost.knob.slice(); n = ghost.n;
          if (!matched) { matched = true; svg.closest(".felt").classList.add("matched"); onMatch && onMatch(); }
        } else if (!near) {
          matched = false;
          svg.closest(".felt").classList.remove("matched");
        }
        draw();
      };
      const end = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", end);
        target.removeEventListener("pointercancel", end);
        if (!matched) springBack();
      };
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

    function render() {
      layout();
      if (matched) { base = ghost.knob.slice(); n = ghost.n; } else { base = M.rest.slice(); n = 0; }
      draw();
    }
    return { render };
  }

  /* =========================================================
     상황 일러스트 (외곽선 + 단색)
     ========================================================= */
  const ILLUS = (function () {
    const o = 'stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
    const tree = (x, y, r, fill, rot = 0) => `<path ${o} fill="${fill}" d="${scallop(x, y, r, 8, rot)}"/>`;
    return {
      // 숲길 갈림길, 입구 표지판 없음
      fork: `<rect ${o} width="200" height="140" fill="var(--grass)"/>
        <path ${o} fill="var(--sand)" d="M86 140 L92 96 L32 36 L48 30 L100 82 L152 30 L168 36 L108 96 L114 140 Z"/>
        ${tree(22, 92, 20, "var(--tree-1)")}${tree(178, 98, 22, "var(--tree-2)", 1)}${tree(100, 26, 18, "var(--tree-3)", 2)}${tree(58, 128, 14, "var(--tree-2)", 3)}${tree(150, 132, 12, "var(--tree-1)")}
        <rect ${o} x="128" y="74" width="4" height="30" fill="#fff"/><rect ${o} x="116" y="62" width="28" height="14" fill="#fff"/>
        <path ${o} fill="#fff" d="${star(28, 22, 5)}"/>`,
      // 휴대폰 설명이 가리키는 길은 점선으로만 있고 실제로는 나무만
      phone: `<rect ${o} width="200" height="140" fill="var(--grass)"/>
        ${tree(110, 40, 24, "var(--tree-1)")}${tree(152, 52, 22, "var(--tree-2)", 1)}${tree(184, 30, 18, "var(--tree-3)", 2)}${tree(132, 92, 20, "var(--tree-3)", 3)}${tree(176, 106, 20, "var(--tree-1)")}${tree(92, 100, 16, "var(--tree-2)")}
        <path d="M60 118 C 90 100, 110 80, 140 66" fill="none" stroke="var(--pink)" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>
        <rect ${o} x="14" y="70" width="30" height="54" rx="5" fill="var(--pink-soft)"/><rect ${o} x="19" y="78" width="20" height="34" fill="#fff"/>
        <path ${o} fill="#fff" d="M10 20 h70 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-44 l-10 12 l2 -12 h-18 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 z"/>
        <path d="M20 38 h40" stroke="var(--pink)" stroke-width="2.4" stroke-dasharray="2 5" stroke-linecap="round"/><path ${o} fill="var(--pink)" d="M60 33 l10 5 l-10 5 z"/>`,
      // 차가 많은 도로 위 작은 자전거, 휴대폰 화살표는 직진
      road: `<rect ${o} width="200" height="140" fill="var(--land)"/>
        <path ${o} fill="var(--road)" d="M0 44 L200 30 L200 112 L0 126 Z"/>
        <path d="M0 85 L200 71" stroke="#fff" stroke-width="2" stroke-dasharray="12 9"/>
        ${[[30, 58, "var(--car-1)"], [112, 52, "var(--car-2)"], [150, 86, "var(--car-3)"], [62, 100, "var(--car-2)"]].map(([x, y, c]) => `<g transform="translate(${x} ${y}) rotate(-4)"><rect ${o} x="-16" y="-8" width="32" height="16" rx="4" fill="${c}"/><rect ${o} x="2" y="-5" width="9" height="10" rx="1.5" fill="#fff"/></g>`).join("")}
        <g transform="translate(98 116)"><circle ${o} cx="-6" cy="0" r="5" fill="#fff"/><circle ${o} cx="6" cy="0" r="5" fill="#fff"/><path ${o} fill="none" d="M-6 0 L-1 -7 L5 -7 L6 0 M-1 -7 L0 0"/><circle ${o} cx="1" cy="-13" r="2.6" fill="var(--ink)"/></g>
        <rect ${o} x="160" y="6" width="26" height="40" rx="4" fill="var(--pink-soft)"/><path ${o} fill="var(--pink)" d="M173 12 l7 10 h-4.5 v14 h-5 v-14 h-4.5 z"/>`
    };
  })();

  /* ---------- 범례 기호 ---------- */
  const knobGlyph = (c, hollow) => `<svg class="glyph-k" viewBox="0 0 34 22" aria-hidden="true"><line x1="3" y1="19" x2="25" y2="5" stroke="${c}" stroke-width="1.6"/><circle cx="25" cy="5" r="4.5" fill="${hollow ? "var(--bg)" : c}" stroke="${hollow ? c : "none"}" stroke-width="1.4"/></svg>`;
  const GLYPH = {
    real: `<svg viewBox="0 0 64 26" aria-hidden="true"><line x1="5" y1="20" x2="59" y2="20" stroke="var(--red)" stroke-width="3.5"/><rect x="1" y="16" width="8" height="8" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/><rect x="55" y="16" width="8" height="8" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/></svg>`,
    felt: `<svg viewBox="0 0 64 26" aria-hidden="true"><path d="M5 20 C 14 16, 50 -12, 59 20" fill="none" stroke="var(--ink)" stroke-width="2.6"/><line x1="59" y1="20" x2="50" y2="2" stroke="var(--ink-2)" stroke-width="1.3"/><circle cx="50" cy="2" r="3.6" fill="var(--ink-2)"/></svg>`,
    pull: `<svg viewBox="0 0 64 26" aria-hidden="true"><line x1="5" y1="22" x2="59" y2="22" stroke="var(--red)" stroke-width="2"/><path d="M5 22 C 20 18, 46 -2, 59 22" fill="none" stroke="var(--ink-3)" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/><line x1="59" y1="22" x2="48" y2="4" stroke="var(--ink-2)" stroke-width="1.3"/><circle cx="48" cy="4" r="4" fill="var(--ink-2)"/><path d="M38 10 l6 -6 M38 4 l6 0 l0 6" fill="none" stroke="var(--ink)" stroke-width="1.4"/></svg>`
  };

  /* =========================================================
     화면 만들기
     ========================================================= */
  const kicker = (p, est) => `<p class="kicker"><span class="no">${esc(p.id)}</span>${esc(p.name)}${est ? EST : ""}</p>`;
  const lineGlyph = (src) => knobGlyph(COLOR[src] || NO_GUIDE, !src);

  // 1-① 문장 + 전체 지도
  $("#intro").innerHTML = `<div class="intro-text">${TEXT.intro.map((t) => `<p>${esc(t)}</p>`).join("")}</div>
    <svg class="map" id="map-intro" role="img" aria-label="스탠리파크 한 바퀴 경로와 길을 잃은 세 지점"></svg>
    <p class="place en">${esc(TEXT.place)}</p>`;
  const introMap = buildMap($("#map-intro"));

  // 1-② 읽는 법
  const L = TEXT.legend;
  $("#legend").innerHTML = `<ul class="legend-list">
    <li>${GLYPH.real}<span>${esc(L.real)}</span></li>
    <li>${GLYPH.felt}<span>${esc(L.felt)}</span></li>
    <li><span class="glyph-pair">${knobGlyph("var(--yellow)")}${knobGlyph("var(--pink)")}</span><span>${esc(L.guide[0])}<br>${esc(L.guide[1])}</span></li>
    <li class="pull">${GLYPH.pull}<span>${esc(L.pull)}</span></li>
  </ul>`;

  // 2. 지점마다 같은 순서: 위치 → 상황 → 체감 → 해결
  const host = $("#points");
  const locs = [], felts = [];
  POINTS.forEach((p, i) => {
    const est = isEst(p.actual) || isEst(p.felt);
    const photo = p.photo
      ? `<figure class="polaroid"><div class="ph missing"><span>${esc(TEXT.photoSlot)}<br>${esc(p.photo)}</span></div></figure>`
      : `<figure class="polaroid empty"><div class="ph"><span>${esc(p.photoNote || "")}</span></div></figure>`;
    const wrap = document.createElement("div");
    wrap.className = "point";
    wrap.innerHTML = `
      <section class="screen loc" id="p${esc(p.id)}-loc">${kicker(p)}<svg class="map" role="img" aria-label="${esc(p.id + " " + p.name)} 위치"></svg></section>
      <section class="screen situ" id="p${esc(p.id)}-situ">${kicker(p)}
        <dl class="rows">
          <div><dt>${lineGlyph(p.guide.source)}${esc(TEXT.guideLabel)}</dt><dd>${esc(p.guide.text)}</dd></div>
          <div><dt><i class="sq"></i>${esc(TEXT.spaceLabel)}</dt><dd>${esc(p.space)}</dd></div>
        </dl>
        <div class="pics"><div class="illus"><svg viewBox="0 0 200 140" aria-hidden="true">${ILLUS[p.illus] || ""}</svg></div>${photo}</div>
      </section>
      <section class="screen felt" id="p${esc(p.id)}-felt">${kicker(p, est)}
        <svg class="felt-svg" role="img" aria-label="실제 ${val(p.actual)}분, 체감 ${val(p.felt)}분"></svg>
        <p class="down">↓ ${esc(TEXT.scrollDown)}</p>
      </section>
      <section class="screen fix" id="p${esc(p.id)}-fix">${kicker(p)}
        <p class="fix-label">${esc(TEXT.fixLabel)}</p>
        <p class="fix-line">${lineGlyph(p.fix.source)}<span style="--c:${COLOR[p.fix.source] || NO_GUIDE}">${esc(p.fix.text)}</span></p>
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

    const map = buildMap(wrap.querySelector(".loc .map"), p);
    locs.push({ sec: wrap.querySelector(".loc"), map, from: i ? POINTS[i - 1].at * LOOP : 0, to: p.at * LOOP, p });
    felts.push(feltView(wrap.querySelector(".felt-svg"), p));
  });

  // 3-① 비교: 같은 기준선, 같은 축척
  const maxR = Math.max(...POINTS.map(ratioOf));
  const estIds = POINTS.filter((p) => isEst(p.actual) || isEst(p.felt)).map((p) => p.id);
  $("#compare").innerHTML = `<p class="cmp-est">${estIds.length ? `${esc(estIds.join("·"))} ${EST}` : ""}</p>
    <svg class="cmp-svg" role="img" aria-label="세 지점의 실제 시간과 체감 시간 비교"></svg>
    <div class="cmp-cap">${POINTS.map((p) => `<div class="${ratioOf(p) === maxR ? "max" : ""}">
      <p class="cmp-name"><span class="no">${esc(p.id)}</span>${esc(p.name)}</p>
      <p class="cmp-t"><span class="r">실제 ${val(p.actual)}분</span> <span>/ 체감 ${val(p.felt)}분</span></p>
      <p class="cmp-g">안내 ${esc(p.status)}</p></div>`).join("")}</div>`;

  function drawCompare() {
    const svg = $(".cmp-svg"), W = svg.clientWidth, H = svg.clientHeight;
    const cols = POINTS.length, colW = W / cols, pad = Math.min(24, colW * 0.08);
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
  $("#thesis").innerHTML = `<p class="def"><b>${esc(TEXT.definition[0])}</b><span>${esc(TEXT.definition[1])}</span></p>
    <p class="big">${TEXT.thesis.map((t) => `<span>${esc(t)}</span>`).join("")}</p>`;

  /* =========================================================
     위치 화면: 들어오면 전체 지도에서 이 지점으로 확대, 자전거가 이전 지점에서 이동
     ========================================================= */
  function zoomBox(map, p) {
    const c = P(p.at * LOOP);
    return map.fit([c[0] - 130, c[1] - 130, 260, 260]);
  }
  function locStart(l) { cancelAnimationFrame(l.raf); l.map.setBox(l.map.fit(VIEW)); l.map.setBike(l.from); l.played = false; }
  function locEnd(l) { l.map.setBox(zoomBox(l.map, l.p)); l.map.setBike(l.to); }
  function locPlay(l) {
    if (l.played) return;
    l.played = true;
    if (RM.matches) { locEnd(l); return; }
    const full = l.map.fit(VIEW), z = zoomBox(l.map, l.p), t0 = performance.now(), dur = 1800;
    const step = (now) => {
      const t = clamp((now - t0) / dur), e = ease(t), ez = ease(clamp((t - 0.35) / 0.65));
      l.map.setBox(full.map((v, k) => lerp(v, z[k], ez)));
      l.map.setBike(lerp(l.from, l.to, e));
      if (t < 1) l.raf = requestAnimationFrame(step);
    };
    l.raf = requestAnimationFrame(step);
  }

  function layoutAll() {
    introMap.setBox(introMap.fit(VIEW));
    introMap.setBike(0);
    locs.forEach((l) => (l.played ? locEnd(l) : locStart(l)));
    felts.forEach((f) => f.render());
    drawCompare();
  }
  layoutAll();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layoutAll, 120); });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      const l = locs.find((x) => x.sec === en.target);
      if (l) {
        if (en.intersectionRatio >= 0.55) locPlay(l);
        else if (!en.isIntersecting) locStart(l);
      } else if (en.isIntersecting) en.target.classList.add("in");
    }), { threshold: [0, 0.3, 0.55] });
    locs.forEach((l) => io.observe(l.sec));
    io.observe($("#legend"));
  } else {
    locs.forEach(locEnd);
    $("#legend").classList.add("in");
  }
})();
