/* =========================================================
   main.js — 화면 그리기와 스크롤 연동
   내용 수정은 data.js, 지도 수정은 map.js에서 하세요.
   ========================================================= */
(function () {
  "use strict";

  const SRC = ["space", "person", "phone"];
  const ANGLE = { forward: -90, left: -145, right: -35, back: 90, stop: -90, fading: -90 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMQ = window.matchMedia("(max-width: 820px)");
  const $ = (s) => document.querySelector(s);
  const f = (n) => Math.round(n * 10) / 10;

  /* ---------------------------------------------------------
     화살표 글리프
     --------------------------------------------------------- */
  // 한 정보원의 화살표. off: 평행 간격, centered: 가운데 정렬(행 표시용)
  function arrow(key, dir, off, centered) {
    const a = (ANGLE[dir] ?? -90) * Math.PI / 180;
    const ux = Math.cos(a), uy = Math.sin(a);
    const px = -uy, py = ux;
    const len = dir === "stop" ? 20 : 38;
    const shift = centered ? -len / 2 : 0;
    const sx = px * off + ux * shift, sy = py * off + uy * shift;
    const ex = sx + ux * len, ey = sy + uy * len;
    let head;
    if (dir === "stop") {
      head = `<line class="g-line" x1="${f(ex + px * 10)}" y1="${f(ey + py * 10)}" x2="${f(ex - px * 10)}" y2="${f(ey - py * 10)}"/>`;
    } else {
      const h = 11, w = 6.5;
      const bx = ex - ux * h, by = ey - uy * h;
      head = `<polygon class="g-head" points="${f(ex)},${f(ey)} ${f(bx + px * w)},${f(by + py * w)} ${f(bx - px * w)},${f(by - py * w)}"/>`;
    }
    const lx = dir === "stop" ? ex : ex - ux * 8, ly = dir === "stop" ? ey : ey - uy * 8;
    return `<g class="g src-${key}${dir === "fading" ? " is-fading" : ""}">` +
      `<line class="g-line" x1="${f(sx)}" y1="${f(sy)}" x2="${f(lx)}" y2="${f(ly)}"/>${head}</g>`;
  }

  // 세 정보원을 한 원 안에 겹쳐 그린 나침반
  function compass(sources, size, attrs) {
    sources = sources || {};
    const parts = [`<circle class="c-ring" r="46"/>`];
    let any = false;
    SRC.forEach((k, i) => {
      const s = sources[k];
      if (!s || !s.dir) return;
      any = true;
      parts.push(arrow(k, s.dir, (i - 1) * 7, false));
    });
    parts.push(any ? `<circle class="c-center" r="3"/>` : `<text class="c-q" y="9">?</text>`);
    return `<svg class="compass" viewBox="-50 -50 100 100" width="${size}" height="${size}" ${attrs || ""} aria-hidden="true">${parts.join("")}</svg>`;
  }

  // 정보원 하나의 화살표 (행 표시용)
  function single(key, dir) {
    return `<svg class="single" viewBox="-26 -26 52 52" width="30" height="30" aria-hidden="true">${arrow(key, dir, 0, true)}</svg>`;
  }

  function meter(v) {
    let cells = "";
    for (let i = 0; i < 10; i++) cells += `<i class="${i < v ? "on" : ""}"></i>`;
    return `<span class="meter" role="img" aria-label="불안 ${v} / 10">${cells}</span><span class="meter-val">${v}</span>`;
  }

  function timeBars(t) {
    const max = Math.max(t.actual, t.felt);
    return `<div class="time">
      <div class="time-row"><span class="time-k">실제</span><span class="bar"><i style="width:${t.actual / max * 100}%"></i></span><b>${t.actual}분</b></div>
      <div class="time-row is-felt"><span class="time-k">체감</span><span class="bar"><i style="width:${t.felt / max * 100}%"></i></span><b>약 ${t.felt}분</b></div>
    </div>`;
  }

  function rows(sources) {
    return `<ul class="rows">` + SRC.map((k) => {
      const v = sources[k] || {};
      const has = !!v.dir;
      return `<li class="row src-${k}${has ? "" : " is-none"}">
        <span class="row-name"><span class="sw"></span>${TEXT.sources[k].name}</span>
        <span class="row-glyph">${has ? single(k, v.dir) : `<span class="dash">—</span>`}</span>
        <span class="row-says">${v.says || ""}</span>
      </li>`;
    }).join("") + `</ul>`;
  }

  function relationChip(r, withLabel) {
    const R = RELATIONS[r] || { label: r, plain: r };
    return `<p class="relation rel-${r}">${withLabel ? `<b>${R.label}</b> · ` : ""}${R.plain}</p>`;
  }

  const stepLabel = (e) => e.node ? `NODE ${e.node}` : String(e.id).padStart(2, "0");

  /* ---------------------------------------------------------
     첫 화면
     --------------------------------------------------------- */
  $("#hero-kicker").textContent = TEXT.kicker;
  $("#hero-title").innerHTML = TEXT.title.replace(/\n/g, "<br>");
  $("#hero-question").textContent = TEXT.question;
  $("#hero-hint").textContent = TEXT.scrollHint;

  /* ---------------------------------------------------------
     사건 카드
     --------------------------------------------------------- */
  const legend = `
    <article class="step step-legend" data-event="-1">
      <div class="card">
        <p class="step-num">읽는 법</p>
        <h2>${TEXT.legendTitle}</h2>
        <ul class="legend-src">
          ${SRC.map((k) => `<li class="src-${k}"><span class="sw"></span><b>${TEXT.sources[k].name}</b><span>${TEXT.sources[k].desc}</span></li>`).join("")}
        </ul>
        <p class="legend-how">${TEXT.legendHow}</p>
        <div class="legend-ex">
          <figure>${compass({ space: { dir: "forward" }, person: { dir: "forward" }, phone: { dir: "forward" } }, 64)}<figcaption>같은 쪽을 가리킴</figcaption></figure>
          <figure>${compass({ space: { dir: "back" }, phone: { dir: "forward" } }, 64)}<figcaption>서로 다른 쪽</figcaption></figure>
          <figure>${compass({}, 64)}<figcaption>아무것도 말해주지 않음</figcaption></figure>
        </div>
      </div>
    </article>`;

  const cards = EVENTS.map((e, i) => `
    <article class="step${e.node ? " is-node" : ""}" data-event="${i}" id="step-${e.id}">
      <div class="card">
        <p class="step-num">${stepLabel(e)}</p>
        <h2>${e.title}</h2>
        <p class="step-text">${e.text}</p>
        <div class="info">
          <div class="info-compass">${compass(e.sources, e.node ? 112 : 76)}</div>
          ${rows(e.sources)}
        </div>
        ${relationChip(e.relation, false)}
        <dl class="metrics">
          <div class="m-action"><dt>내가 한 일</dt><dd>${e.action}</dd></div>
          <div class="m-anx"><dt>불안</dt><dd>${meter(e.anxiety)}</dd></div>
          ${e.time ? `<div class="m-time"><dt>시간</dt><dd>${timeBars(e.time)}</dd></div>` : ""}
        </dl>
        ${e.note ? `<p class="note">${e.note}</p>` : ""}
      </div>
    </article>`).join("");

  $("#steps").innerHTML = legend + cards;
  const stepEls = Array.from(document.querySelectorAll(".step"));

  /* ---------------------------------------------------------
     지도
     --------------------------------------------------------- */
  const ROUTE = MAP.route;
  const cum = [0];
  for (let i = 1; i < ROUTE.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(ROUTE[i].x - ROUTE[i - 1].x, ROUTE[i].y - ROUTE[i - 1].y);
  }
  const indexOf = (id) => ROUTE.findIndex((p) => p.id === id);
  const lenAt = (id) => { const i = indexOf(id); return i < 0 ? 0 : cum[i]; };
  const ptsStr = (pts) => pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");

  function pointsUpTo(L) {
    const pts = [ROUTE[0]];
    for (let i = 1; i < ROUTE.length; i++) {
      if (cum[i] <= L) { pts.push(ROUTE[i]); continue; }
      const seg = cum[i] - cum[i - 1];
      const t = seg ? (L - cum[i - 1]) / seg : 0;
      pts.push({
        x: ROUTE[i - 1].x + (ROUTE[i].x - ROUTE[i - 1].x) * t,
        y: ROUTE[i - 1].y + (ROUTE[i].y - ROUTE[i - 1].y) * t
      });
      break;
    }
    return pts;
  }

  const mapSvg = $("#map");
  mapSvg.setAttribute("viewBox", MAP.viewBox);

  let grid = "";
  for (let k = -400; k <= 400; k += 22) {
    grid += `<line x1="${560 + k}" y1="300" x2="${560 + k}" y2="860"/><line x1="200" y1="${580 + k}" x2="920" y2="${580 + k}"/>`;
  }

  const labels = MAP.labels.map((l) =>
    `<text class="m-label${l.water ? " is-water" : ""}${l.cls ? " is-" + l.cls : ""}" x="${l.x}" y="${l.y}" text-anchor="${l.anchor || "middle"}">${l.t}</text>`
  ).join("");

  const nodeMarkers = EVENTS.map((e, i) => {
    if (!e.node) return "";
    const p = ROUTE[indexOf(e.at)] || ROUTE[0];
    return `<g class="m-node" data-event="${i}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="NODE ${e.node}: ${e.title}">
      <circle r="13"/><text y="4">${e.node}</text></g>`;
  }).join("");

  const L = MAP.lagoon, S = MAP.shop;
  mapSvg.innerHTML = `
    <defs><clipPath id="cityClip"><path d="${MAP.city}"/></clipPath></defs>
    <rect class="m-water" x="0" y="0" width="1000" height="1000"/>
    <path class="m-city" d="${MAP.city}"/>
    <g class="m-grid" clip-path="url(#cityClip)"><g transform="rotate(-38 560 580)">${grid}</g></g>
    <path class="m-bridge" d="${MAP.bridge}"/>
    <path class="m-park" d="${MAP.park}"/>
    <ellipse class="m-lagoon" cx="${L.cx}" cy="${L.cy}" rx="${L.rx}" ry="${L.ry}"/>
    <path class="m-road" d="${MAP.road}"/>
    ${labels}
    <polyline class="m-route-full" points="${ptsStr(ROUTE)}"/>
    <polyline class="m-route-done" id="route-done" points=""/>
    <g class="m-shop" transform="translate(${S.x},${S.y})"><rect x="-6" y="-6" width="12" height="12"/>
      <text x="-12" y="26" text-anchor="end">${S.label}</text></g>
    ${nodeMarkers}
    <g id="dot"><circle class="m-dot-halo" r="14"/><circle class="m-dot" r="6.5"/></g>
    <g id="dot-info"></g>`;

  const routeDone = $("#route-done");
  const dot = $("#dot");
  const dotInfo = $("#dot-info");
  const vb = MAP.viewBox.split(/\s+/).map(Number);
  const INFO = 62;

  let curLen = 0, raf = null;

  function drawProgress() {
    const pts = pointsUpTo(curLen);
    routeDone.setAttribute("points", ptsStr(pts));
    const p = pts[pts.length - 1];
    dot.setAttribute("transform", `translate(${f(p.x)},${f(p.y)})`);
    // 현재 위치 옆 작은 나침반: 지도 밖으로 나가지 않게 위치 조정
    let ix = p.x + 16, iy = p.y - INFO - 10;
    if (ix + INFO > vb[0] + vb[2] - 4) ix = p.x - INFO - 16;
    if (iy < vb[1] + 4) iy = p.y + 14;
    dotInfo.setAttribute("transform", `translate(${f(ix)},${f(iy)})`);
  }

  function animateTo(target) {
    cancelAnimationFrame(raf);
    if (reduceMotion) { curLen = target; drawProgress(); return; }
    const from = curLen, start = performance.now();
    const dur = Math.min(1600, 350 + Math.abs(target - from) * 1.4);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      curLen = from + (target - from) * e;
      drawProgress();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     불안 곡선
     --------------------------------------------------------- */
  const strip = $("#strip");
  function renderStrip(cur) {
    const n = EVENTS.length, W = 600, Lm = 40, Rm = 14, T = 22, B = 88;
    const X = (i) => Lm + (W - Lm - Rm) * i / (n - 1);
    const Y = (a) => B - (B - T) * a / 10;
    let s = `<text class="s-title" x="${W - Rm}" y="12" text-anchor="end">불안 정도</text>
      <line class="s-grid" x1="${Lm}" x2="${W - Rm}" y1="${Y(10)}" y2="${Y(10)}"/>
      <line class="s-grid" x1="${Lm}" x2="${W - Rm}" y1="${Y(5)}" y2="${Y(5)}"/>
      <line class="s-base" x1="${Lm}" x2="${W - Rm}" y1="${B}" y2="${B}"/>
      <text class="s-axis" x="${Lm - 8}" y="${Y(10) + 4}" text-anchor="end">높음</text>
      <text class="s-axis" x="${Lm - 8}" y="${B + 4}" text-anchor="end">낮음</text>`;
    EVENTS.forEach((e, i) => {
      s += `<text class="s-x${e.node ? " is-node" : ""}${i === cur ? " is-cur" : ""}" x="${X(i)}" y="${B + 20}" text-anchor="middle">${e.node ? "N" + e.node : e.id}</text>`;
    });
    if (cur >= 0) {
      const pts = EVENTS.slice(0, cur + 1).map((e, i) => ({ x: X(i), y: Y(e.anxiety) }));
      s += `<polygon class="s-area" points="${X(0)},${B} ${ptsStr(pts)} ${X(cur)},${B}"/>`;
      s += `<polyline class="s-line" points="${ptsStr(pts)}"/>`;
      pts.forEach((p, i) => {
        const e = EVENTS[i];
        s += `<circle class="s-dot${e.node ? " is-node" : ""}" cx="${p.x}" cy="${p.y}" r="${e.node ? 4.5 : 3}"/>`;
      });
      const c = pts[cur];
      s += `<circle class="s-cur" cx="${c.x}" cy="${c.y}" r="9"/>`;
      if (EVENTS[cur].time) {
        s += `<text class="s-ann" x="${c.x}" y="${c.y - 13}" text-anchor="middle">체감 ${EVENTS[cur].time.felt}분</text>`;
      }
    }
    strip.innerHTML = s;
  }

  /* ---------------------------------------------------------
     현재 사건 바꾸기
     --------------------------------------------------------- */
  const markerEls = Array.from(mapSvg.querySelectorAll(".m-node"));
  let active = null;

  function setActive(idx) {
    if (idx === active) return;
    active = idx;
    stepEls.forEach((el) => el.classList.toggle("is-active", +el.dataset.event === idx));
    const ev = EVENTS[idx];
    animateTo(ev ? lenAt(ev.at) : 0);
    dotInfo.innerHTML = ev ? compass(ev.sources, INFO, `x="0" y="0"`) : "";
    markerEls.forEach((m) => {
      const i = +m.dataset.event;
      m.classList.toggle("is-reached", idx >= i);
      m.classList.toggle("is-current", idx === i);
    });
    renderStrip(idx);
  }

  function pick() {
    const line = window.innerHeight * (mobileMQ.matches ? 0.74 : 0.5);
    let idx = null;
    for (const el of stepEls) {
      if (el.getBoundingClientRect().top <= line) idx = +el.dataset.event;
    }
    setActive(idx === null ? -1 : idx);
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { pick(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", pick);

  // 지도 위 NODE를 누르면 해당 카드로 이동
  function goTo(i) {
    const el = stepEls.find((s) => +s.dataset.event === i);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * (mobileMQ.matches ? 0.62 : 0.3);
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  }
  markerEls.forEach((m) => {
    m.addEventListener("click", () => goTo(+m.dataset.event));
    m.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(+m.dataset.event); }
    });
  });

  /* ---------------------------------------------------------
     NODE 비교
     --------------------------------------------------------- */
  const nodes = EVENTS.filter((e) => e.node);
  const peak = Math.max(...nodes.map((e) => e.anxiety));
  $("#compare").innerHTML = `
    <div class="wrap">
      <h2 class="sec-title">${TEXT.compareTitle}</h2>
      <p class="lede">${TEXT.compareLede}</p>
      <div class="cmp-grid">
        ${nodes.map((e) => `
          <article class="cmp${e.anxiety === peak ? " is-peak" : ""}">
            <p class="step-num">NODE ${e.node}</p>
            <h3>${e.title}</h3>
            <div class="cmp-compass">${compass(e.sources, 120)}</div>
            ${relationChip(e.relation, true)}
            <div class="cmp-row"><span class="cmp-k">불안</span>${meter(e.anxiety)}</div>
            ${e.time ? `<div class="cmp-row cmp-time">${timeBars(e.time)}</div>` : ""}
            <div class="cmp-next${e.nextClear ? "" : " is-unclear"}">
              <span class="cmp-k">그다음 할 일</span>
              <b>${e.next || ""}</b>
              <span class="cmp-clear">${e.nextClear ? "분명했다" : "정할 수 없었다"}</span>
            </div>
            <p class="cmp-sum">${e.summary || ""}</p>
          </article>`).join("")}
      </div>
    </div>`;

  /* ---------------------------------------------------------
     인사이트
     --------------------------------------------------------- */
  $("#insight").innerHTML = `
    <div class="wrap reveal">
      <p class="insight-q">${TEXT.question}</p>
      <blockquote>${TEXT.insight}</blockquote>
      <ol class="insight-notes">${TEXT.insightNotes.map((t) => `<li>${t}</li>`).join("")}</ol>
    </div>`;
  $("#footer").textContent = TEXT.footer;

  const revealEls = document.querySelectorAll(".reveal, .cmp");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-shown"); io.unobserve(en.target); }
      });
    }, { threshold: 0.25 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-shown"));
  }

  drawProgress();
  pick();
})();
