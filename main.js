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
    if (isEst(sc.actual) || (f !== a && isEst(sc.felt))) t += " (추정)";
    return t;
  }

  let maskId = 0;
  function buildMap(svg) {
    svg.setAttribute("viewBox", VIEW);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const uid = "m" + (maskId++);
    const defs = el("defs", {}, svg);
    const clip = el("clipPath", { id: uid + "city" }, defs);
    el("path", { d: "M" + CITY.map(pt).join(" L") + " Z" }, clip);

    // 땅
    el("path", { d: smoothClosedPath(PARK), fill: "var(--park)" }, svg);
    const city = el("g", { "clip-path": `url(#${uid}city)` }, svg);
    for (let k = -12; k < 20; k++) {
      el("line", { x1: 300 + k * 34, y1: 470, x2: 300 + k * 34 - 260, y2: 900, stroke: "var(--street)", "stroke-width": 1.3 }, city);
      el("line", { x1: 300 + k * 34 - 300, y1: 470, x2: 300 + k * 34 + 120, y2: 900, stroke: "var(--street)", "stroke-width": 1.3 }, city);
    }
    // 지명
    const boxes = []; // 글자끼리 겹치지 않게 차지한 자리
    const place = (x, y, t, size = 13, anchor = "middle", fill = "var(--ink-3)") => {
      el("text", { x, y, "text-anchor": anchor, "font-family": "Archivo Black, sans-serif", "font-size": size, fill, "letter-spacing": "0.04em" }, svg).textContent = t;
      const w = t.length * size * 0.72, x0 = anchor === "end" ? x - w : anchor === "start" ? x : x - w / 2;
      if (size < 20) boxes.push([x0 - 4, y - size, x0 + w + 4, y + 4]);
    };
    place(500, 440, "STANLEY PARK", 30, "middle", "#bdbdb9");
    place(205, 690, "ENGLISH BAY");
    place(845, 452, "COAL HARBOUR", 13, "end");
    place(500, 165, "BURRARD INLET");
    place(790, 860, "DOWNTOWN");

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

  // 큰 바퀴
  const wheelRot = $("#wheel-rot");
  (function buildWheel() {
    let s = "";
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      s += `<line x1="${f1(Math.cos(a) * 30)}" y1="${f1(Math.sin(a) * 30)}" x2="${f1(Math.cos(a) * 85)}" y2="${f1(Math.sin(a) * 85)}" stroke="var(--ink-3)" stroke-width="0.5"/>`;
    }
    [45, 135, 225, 315].forEach((deg) => {
      const a = (deg * Math.PI) / 180, x = Math.cos(a) * 85, y = Math.sin(a) * 85;
      s += `<rect x="${f1(x - 3)}" y="${f1(y - 3)}" width="6" height="6" fill="var(--bg)" stroke="var(--blue)" stroke-width="1.2"/>`;
    });
    s += `<circle cx="0" cy="-78" r="3.2" fill="var(--pink)"/>`;
    wheelRot.innerHTML = s;
    const svg = wheelRot.ownerSVGElement;
    el("circle", { r: 75, fill: "var(--bg)" }, svg);
    el("circle", { r: 85, fill: "none", stroke: "var(--ink)", "stroke-width": 1 }, svg);
    el("circle", { r: 93, fill: "none", stroke: "var(--ink)", "stroke-width": 9 }, svg);
  })();

  function cardHtml(sc) {
    const src = sc.guide.source;
    const dot = (c) => `<i style="${c ? `background:${c}` : "border:1px solid var(--ink)"}"></i>`;
    const photo = sc.photo
      ? `<div class="card-photo missing" id="card-photo"><span>PHOTO · ${esc(sc.photo)}</span></div>`
      : `<div class="card-photo missing"><span class="ph">${esc(sc.photoNote || "사진 없음")}</span></div>`;
    return `
      <span class="card-node">${esc(sc.label)}</span>
      ${photo}
      <p class="card-row"><b>${dot(src ? COLOR[src] : "")}GUIDE</b><span>${esc(sc.guide.text)}${isEst(sc.guide) ? EST : ""}</span></p>
      <p class="card-row"><b>${dot("var(--blue)")}SPACE</b><span>${esc(sc.space.text)}</span></p>
      <p class="card-rel">${esc(val(sc.relation))}${isEst(sc.relation) ? EST : ""}</p>
      ${sc.memory ? `<p class="card-mem">기억: ${esc(sc.memory)}</p>` : ""}`;
  }

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

  const close = $("#close"), closeWheel = $("#close-wheel"), card = $("#card"), closeAct = $("#close-act");
  const howto = $("#howto"), clock = $("#clock"), clockEst = $("#clock-est"), hudLabel = $("#hud-label"), hudTitle = $("#hud-title");
  let cardFor = -1, ticking = false;

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

    // 귀퉁이 정보
    let mins = 0, est = false;
    SCENES.forEach((sc, j) => { if (fs[j] > 0) { mins += (val(sc.actual) || 0) * fs[j]; est = est || isEst(sc.actual); } });
    clock.textContent = Math.round(mins);
    clockEst.textContent = est ? "추정" : "";
    const sc = SCENES[it.i];
    hudLabel.textContent = sc.label;
    hudTitle.textContent = sc.title;

    howto.style.opacity = it.type === "intro" ? (1 - ease((t - 0.55) / 0.35)).toFixed(3) : 0;

    // 바퀴 클로즈업
    if (it.type === "close") {
      if (cardFor !== it.i) {
        cardFor = it.i;
        card.innerHTML = cardHtml(sc);
        const ph = $("#card-photo");
        if (ph) {
          // 사진이 있으면 보이고, 없으면 회색 자리표시로 남는다
          const img = new Image();
          img.alt = "";
          img.onload = () => ph.classList.remove("missing");
          img.src = "photos/" + sc.photo;
          ph.appendChild(img);
        }
        closeAct.innerHTML = `<i class="dot" style="background:var(--ink)"></i><i class="lead"></i>${esc(sc.actionEn || "")}<span class="ko">${esc(sc.action)}</span>`;
      }
      const z = t < 0.15 ? ease(t / 0.15) : t > 0.85 ? ease((1 - t) / 0.15) : 1;
      const b = map.bike.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (s.left + s.width / 2), dy = b.top + b.height / 2 - (s.top + s.height / 2);
      closeWheel.style.transform = `translate(${f1(dx * (1 - z))}px, ${f1(dy * (1 - z))}px) scale(${lerp(0.04, 1, z).toFixed(3)})`;
      close.classList.add("on");
      close.style.opacity = clamp(z * 2.5).toFixed(3);
      closeAct.style.opacity = clamp((z - 0.8) * 5).toFixed(3);
      wheelRot.setAttribute("transform", sc.moving ? `rotate(${f1(t * 1080)})` : "");
      stage.classList.toggle("dim", z > 0.05);
    } else {
      close.classList.remove("on");
      close.style.opacity = 0;
      stage.classList.remove("dim");
    }
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
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
