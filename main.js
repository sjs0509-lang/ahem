/* =========================================================
   main.js — 지도 그리기와 스크롤 연동
   내용은 data.js에서 고치세요. 이 파일은 보통 손대지 않아도 됩니다.
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const val = (o) => (o && typeof o === "object" ? o.value : o);
  const isEst = (o) => !!(o && typeof o === "object" && o.estimated);
  const EST = '<span class="est">추정</span>';
  const COLOR = { person: "var(--yellow)", phone: "var(--pink)" };
  const f1 = (n) => n.toFixed(1);
  const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;

  /* ---------- 단순화한 스탠리파크 (SVG 좌표) ---------- */
  const VIEW = "150 120 770 760";
  // 한 바퀴 기본 경로: 대여점 → 공원 입구 → 해안을 따라 반시계 방향 → 출구 → 시내 도로 → 대여점
  const ROUTE = [[720, 645], [690, 595], [650, 545], [690, 470], [760, 390], [720, 300], [600, 235], [470, 215],
    [345, 255], [265, 350], [260, 465], [305, 560], [385, 630], [480, 668], [600, 688]];
  const PARK = [[640, 575], [720, 480], [800, 385], [755, 270], [610, 200], [468, 180], [320, 225], [232, 342],
    [228, 475], [283, 590], [372, 655], [470, 640], [560, 610]];
  const CITY = [[300, 900], [372, 690], [470, 672], [560, 642], [650, 605], [740, 512], [900, 470], [900, 900]];

  /* ---------- 곡선 계산 ---------- */
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
  function smoothClosedPath(pts) {
    const s = sampleClosed(pts, 12);
    return "M" + s.map(pt).join(" L") + " Z";
  }

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
  const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  function T(s) { const a = P(s - 2), b = P(s + 2); return norm([b[0] - a[0], b[1] - a[1]]); }
  const CENTER = ROUTE.reduce((c, p) => [c[0] + p[0] / ROUTE.length, c[1] + p[1] / ROUTE.length], [0, 0]);
  function outward(s) {
    const t = T(s), p = P(s);
    let n = [-t[1], t[0]];
    if (n[0] * (p[0] - CENTER[0]) + n[1] * (p[1] - CENTER[1]) < 0) n = [-n[0], -n[1]];
    return n;
  }

  /* ---------- 장면 → 경로 구간 ----------
     앵커 사이 길이 = 실제 시간 (한 바퀴 = 전체 라이딩 시간)
     핸들 길이와 부풂 = 체감 ÷ 실제                                   */
  const TOTAL = SCENES.reduce((a, s) => a + (val(s.actual) || 0), 0);
  let acc = 0;
  const SEGS = SCENES.map((sc) => {
    const a = val(sc.actual) || 0;
    if (a <= 0) return null;
    const s0 = (acc / TOTAL) * LOOP;
    acc += a;
    const s1 = (acc / TOTAL) * LOOP;
    const r = (val(sc.felt) || a) / a;
    const len = s1 - s0;
    const N = outward(s0 + len / 2);
    const pieces = Math.abs(r - 1) > 0.01 ? 1 : Math.max(1, Math.ceil(len / 120));
    let d = "", h1 = null, h2 = null;
    for (let p = 0; p < pieces; p++) {
      const a0 = s0 + (len * p) / pieces, b0 = s0 + (len * (p + 1)) / pieces;
      const A = P(a0), B = P(b0), TA = T(a0), TB = T(b0);
      const h = (b0 - a0) / 3;
      let c1, c2;
      if (Math.abs(r - 1) <= 0.01) {
        c1 = add(A, TA, h); c2 = add(B, TB, -h);
      } else {
        const hh = h * r, th = r > 1 ? Math.min(1.25, (r - 1) * 0.4) : 0;
        c1 = add(A, norm([TA[0] * Math.cos(th) + N[0] * Math.sin(th), TA[1] * Math.cos(th) + N[1] * Math.sin(th)]), hh);
        c2 = add(B, norm([-TB[0] * Math.cos(th) + N[0] * Math.sin(th), -TB[1] * Math.cos(th) + N[1] * Math.sin(th)]), hh);
      }
      if (p === 0) { d += "M" + pt(A); h1 = c1; }
      d += ` C${pt(c1)} ${pt(c2)} ${pt(B)}`;
      h2 = c2;
    }
    // 어긋남: 안내가 가리킨 쪽으로 갈라지는 두 번째 선
    let branch = null;
    if (sc.relation && val(sc.relation) === "어긋남") {
      const A = P(s0), TA = T(s0), inw = [-N[0], -N[1]], th = 0.75;
      const dir = norm([TA[0] * Math.cos(th) + inw[0] * Math.sin(th), TA[1] * Math.cos(th) + inw[1] * Math.sin(th)]);
      const Lb = Math.max(len * 0.85, 95);
      const E = add(A, dir, Lb);
      branch = { d: `M${pt(A)} C${pt(add(A, TA, Lb * 0.45))} ${pt(add(E, dir, -Lb * 0.4))} ${pt(E)}`, end: E };
    }
    return { s0, s1, len, r, d, A: P(s0), B: P(s1), h1, h2, N, mid: P(s0 + len / 2), branch };
  });

  /* ---------- SVG 만들기 ---------- */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const square = (p, size, parent, cls = "") =>
    el("rect", { x: f1(p[0] - size / 2), y: f1(p[1] - size / 2), width: size, height: size, fill: "var(--bg)", stroke: "var(--ink)", "stroke-width": 2, class: cls }, parent);

  function lineStyle(rel) {
    if (rel === "없음") return { "stroke-dasharray": "0.1 13", "stroke-linecap": "round", "stroke-width": 6 };
    return { "stroke-width": 4.5, "stroke-linecap": "round" };
  }

  function timeText(sc) {
    const a = val(sc.actual), f = val(sc.felt);
    let t = `실제 ${a}분`;
    if (f && f !== a) t += ` · 체감 ${f}분`;
    return t;
  }


  /* ---------- 지형 그리기 ---------- */
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
  // NODE 03이 일어난 넓은 차도: illus가 "road"인 장면의 기본 경로 위
  const ROAD_J = SCENES.findIndex((s) => s.illus === "road");
  const ROAD_PTS = [];
  if (ROAD_J >= 0 && SEGS[ROAD_J]) {
    const g = SEGS[ROAD_J];
    for (let x = g.s0 - 70; x <= g.s1 + 70; x += 8) ROAD_PTS.push(P(x));
  }

  function drawTerrain(svg, boxes) {
    const [vx, vy, vw, vh] = VIEW.split(" ").map(Number);
    // 바다
    el("rect", { x: vx - 400, y: vy - 400, width: vw + 800, height: vh + 800, fill: "var(--sea)" }, svg);
    [[230, 215], [800, 250], [215, 610], [880, 600], [600, 150], [330, 820]].forEach(([x, y]) =>
      el("path", withOut({ d: `M${x} ${y} q7 -6 14 0 t14 0 t14 0`, fill: "none" }), svg));
    // 시내 + 건물 블록
    el("path", withOut({ d: "M" + CITY.map(pt).join(" L") + " Z", fill: "var(--land)" }), svg);
    const blocks = el("g", {}, svg);
    let n = 0;
    for (let gx = -6; gx < 16; gx++) {
      for (let gy = -2; gy < 10; gy++) {
        const c = [300 + gx * 46 + gy * 22, 560 + gy * 40 - gx * 10];
        if (!inPoly(c, CITY) || near(c, SAMPLES, 30) || near(c, ROAD_PTS, 34)) continue;
        if (![[18, 0], [-18, 0], [0, 16], [0, -16]].every((o) => inPoly(add(c, o), CITY))) continue;
        el("rect", withOut({ x: f1(c[0] - 16), y: f1(c[1] - 13), width: 32, height: 26, rx: 2, fill: BLOCK_FILLS[(n++ * 7 + gx * 3 + 50) % BLOCK_FILLS.length], transform: `rotate(-14 ${f1(c[0])} ${f1(c[1])})` }), blocks);
      }
    }
    // 공원 땅
    el("path", withOut({ d: smoothClosedPath(PARK), fill: "var(--grass)" }), svg);
    // 둘레길 (공원 가장자리를 도는 길)
    const wall = smoothClosedPath(PARK.map((p) => [PARK_C[0] + (p[0] - PARK_C[0]) * 0.93, PARK_C[1] + (p[1] - PARK_C[1]) * 0.93]));
    el("path", { d: wall, fill: "none", stroke: "var(--ink)", "stroke-width": 12 }, svg);
    el("path", { d: wall, fill: "none", stroke: "var(--sand)", "stroke-width": 9.6 }, svg);
    // 숲
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
    const sh = add(SAMPLES[0], [8, 52]);
    const shop = el("g", { transform: `translate(${f1(sh[0])} ${f1(sh[1])})` }, svg);
    el("rect", withOut({ x: -20, y: -14, width: 40, height: 26, fill: "var(--blk-2)" }), shop);
    el("path", withOut({ d: "M-25 -13 L0 -30 L25 -13 Z", fill: "var(--car-1)" }), shop);
    el("rect", withOut({ x: -6, y: -2, width: 12, height: 14, fill: "#fff" }), shop);
    [-13, 13].forEach((x) => el("circle", withOut({ cx: x, cy: 4, r: 4.5, fill: "#fff" }), shop));
    boxes.push([sh[0] - 27, sh[1] - 32, sh[0] + 27, sh[1] + 14]);
    // 빈 곳에 별과 점 조금
    [[190, 175, 7], [885, 300, 6], [180, 830, 6], [890, 790, 7]].forEach(([x, y, r]) => el("path", withOut({ d: star(x, y, r), fill: "var(--blk-2)" }), svg));
    [[640, 140, 3.5], [250, 520, 3], [870, 680, 3]].forEach(([x, y, r]) => el("circle", withOut({ cx: x, cy: y, r, fill: "#fff" }), svg));
  }

  let maskId = 0;
  function buildMap(svg) {
    svg.setAttribute("viewBox", VIEW);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const uid = "m" + (maskId++);
    const defs = el("defs", {}, svg);

    // 지형 (얇은 검정 외곽선 + 단색 면)
    const boxes = []; // 글자끼리 겹치지 않게 차지한 자리
    drawTerrain(svg, boxes);
    const place = (x, y, t, anchor = "middle") => {
      el("text", { x, y, "text-anchor": anchor, "font-family": "Archivo Black, sans-serif", "font-size": 12, fill: "var(--sea-ink)", "letter-spacing": "0.06em" }, svg).textContent = t;
      const w = t.length * 12 * 0.72, x0 = anchor === "end" ? x - w : anchor === "start" ? x : x - w / 2;
      boxes.push([x0 - 4, y - 12, x0 + w + 4, y + 4]);
    };
    place(205, 690, "ENGLISH BAY");
    place(845, 452, "COAL HARBOUR", "end");
    place(500, 160, "BURRARD INLET");

    const segs = SEGS.map((g, j) => {
      if (!g) return null;
      const sc = SCENES[j], rel = val(sc.relation);
      const grp = el("g", {}, svg);
      // 지나간 만큼만 보이게 하는 마스크
      const m = el("mask", { id: `${uid}k${j}`, maskUnits: "userSpaceOnUse", x: -500, y: -500, width: 2000, height: 2000 }, defs);
      const mp = el("path", { d: g.d, fill: "none", stroke: "#fff", "stroke-width": 30, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, m);
      el("path", Object.assign({ d: g.d, fill: "none", stroke: "var(--blue)", mask: `url(#${uid}k${j})` }, lineStyle(rel)), grp);

      let br = null, brEnd = null;
      if (g.branch) {
        br = el("path", { d: g.branch.d, fill: "none", stroke: "var(--pink)", "stroke-width": 3, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, grp);
        brEnd = el("g", { opacity: 0 }, grp);
        square(g.branch.end, 9, brEnd).setAttribute("stroke", "var(--pink)");
      }

      // 펜툴 핸들 (안내가 있을 때만, 색 = 안내 출처)
      const handles = el("g", { opacity: 0 }, grp);
      const src = sc.guide && sc.guide.source;
      if (src) {
        [[g.A, g.h1], [g.B, g.h2]].forEach(([a, c]) => {
          el("line", { x1: f1(a[0]), y1: f1(a[1]), x2: f1(c[0]), y2: f1(c[1]), stroke: COLOR[src], "stroke-width": 1.6 }, handles);
          el("circle", { cx: f1(c[0]), cy: f1(c[1]), r: 5, fill: COLOR[src] }, handles);
        });
      }
      const anchor = el("g", { opacity: 0 }, grp);
      square(g.A, 12, anchor);
      return { g, sc, mp, br, brEnd, handles, anchor };
    });

    // 대여점 (출발 = 도착)
    const shop = SEGS[0].A;
    square(shop, 15, svg).setAttribute("stroke-width", 3);

    // 주석: 점 + 가는 선 + 대문자 라벨 (겹치면 바깥으로 밀어냄)
    const [vx, vy, vw, vh] = VIEW.split(" ").map(Number);
    // 화면이 작으면 (휴대폰) 주석 글자를 키운다: 라벨이 최소 12px로 보이게
    const pxPerUnit = Math.min(svg.clientWidth / vw, svg.clientHeight / vh) || 1;
    const K = clamp(12 / (17 * pxPerUnit), 1, 1.7);
    const layout = (n) => {
      const anchor = n[0] > 0.3 ? "start" : n[0] < -0.3 ? "end" : "middle";
      const dx = anchor === "start" ? 6 : anchor === "end" ? -6 : 0;
      const dy = (n[1] > 0.3 ? 16 : n[1] < -0.3 ? -20 : 5) * K;
      return { anchor, dx, dy };
    };
    const boxOf = (p, n, w) => {
      const { anchor, dx, dy } = layout(n);
      const x = p[0] + dx, y = p[1] + dy;
      const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      return [x0 - 4, y - 17 * K, x0 + w + 4, y + 24 * K];
    };
    // 경로 선 위에도 글자가 올라가지 않게
    const obstacles = [];
    segs.forEach((s) => {
      if (!s) return;
      [s.mp, s.br].forEach((path) => {
        if (!path) return;
        const L = path.getTotalLength();
        for (let d = 0; d <= L; d += 10) { const q = path.getPointAtLength(d); obstacles.push([q.x, q.y]); }
      });
      if (s.sc.guide && s.sc.guide.source) {
        [[s.g.A, s.g.h1], [s.g.B, s.g.h2]].forEach(([a, c]) => { for (let t = 0; t <= 1; t += 0.1) obstacles.push([lerp(a[0], c[0], t), lerp(a[1], c[1], t)]); });
      }
    });
    const hits = (b) => boxes.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) ||
      obstacles.some((o) => o[0] > b[0] && o[0] < b[2] && o[1] > b[1] && o[1] < b[3]);
    // 실제로 보이는 영역 (화면이 viewBox보다 길면 위아래 여백도 쓴다)
    const visW = (svg.clientWidth / pxPerUnit) || vw, visH = (svg.clientHeight / pxPerUnit) || vh;
    const bx0 = vx + vw / 2 - visW / 2, by0 = vy + vh / 2 - visH / 2;
    const inside = (b) => b[0] > bx0 + 6 && b[2] < bx0 + visW - 6 && b[1] > by0 + 6 && b[3] < by0 + visH - 6;
    const rot = (n, a) => [n[0] * Math.cos(a) - n[1] * Math.sin(a), n[0] * Math.sin(a) + n[1] * Math.cos(a)];
    // 지시선끼리 교차하지 않게
    const leaders = [];
    const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    const crosses = (a, b) => leaders.some(([c, d]) => ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d));
    // 지시선이 다른 글자 위를 지나가지 않게
    const inBox = (q, b) => q[0] > b[0] && q[0] < b[2] && q[1] > b[1] && q[1] < b[3];
    const along = (a, b) => { const out = []; for (let t = 0.08; t < 1; t += 0.06) out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); return out; };
    const lineThroughBoxes = (a, b) => along(a, b).some((q) => boxes.some((bx) => inBox(q, bx)));
    const leadersThrough = (bx) => leaders.some(([a, b]) => along(a, b).some((q) => inBox(q, bx)));
    // 바깥 방향을 기준으로 각도와 거리를 바꿔 가며 겹치지 않는 자리를 찾는다
    // (완벽한 자리가 없으면 가장 덜 겹치는 자리)
    const placeNote = (at, n0, dist, w) => {
      let best = null;
      for (const extra of [0, 34, 68, 102, 136, 170, 204, 238]) {
        for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2, 2.8, -2.8]) {
          const n = rot(n0, a), p = add(at, n, dist + extra), b = boxOf(p, n, w);
          const cost = (inside(b) ? 0 : 1000) + (hits(b) ? 100 : 0) + (crosses(at, p) ? 140 : 0) +
            (lineThroughBoxes(at, p) ? 120 : 0) + (leadersThrough(b) ? 120 : 0) + extra * 0.2 + Math.abs(a) * 4;
          if (!best || cost < best.cost) best = { cost, p, n, b };
        }
      }
      boxes.push(best.b);
      leaders.push([at, best.p]);
      return best;
    };
    function note(at, n0, dist, label, sub, parent, color = "var(--ink)") {
      const w = Math.max(label.length * 12.5, (sub || "").length * 11) * K;
      const { p, n } = placeNote(at, n0, dist, w);
      const g = el("g", { opacity: 0 }, parent);
      el("line", { x1: f1(at[0]), y1: f1(at[1]), x2: f1(p[0]), y2: f1(p[1]), stroke: "var(--ink)", "stroke-width": 1 }, g);
      el("circle", { cx: f1(at[0]), cy: f1(at[1]), r: 4.5, fill: color }, g);
      const { anchor, dx, dy } = layout(n);
      const t = el("text", { x: f1(p[0] + dx), y: f1(p[1] + dy), "text-anchor": anchor, "font-family": "Archivo Black, sans-serif", "font-size": f1(17 * K), fill: "var(--ink)" }, g);
      t.textContent = label;
      if (sub) {
        const s = el("text", { x: f1(p[0] + dx), y: f1(p[1] + dy + 17 * K), "text-anchor": anchor, "font-family": "Pretendard Variable, Pretendard, sans-serif", "font-size": f1(13.5 * K), "font-weight": 600, fill: "var(--ink-2)" }, g);
        s.textContent = sub;
      }
      return g;
    }
    const noteLayer = el("g", {}, svg);
    // 출발 구간은 대여점 주석에 합친다
    const shopNote = note(shop, norm([1, 0.2]), 70, "BIKE RENTAL", `대여점 · 출발 ${timeText(SCENES[0])}`, noteLayer, "var(--blue)");
    shopNote.setAttribute("opacity", 1);
    // NODE 라벨이 먼저 좋은 자리를 차지하게 두 번에 나눠 놓는다
    [true, false].forEach((nodesFirst) => segs.forEach((s, j) => {
      if (!s || !!s.sc.node !== nodesFirst) return;
      if (j === 0) { s.note = el("g", {}, noteLayer); return; }
      const node = s.sc.node;
      s.note = note(s.g.mid, s.g.N, node ? 74 : 58, s.sc.label, timeText(s.sc), noteLayer, node ? "var(--ink)" : "var(--blue)");
    }));

    // 자전거
    const bike = el("g", { class: "bike" }, svg);
    const flip = el("g", {}, bike);
    const wheels = [-12, 12].map((x) => {
      const w = el("g", { transform: `translate(${x} 0)` }, flip);
      el("circle", { r: 9, fill: "var(--bg)", stroke: "var(--ink)", "stroke-width": 2.4 }, w);
      const spin = el("g", {}, w);
      el("line", { x1: -9, y1: 0, x2: 9, y2: 0, stroke: "var(--ink)", "stroke-width": 1.2 }, spin);
      el("line", { x1: 0, y1: -9, x2: 0, y2: 9, stroke: "var(--ink)", "stroke-width": 1.2 }, spin);
      return spin;
    });
    el("path", { d: "M-12 0 L-3 -12 L9 -12 L12 0 M-3 -12 L0 0 L-12 0 M9 -12 L7 -17 L12 -17 M-3 -12 L-5 -16", fill: "none", stroke: "var(--ink)", "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }, flip);
    el("path", { d: "M-4 -16 L2 -27", stroke: "var(--pink)", "stroke-width": 4, "stroke-linecap": "round" }, flip);
    el("circle", { cx: 3, cy: -32, r: 5, fill: "var(--ink)" }, flip);

    return { segs, bike, flip, wheels };
  }

  /* 진행 상태 적용: fs[j] = 구간 j가 그려진 비율, reached = 도달한 장면 번호 */
  function applyProgress(map, fs, reached) {
    map.segs.forEach((s, j) => {
      if (!s) return;
      const f = fs[j];
      s.mp.setAttribute("stroke-dashoffset", (1 - f).toFixed(4));
      s.mp.setAttribute("visibility", f > 0.001 ? "visible" : "hidden");
      const on = reached >= j ? 1 : 0;
      s.anchor.setAttribute("opacity", on);
      s.handles.setAttribute("opacity", on);
      s.note.setAttribute("opacity", on);
      if (s.br) {
        const fb = clamp((f - 0.05) / 0.5);
        s.br.setAttribute("stroke-dashoffset", (1 - fb).toFixed(4));
        s.br.setAttribute("visibility", fb > 0.001 ? "visible" : "hidden");
        s.brEnd.setAttribute("opacity", fb > 0.98 ? 1 : 0);
      }
    });
  }

  function placeBike(map, j, f, spin) {
    const s = map.segs[j];
    let p, q;
    if (!s) { p = SEGS[0].A; q = add(p, [1, 0]); }
    else {
      const path = s.mp, L = path.getTotalLength();
      const a = path.getPointAtLength(L * clamp(f)), b = path.getPointAtLength(L * clamp(f + 0.01));
      p = [a.x, a.y]; q = [b.x, b.y];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) { const c = path.getPointAtLength(L * clamp(f - 0.01)); q = [2 * p[0] - c.x, 2 * p[1] - c.y]; }
    }
    map.bike.setAttribute("transform", `translate(${f1(p[0])} ${f1(p[1] - 10)})`);
    map.flip.setAttribute("transform", q[0] < p[0] - 0.05 ? "scale(-1 1)" : "");
    map.wheels.forEach((w) => w.setAttribute("transform", `rotate(${f1(spin)})`));
  }

  /* ---------- 읽는 법 기호 ---------- */
  const G = {
    length: `<line x1="4" y1="11" x2="52" y2="11" stroke="var(--blue)" stroke-width="3.5"/><rect x="0" y="7" width="8" height="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/><rect x="48" y="7" width="8" height="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/>`,
    felt: `<path d="M4 18 C 4 -14, 52 -14, 52 18" fill="none" stroke="var(--blue)" stroke-width="3.5"/><line x1="4" y1="18" x2="4" y2="-8" stroke="var(--pink)" stroke-width="1.4"/><circle cx="4" cy="-8" r="3" fill="var(--pink)"/><line x1="52" y1="18" x2="52" y2="-8" stroke="var(--pink)" stroke-width="1.4"/><circle cx="52" cy="-8" r="3" fill="var(--pink)"/><rect x="0" y="14" width="8" height="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/><rect x="48" y="14" width="8" height="8" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/>`,
    match: `<line x1="2" y1="11" x2="54" y2="11" stroke="var(--blue)" stroke-width="4" stroke-linecap="round"/>`,
    none: `<line x1="3" y1="11" x2="54" y2="11" stroke="var(--blue)" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 9"/>`,
    split: `<path d="M2 15 C 20 15, 36 15, 54 15" fill="none" stroke="var(--blue)" stroke-width="4" stroke-linecap="round"/><path d="M2 15 C 18 15, 30 2, 50 -2" fill="none" stroke="var(--pink)" stroke-width="2.6" stroke-linecap="round"/>`,
    color: `<line x1="4" y1="16" x2="22" y2="0" stroke="var(--yellow)" stroke-width="1.6"/><circle cx="22" cy="0" r="3.5" fill="var(--yellow)"/><line x1="34" y1="16" x2="52" y2="0" stroke="var(--pink)" stroke-width="1.6"/><circle cx="52" cy="0" r="3.5" fill="var(--pink)"/><line x1="0" y1="16" x2="56" y2="16" stroke="var(--blue)" stroke-width="3.5"/>`,
    wheel: `<circle cx="14" cy="11" r="10" fill="none" stroke="var(--ink)" stroke-width="2.4"/><line x1="4" y1="11" x2="24" y2="11" stroke="var(--ink)" stroke-width="1"/><line x1="14" y1="1" x2="14" y2="21" stroke="var(--ink)" stroke-width="1"/><path d="M30 4 A 12 12 0 0 1 30 18" fill="none" stroke="var(--ink)" stroke-width="1.4"/><path d="M27 17 L30 19 L33 16" fill="none" stroke="var(--ink)" stroke-width="1.4"/>`
  };
  const RULES = [
    ["length", "앵커 사이 경로 길이", "실제 시간"],
    ["felt", "핸들 길이 · 곡선의 부풂", "체감 시간 (실제와 같으면 부풀지 않음)"],
    ["match", "실선", "안내와 공간이 맞음"],
    ["none", "끊긴 점선", "안내 없음"],
    ["split", "두 갈래", "안내와 공간이 어긋남"],
    ["color", "핸들 색", "노랑 사람 · 분홍 휴대폰 / 파랑 경로 = 공간"],
    ["wheel", "바퀴", "돌면 이동, 멈추면 멈춤"]
  ];
  const ruleSvg = (k) => `<svg viewBox="0 0 56 22" aria-hidden="true">${G[k]}</svg>`;

  /* ---------- 1. 첫 화면 ---------- */
  document.querySelectorAll(".hero .corner").forEach((c) => { c.textContent = TEXT.corner[+c.dataset.t]; });
  $("#hero-q").textContent = TEXT.question;
  $("#hero-def").innerHTML = `<b>${esc(TEXT.definition[0])}</b> — ${esc(TEXT.definition[1])}`;
  $("#hero-scroll").textContent = TEXT.scroll;
  $(".hero-curve").innerHTML = `
    <path d="M40 120 C160 20 240 30 300 80 C360 130 470 150 560 40" fill="none" stroke="var(--blue)" stroke-width="4"/>
    <line x1="40" y1="120" x2="160" y2="20" stroke="var(--yellow)" stroke-width="1.5"/><circle cx="160" cy="20" r="5" fill="var(--yellow)"/>
    <line x1="240" y1="30" x2="360" y2="130" stroke="var(--pink)" stroke-width="1.5"/><circle cx="240" cy="30" r="5" fill="var(--pink)"/><circle cx="360" cy="130" r="5" fill="var(--pink)"/>
    <line x1="560" y1="40" x2="470" y2="150" stroke="var(--yellow)" stroke-width="1.5"/><circle cx="470" cy="150" r="5" fill="var(--yellow)"/>
    ${[[40, 120], [300, 80], [560, 40]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>`).join("")}`;

  /* ---------- 2. 지도 위 한 바퀴 ---------- */
  const map = buildMap($("#map"));
  $("#howto").innerHTML = `<h2>How to read</h2><ul>${RULES.slice(0, 5).map(([k, a, b]) => `<li>${ruleSvg(k)}<span><b>${a}</b> = ${b}</span></li>`).join("")}</ul>`;

  /* ---------- NODE 화면 ----------
     왼쪽 가장자리에 걸친 바퀴 (바퀴살과 중심축만)
     빨간 직선 = 실제 거리(실제 시간, 고정) / 회색 펜툴 곡선 = 체감 경로
     오른쪽 핸들만 당길 수 있고, 곡선 길이 ÷ 직선 길이 × 실제 시간 = 체감 시간  */
  const ILLUS = (function () {
    const o = 'stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
    const tree = (x, y, r, fill, rot = 0) => `<path ${o} fill="${fill}" d="${scallop(x, y, r, 8, rot)}"/>`;
    return {
      // 숲길 갈림길, 입구 표지판 없음, 멀리 사람 한 명
      fork: `<rect ${o} width="200" height="140" fill="var(--grass)"/>
        <path ${o} fill="var(--sand)" d="M86 140 L92 96 L32 36 L48 30 L100 82 L152 30 L168 36 L108 96 L114 140 Z"/>
        ${tree(22, 92, 20, "var(--tree-1)")}${tree(178, 98, 22, "var(--tree-2)", 1)}${tree(100, 26, 18, "var(--tree-3)", 2)}${tree(58, 128, 14, "var(--tree-2)", 3)}${tree(150, 132, 12, "var(--tree-1)")}
        <rect ${o} x="128" y="74" width="4" height="30" fill="#fff"/><rect ${o} x="116" y="62" width="28" height="14" fill="#fff"/>
        <circle ${o} cx="156" cy="40" r="3.5" fill="var(--yellow)"/><rect ${o} x="153" y="44" width="6" height="9" rx="2" fill="var(--yellow)"/>
        <path ${o} fill="#fff" d="${star(28, 22, 5)}"/>`,
      // 휴대폰 말풍선이 가리키는 길은 점선으로만 있고 실제로는 나무만
      phone: `<rect ${o} width="200" height="140" fill="var(--grass)"/>
        ${tree(110, 40, 24, "var(--tree-1)")}${tree(152, 52, 22, "var(--tree-2)", 1)}${tree(184, 30, 18, "var(--tree-3)", 2)}${tree(132, 92, 20, "var(--tree-3)", 3)}${tree(176, 106, 20, "var(--tree-1)")}${tree(92, 100, 16, "var(--tree-2)")}
        <path d="M60 118 C 90 100, 110 80, 140 66" fill="none" stroke="var(--pink)" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>
        <rect ${o} x="14" y="70" width="30" height="54" rx="5" fill="var(--pink-soft)"/><rect ${o} x="19" y="78" width="20" height="34" fill="#fff"/>
        <path ${o} fill="#fff" d="M10 20 h70 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-44 l-10 12 l2 -12 h-18 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 z"/>
        <path d="M20 38 h40" stroke="var(--pink)" stroke-width="2.4" stroke-dasharray="2 5" stroke-linecap="round"/><path ${o} fill="var(--pink)" d="M60 33 l10 5 l-10 5 z"/>`,
      // 차가 많은 도로 위 작은 자전거, 휴대폰 화살표는 앞을 가리킴
      road: `<rect ${o} width="200" height="140" fill="var(--land)"/>
        <path ${o} fill="var(--road)" d="M0 44 L200 30 L200 112 L0 126 Z"/>
        <path d="M0 85 L200 71" stroke="#fff" stroke-width="2" stroke-dasharray="12 9"/>
        ${[[30, 58, "var(--car-1)"], [112, 52, "var(--car-2)"], [150, 86, "var(--car-3)"], [62, 100, "var(--car-2)"]].map(([x, y, c]) => `<g transform="translate(${x} ${y}) rotate(-4)"><rect ${o} x="-16" y="-8" width="32" height="16" rx="4" fill="${c}"/><rect ${o} x="2" y="-5" width="9" height="10" rx="1.5" fill="#fff"/></g>`).join("")}
        <g transform="translate(98 116)"><circle ${o} cx="-6" cy="0" r="5" fill="#fff"/><circle ${o} cx="6" cy="0" r="5" fill="#fff"/><path ${o} fill="none" d="M-6 0 L-1 -7 L5 -7 L6 0 M-1 -7 L0 0"/><circle ${o} cx="1" cy="-13" r="2.6" fill="var(--ink)"/></g>
        <rect ${o} x="160" y="6" width="26" height="40" rx="4" fill="var(--pink-soft)"/><path ${o} fill="var(--pink)" d="M173 12 l7 10 h-4.5 v14 h-5 v-14 h-4.5 z"/>`
    };
  })();

  const nodeView = (function () {
    const svg = $("#node-svg"), media = $("#node-media"), sentence = $("#node-sentence");
    const C1U = [0.2, -0.08], REST2U = [0.8, -0.08];
    const DIR = [Math.cos((100 * Math.PI) / 180), -Math.sin((100 * Math.PI) / 180)];
    const bz = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]); };
    const lenOf = (a, b, c, d) => { let L = 0, q0 = a; for (let i = 1; i <= 80; i++) { const q = bz(a, b, c, d, i / 80); L += Math.hypot(q[0] - q0[0], q[1] - q0[1]); q0 = q; } return L; };
    const ratioU = (c2u) => lenOf([0, 0], C1U, c2u, [1, 0]);
    const REST_R = ratioU(REST2U);
    // 기록된 체감 비율이 되는 오른쪽 핸들 위치 (위로 뻗은 방향에서 길이를 찾음)
    function ghostU(r) {
      if (r <= REST_R + 0.03) return REST2U.slice();
      let lo = 0, hi = 50;
      for (let n = 0; n < 50; n++) { const m = (lo + hi) / 2; if (ratioU(add([1, 0], DIR, m)) < r) lo = m; else hi = m; }
      return add([1, 0], DIR, lo);
    }
    function bboxU(c2u) {
      let x1 = 1, y0 = 0;
      for (let i = 0; i <= 40; i++) { const q = bz([0, 0], C1U, c2u, [1, 0], i / 40); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); }
      [C1U, c2u].forEach((q) => { x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); });
      return { x1, y0 };
    }
    const NODES = SCENES.filter((s) => s.node);
    const ratioOf = (s) => { const a = val(s.actual) || 1; return (val(s.felt) || a) / a; };
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)");

    let sc = null, W, H, G, A, B, chord, R, cx, c1, c2, rest, ghost, r, matched, anim, roll, spinRaf, touched, refs, active = false;

    function geometry() {
      W = svg.clientWidth; H = svg.clientHeight;
      const wide = W >= 900 && W / H >= 1.2;
      R = wide ? Math.min(H * 0.33, W * 0.2) : Math.min(H * 0.17, W * 0.34);
      G = H * 0.7;
      cx = R * 0.62;
      A = [cx, G];
      const mb = media.getBoundingClientRect(), sb = svg.getBoundingClientRect();
      const top = wide ? 70 : mb.bottom - sb.top + 40;
      const xLimit = wide ? Math.min(W * 0.64, mb.left - sb.left - 30) : W - 24;
      // 모든 NODE가 같은 축척(1분 = 같은 길이)
      let k = Infinity;
      NODES.forEach((s) => {
        const bb = bboxU(ghostU(ratioOf(s))), a = val(s.actual) || 1;
        k = Math.min(k, (G - top) / Math.max(0.1, -bb.y0) / a, (xLimit - A[0]) / bb.x1 / a);
      });
      chord = (val(sc.actual) || 1) * k;
      B = [A[0] + chord, G];
      const px = (u) => [A[0] + u[0] * chord, G + u[1] * chord];
      c1 = px(C1U); rest = px(REST2U);
      r = ratioOf(sc);
      ghost = px(ghostU(r));
    }
    const dOf = (q) => `M${pt(A)} C${pt(c1)} ${pt(q)} ${pt(B)}`;
    const ring = (ro, ri) => `M${ro} 0 A${ro} ${ro} 0 1 0 ${-ro} 0 A${ro} ${ro} 0 1 0 ${ro} 0 Z M${ri} 0 A${ri} ${ri} 0 1 0 ${-ri} 0 A${ri} ${ri} 0 1 0 ${ri} 0 Z`;
    const minLabel = (m) => `${Math.round(m)}분`;

    function render() {
      geometry();
      svg.setAttribute("viewBox", `0 0 ${f1(W)} ${f1(H)}`);
      const src = sc.guide && sc.guide.source, hc = src ? COLOR[src] : "var(--ink)";
      const est = isEst(sc.actual) || isEst(sc.felt);
      let spokes = "";
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        spokes += `<line x1="${f1(Math.cos(a) * R * 0.07)}" y1="${f1(Math.sin(a) * R * 0.07)}" x2="${f1(Math.cos(a) * R * 0.86)}" y2="${f1(Math.sin(a) * R * 0.86)}"/>`;
      }
      const rw = 13;
      svg.innerHTML = `
        <line class="n-ground" x1="0" y1="${f1(G)}" x2="${f1(W)}" y2="${f1(G)}"/>
        <g transform="translate(${f1(cx)} ${f1(G - R)})"><g class="n-wheel">
          <path class="n-tire" fill-rule="evenodd" d="${ring(f1(R), f1(R * 0.86))}"/>
          <g class="n-spokes">${spokes}</g>
          <circle class="n-hub" r="${f1(R * 0.07)}"/>
        </g></g>
        <path class="n-ghost" d="${dOf(ghost)}"/>
        <line class="n-real" x1="${f1(A[0])}" y1="${f1(G)}" x2="${f1(B[0])}" y2="${f1(G)}"/>
        <path class="n-curve"/>
        <line class="n-handle" stroke="${hc}" x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(c1[0])}" y2="${f1(c1[1])}"/>
        <circle class="n-knob" fill="${hc}" r="5.5" cx="${f1(c1[0])}" cy="${f1(c1[1])}"/>
        <g class="n-drag"><line class="n-handle" stroke="${hc}"/><circle class="n-knob" fill="${hc}" r="8"/><circle class="n-hit" r="26"/></g>
        ${[A, B].map((q) => `<rect class="n-anchor" x="${f1(q[0] - 6)}" y="${f1(q[1] - 6)}" width="12" height="12"/>`).join("")}
        <text class="n-label n-real-t" x="${f1((A[0] + B[0]) / 2)}" y="${f1(G + 30)}" text-anchor="middle">실제 ${minLabel(val(sc.actual))}${est ? '<tspan class="n-est" dx="8">추정</tspan>' : ""}</text>
        <text class="n-label n-felt-t" text-anchor="middle"></text>
        <text class="n-hint">${esc(TEXT.pullHint)}</text>
        <g class="n-roll" visibility="hidden"><g class="n-roll-w">
          <circle class="n-tire-s" r="${rw}"/><line x1="${-rw}" y1="0" x2="${rw}" y2="0"/><line x1="0" y1="${-rw}" x2="0" y2="${rw}"/>
        </g></g>`;
      refs = {
        wheel: svg.querySelector(".n-wheel"), curve: svg.querySelector(".n-curve"), ghost: svg.querySelector(".n-ghost"),
        drag: svg.querySelector(".n-drag"), felt: svg.querySelector(".n-felt-t"), hint: svg.querySelector(".n-hint"),
        roll: svg.querySelector(".n-roll"), rollW: svg.querySelector(".n-roll-w"), rw
      };
      refs.hint.classList.toggle("off", touched);
      refs.drag.addEventListener("pointerdown", start);
      // 휴대폰: 핸들을 잡은 손가락은 화면을 스크롤하지 않게
      refs.drag.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    }

    function draw() {
      refs.curve.setAttribute("d", dOf(c2));
      const ln = refs.drag.querySelector("line");
      ln.setAttribute("x1", f1(B[0])); ln.setAttribute("y1", f1(B[1]));
      ln.setAttribute("x2", f1(c2[0])); ln.setAttribute("y2", f1(c2[1]));
      refs.drag.querySelectorAll("circle").forEach((ci) => { ci.setAttribute("cx", f1(c2[0])); ci.setAttribute("cy", f1(c2[1])); });
      // 체감 = 곡선 길이 ÷ 직선 길이 × 실제 시간
      const felt = matched ? val(sc.felt) : (val(sc.actual) || 0) * (lenOf(A, c1, c2, B) / chord);
      let top = [B[0], G];
      for (let i = 0; i <= 40; i++) { const q = bz(A, c1, c2, B, i / 40); if (q[1] < top[1]) top = q; }
      refs.felt.setAttribute("x", f1(clamp(top[0], 60, W - 60)));
      refs.felt.setAttribute("y", f1(Math.min(top[1] - 16, G - 18)));
      refs.felt.textContent = `체감 ${minLabel(felt)}`;
      refs.hint.setAttribute("x", f1(c2[0] + 16));
      refs.hint.setAttribute("y", f1(c2[1] - 14));
    }

    function toSvg(e) {
      const b = svg.getBoundingClientRect();
      return [clamp(e.clientX - b.left, A[0] + 10, W - 10), clamp(e.clientY - b.top, 8, G + 30)];
    }

    function start(e) {
      e.preventDefault();
      cancelAnimationFrame(anim);
      if (!touched) { touched = true; refs.hint.classList.add("off"); }
      const target = e.currentTarget;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 드래그는 계속 */ }
      const move = (ev) => {
        const q = toSvg(ev);
        const ratio = lenOf(A, c1, q, B) / chord;
        if (r > REST_R + 0.1 && Math.abs(ratio - r) < r * 0.12) {
          // 자석처럼 기록된 곡선에 딱 맞춤 → 바퀴가 그 곡선을 따라 한 번 굴러감
          c2 = ghost.slice();
          if (!matched) { matched = true; rollOnce(); }
        } else {
          c2 = q;
          matched = false;
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

    // 점선까지 못 당기고 놓으면 천천히 제자리로
    function springBack() {
      const from = c2.slice(), t0 = performance.now(), dur = r > REST_R + 0.1 ? 900 : 380;
      const step = (now) => {
        const t = clamp((now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
        c2 = [lerp(from[0], rest[0], e), lerp(from[1], rest[1], e)];
        draw();
        if (t < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function rollOnce() {
      cancelAnimationFrame(roll);
      const path = refs.ghost, L = path.getTotalLength(), t0 = performance.now(), dur = RM.matches ? 1 : 1800;
      refs.roll.setAttribute("visibility", "visible");
      const step = (now) => {
        const t = clamp((now - t0) / dur), d = L * t, q = path.getPointAtLength(d), q2 = path.getPointAtLength(Math.min(L, d + 1));
        const nv = norm([q2.y - q.y, -(q2.x - q.x)]);
        const c = add([q.x, q.y], nv, refs.rw + 2);
        refs.roll.setAttribute("transform", `translate(${f1(c[0])} ${f1(c[1])})`);
        refs.rollW.setAttribute("transform", `rotate(${f1((d / refs.rw) * 57.3)})`);
        if (t < 1) roll = requestAnimationFrame(step);
      };
      roll = requestAnimationFrame(step);
    }

    // NODE 03(이동)은 바퀴가 계속 돌고, NODE 01·02(멈춤)는 멈춰 있다
    function spinLoop(now) {
      if (!active) return;
      if (sc && sc.moving && !RM.matches) refs.wheel.setAttribute("transform", `rotate(${f1(((now / 1000) * 90) % 360)})`);
      spinRaf = requestAnimationFrame(spinLoop);
    }

    function photoHtml() {
      if (!sc.photo) return `<figure class="polaroid empty"><div class="ph"><span>${esc(TEXT.noPhoto)}</span></div></figure>`;
      return `<figure class="polaroid"><div class="ph missing" id="node-ph"><span>photos/${esc(sc.photo)}</span></div></figure>`;
    }

    function setup(scene) {
      sc = scene;
      matched = false; touched = false;
      cancelAnimationFrame(anim); cancelAnimationFrame(roll);
      media.innerHTML = `<p class="node-head"><span class="en">${esc(sc.label)}</span>${esc(sc.title)}</p>
        <div class="node-pics"><div class="illus"><svg viewBox="0 0 200 140" aria-hidden="true">${ILLUS[sc.illus] || ""}</svg></div>${photoHtml()}</div>`;
      const ph = $("#node-ph");
      if (ph) {
        // 사진이 있으면 보이고, 없으면 회색 자리표시로 남는다
        const img = new Image();
        img.alt = "";
        img.onload = () => ph.classList.remove("missing");
        img.src = "photos/" + sc.photo;
        ph.appendChild(img);
      }
      sentence.textContent = sc.sentence || "";
      render();
      c2 = rest.slice();
      draw();
    }

    function setActive(on) {
      if (on === active) return;
      active = on;
      if (on) spinRaf = requestAnimationFrame(spinLoop);
      else cancelAnimationFrame(spinRaf);
    }

    function relayout() {
      if (!sc) return;
      render();
      c2 = (matched ? ghost : rest).slice();
      draw();
    }

    return { setup, setActive, relayout };
  })();

  // 스크롤 구간: 구간 길이(vh)로만 속도를 표현한다. 스크롤 자체는 건드리지 않음.
  const VH_PER_MIN = 3.2, CLOSE_VH = 170;
  const items = [{ type: "intro", i: 0, len: 70 }];
  SCENES.forEach((sc, i) => {
    if (sc.node) items.push({ type: "close", i, len: CLOSE_VH });
    if (SEGS[i]) items.push({ type: "ride", i, len: Math.max(30, (val(sc.felt) || val(sc.actual)) * VH_PER_MIN) });
    else items.push({ type: "arrive", i, len: 60 });
  });
  items.push({ type: "end", i: SCENES.length - 1, len: 40 });
  let start = 0;
  items.forEach((it) => { it.start = start; start += it.len; });
  const ride = $("#ride"), stage = $("#stage");
  ride.style.height = `calc(${start + 100} * 1svh)`;

  const close = $("#close");
  const howto = $("#howto"), hudTitle = $("#hud-title");
  let nodeFor = -1, ticking = false;

  function update() {
    ticking = false;
    const unit = stage.clientHeight / 100;
    const u = -ride.getBoundingClientRect().top / unit;
    let k = items.findIndex((it) => u < it.start + it.len);
    if (k < 0) k = items.length - 1;
    const it = items[k];
    const t = clamp((u - it.start) / it.len);

    // 구간별 진행
    const fs = SCENES.map(() => 0);
    items.forEach((x, n) => {
      if (x.type !== "ride") return;
      if (n < k) fs[x.i] = 1;
      else if (n === k) fs[x.i] = t;
    });
    if (it.type === "end" || it.type === "arrive") fs.forEach((_, j) => { if (SEGS[j]) fs[j] = 1; });
    const reached = it.type === "intro" ? (t > 0.7 ? 0 : -1) : it.i;
    applyProgress(map, fs, reached);

    // 자전거 위치와 바퀴 회전 (멈춘 구간에서는 바퀴가 돌지 않음)
    let spin = 0;
    SEGS.forEach((g, j) => { if (g && SCENES[j].moving) spin += g.len * fs[j] * 5; });
    let bj = it.i, bf = it.type === "ride" ? t : 0;
    if (it.type === "arrive" || it.type === "end") { bj = SCENES.length - 2; while (bj > 0 && !SEGS[bj]) bj--; bf = 1; }
    placeBike(map, bj, bf, spin);

    const sc = SCENES[it.i];
    hudTitle.textContent = sc.title;

    howto.style.opacity = it.type === "intro" ? (1 - ease((t - 0.55) / 0.35)).toFixed(3) : 0;

    // NODE 화면: 들어오면 지도는 완전히 숨김
    if (it.type === "close") {
      if (nodeFor !== it.i) { nodeFor = it.i; nodeView.setup(sc); }
      const z = t < 0.12 ? ease(t / 0.12) : t > 0.88 ? ease((1 - t) / 0.12) : 1;
      close.classList.add("on");
      close.style.opacity = z.toFixed(3);
      close.classList.toggle("live", z > 0.97);
      stage.style.setProperty("--z", z.toFixed(3));
      nodeView.setActive(true);
    } else {
      close.classList.remove("on", "live");
      close.style.opacity = 0;
      stage.style.setProperty("--z", 0);
      nodeView.setActive(false);
    }
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", () => { nodeView.relayout(); request(); });
  update();

  /* ---------- 3. 완성된 한 바퀴 ---------- */
  const full = buildMap($("#map-full"));
  applyProgress(full, SCENES.map(() => 1), SCENES.length);
  full.bike.setAttribute("visibility", "hidden");
  $("#loop-total").innerHTML = `${TOTAL} MIN${SCENES.some((s) => isEst(s.actual)) ? EST : ""}`;
  $("#legend").innerHTML = RULES.map(([k, a, b]) => `<div>${ruleSvg(k)}<span><b>${a}</b>${b}</span></div>`).join("");

  /* ---------- 4. 주제 문장 ---------- */
  $("#thesis").innerHTML = `<p class="big"><span>${esc(TEXT.thesis[0])}</span><span>${esc(TEXT.thesis[1])}</span><span>${esc(TEXT.thesis[2])}</span></p>
    <p class="coda">${esc(TEXT.coda)}</p>`;
  $("#footer").textContent = TEXT.footer;
})();
