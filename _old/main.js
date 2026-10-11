/* =========================================================
   main.js — 화면 그리기와 스크롤 연동
   내용은 data.js에서 고치세요. 이 파일은 보통 손대지 않아도 됩니다.
   ========================================================= */
(function () {
  "use strict";

  const TBD = "확인 필요";
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isTBD = (v) => v === undefined || v === null || v === "" || v === TBD;
  // "약 7분" → 7, 12 → 12, "확인 필요" → null
  const num = (v) => {
    if (typeof v === "number") return v;
    if (typeof v !== "string") return null;
    const m = v.match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const pad = (n) => String(n).padStart(2, "0");
  const COLOR = { person: "var(--person)", phone: "var(--phone)", space: "var(--space)", ink: "var(--ink)" };

  // 기록 값 표시: 확인 필요는 점선 상자, 숫자는 단위를 붙임
  function rec(v, unit = "") {
    if (isTBD(v)) return `<span class="tbd">${TBD}</span>`;
    if (typeof v === "number") return `<span class="rec-v">${v}${unit}</span>`;
    return `<span class="rec-v">${esc(v)}</span>`;
  }

  function photoEl(file) {
    const div = document.createElement("div");
    div.className = "photo";
    const img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => div.classList.add("missing");
    img.src = "photos/" + file;
    const name = document.createElement("span");
    name.className = "ph-name";
    name.textContent = "photos/" + file;
    div.append(img, name);
    return div;
  }

  // 관계를 나타내는 작은 기호 (가로: 왼쪽 = 안내, 오른쪽 = 공간)
  function glyph(state) {
    const g = {
      match: `<line x1="4" y1="7" x2="18" y2="7" stroke="${COLOR.ink}" stroke-width="1.6"/><circle cx="4" cy="7" r="2.6" fill="${COLOR.ink}"/>`,
      none: `<circle cx="4" cy="7" r="2.4" fill="none" stroke="#aaa" stroke-dasharray="1.5 1.5"/>`,
      spaceOnly: ``,
      mismatch: `<path d="M4 7 L9 2" stroke="${COLOR.phone}" stroke-width="1.6"/><path d="M18 7 L13 12" stroke="${COLOR.space}" stroke-width="1.6"/><circle cx="4" cy="7" r="2.6" fill="${COLOR.ink}"/>`,
      risk: `<line x1="4" y1="7" x2="18" y2="7" stroke="${COLOR.phone}" stroke-width="1.6" stroke-dasharray="2 2.5"/><circle cx="4" cy="7" r="2.6" fill="${COLOR.ink}" opacity=".4"/>`
    }[state] || "";
    return `<svg viewBox="0 0 22 14" aria-hidden="true">${g}<circle cx="18" cy="7" r="2.6" fill="${COLOR.space}"/></svg>`;
  }

  function stateTag(state) {
    const s = STATES[state];
    return `<span class="state-v">${glyph(state)}${esc(s.label)}</span>`;
  }

  function actions(list) {
    return `<span class="act-v">${list.map(esc).join('<span class="arrow">→</span>')}</span>`;
  }

  /* ---------- 0. 첫 화면 ---------- */
  $("#hero-place").textContent = TEXT.place;
  $("#hero-title").textContent = TEXT.title;
  $("#hero-question").textContent = TEXT.question;
  $("#hero-hint").textContent = TEXT.scrollHint;

  /* ---------- 1. 읽는 법 ---------- */
  const layerSample = {
    rec: `<span class="rec-v">14:20 · 7분 · 12장 · 7%</span> <span class="tbd">${TBD}</span>`,
    act: actions(["멈춤", "물음"]),
    state: `<span class="state-v">${glyph("match")}관계</span>`,
    mem: `<span class="mem-v"><span class="mem-tag">기억 · 주관</span>그때 느낀 것</span>`
  };
  $("#how").innerHTML = `
    <h2>${esc(TEXT.howTitle)}</h2>
    <div class="how-grid">
      <div class="how-diagram" aria-hidden="true">
        <div class="box g">안내</div>
        <svg viewBox="0 0 200 44"><line x1="100" y1="4" x2="100" y2="40" stroke="${COLOR.ink}" stroke-width="2"/></svg>
        <div class="box s">공간 (사진)</div>
      </div>
      <div class="how-text">
        <p>${esc(TEXT.howGuide)}</p>
        <p>${esc(TEXT.howLine)}</p>
        <p>${esc(TEXT.howSpace)}</p>
        <div class="how-colors">
          <span><i class="k" style="background:var(--space)"></i>공간</span>
          <span><i class="k" style="background:var(--person)"></i>사람</span>
          <span><i class="k" style="background:var(--phone)"></i>휴대폰</span>
        </div>
        <div class="how-layers">
          ${TEXT.howLayers.map((l) => `<div><span class="layer-name">${esc(l.name)}</span><span class="sample">${layerSample[l.cls]}</span>${esc(l.desc)}</div>`).join("")}
        </div>
        <p class="how-click">${esc(TEXT.howClick)}</p>
      </div>
    </div>`;

  /* ---------- 2. 장면 카드 ---------- */
  const scenesEl = $("#scenes");
  SCENES.forEach((s, i) => {
    const r = s.record;
    const sec = document.createElement("section");
    sec.className = "scene";
    sec.style.height = `calc(${s.length} * 100svh)`;
    const recItems = [
      ["시각", rec(r.clock)],
      ["걸린 시간", rec(r.minutes, "분")],
      ["사진", rec(r.photos, "장") + (r.photosNote ? ` <span class="rec-v" style="color:var(--ink-2)">(${esc(r.photosNote)})</span>` : "")],
      ["배터리", rec(r.battery, "%")]
    ];
    const mem = s.memory || {};
    const memHtml = (mem.text || mem.felt)
      ? `<p class="card-mem reveal r5"><span class="mem-v"><span class="mem-tag">기억 · 주관</span>${esc(mem.text || "")}${mem.felt ? ` 체감 약 ${esc(mem.felt)}분.` : ""}</span></p>`
      : "";
    sec.innerHTML = `
      <article class="card" tabindex="0" role="button" aria-label="${pad(s.id)}. ${esc(s.title)} — 기록 자세히 보기">
        <div class="card-head">
          <span class="card-no">${pad(s.id)} / ${pad(SCENES.length)}</span>
          ${s.node ? `<span class="card-node">NODE ${esc(s.node)}</span>` : ""}
        </div>
        <dl class="card-recs reveal r1">${recItems.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <h3 class="reveal r2">${esc(s.title)}</h3>
        <p class="card-text reveal r2">${esc(s.text)}</p>
        <p class="card-act reveal r3"><span class="layer-name">행동</span>${actions(s.actions)}</p>
        <p class="card-state reveal r4">${stateTag(s.state)}<span class="plain">${esc(STATES[s.state].plain)}</span></p>
        ${memHtml}
        <span class="card-more reveal r5">기록 자세히 보기 →</span>
      </article>`;
    const card = sec.querySelector(".card");
    card.addEventListener("click", () => openDetail(i));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(i); } });
    scenesEl.appendChild(sec);
  });
  const sceneEls = [...scenesEl.children];
  const cardEls = sceneEls.map((el) => el.querySelector(".card"));
  // 카드가 화면에 들어오면 기록 → 행동 → 관계 → 기억 순서로 나타난다
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
    }), { threshold: 0.2 });
    cardEls.forEach((c) => io.observe(c));
  } else {
    cardEls.forEach((c) => c.classList.add("on"));
  }

  /* ---------- 바퀴 ---------- */
  const wheel = $("#wheel");
  wheel.innerHTML = `<g id="wheel-jit"><g id="wheel-rot">
      <circle class="tire" r="44"/><circle class="rim" r="38"/>
      ${Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2;
        return `<line class="spoke" x1="0" y1="0" x2="${(Math.cos(a) * 38).toFixed(2)}" y2="${(Math.sin(a) * 38).toFixed(2)}"/>`;
      }).join("")}
      <circle class="hub" r="4.5"/>
      <circle class="mark" cx="0" cy="-41" r="3.2"/>
    </g></g>`;
  const wheelRot = $("#wheel-rot");
  const wheelJit = $("#wheel-jit");

  // 바퀴 회전량: 장면마다 [굴러감 비율]을 적분해 둔다 (스크롤 속도는 건드리지 않음)
  const N = 60;
  function rateAt(w, p) {
    if (typeof w === "number") return w;
    return lerp(w[0], w[1], smooth((p - 0.35) / 0.3));
  }
  const cum = SCENES.map((s) => {
    const arr = [0];
    for (let k = 1; k <= N; k++) {
      const p = (k - 0.5) / N;
      arr.push(arr[k - 1] + rateAt(s.wheel, p) / N);
    }
    return arr;
  });
  const distAt = (i, p) => {
    const f = clamp(p) * N, k = Math.floor(f), a = cum[i];
    return k >= N ? a[N] : lerp(a[k], a[k + 1], f - k);
  };
  const before = [];
  SCENES.reduce((acc, s, i) => { before[i] = acc; return acc + cum[i][N] * s.length; }, 0);
  const TURNS_PER_SCREEN = 1.25;

  /* ---------- 안내 칸 ---------- */
  const paneGuide = $("#pane-guide");
  const filmstrip = $("#filmstrip");
  const spaceSays = $("#space-says");
  const link = $("#link");

  function phoneSvg(inner, w = 56, h = 100) {
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="8" fill="#fff" stroke="${COLOR.phone}" stroke-width="2"/>
      ${inner}</svg>`;
  }
  const mapInner = `
      <g stroke="#e3e3e0" stroke-width="2"><line x1="8" y1="30" x2="48" y2="30"/><line x1="8" y1="62" x2="48" y2="62"/><line x1="18" y1="10" x2="18" y2="90"/><line x1="40" y1="10" x2="40" y2="90"/></g>
      <path d="M28 84 L28 52 L40 40 L40 18" stroke="${COLOR.phone}" stroke-width="3.5" fill="none" stroke-linejoin="round"/>
      <path d="M35 22 L40 13 L45 22 Z" fill="${COLOR.phone}"/>
      <circle cx="28" cy="84" r="4" fill="#fff" stroke="${COLOR.phone}" stroke-width="2.5"/>`;

  function renderGuide(s) {
    const g = s.guide || {};
    paneGuide.className = "pane pane-guide" + (g.who ? " " + g.who : " empty");
    const label = `<span class="pane-label">안내</span>`;
    if (!g.who) {
      paneGuide.innerHTML = `${label}<span class="empty-label">${s.state === "spaceOnly" ? "안내 없음 · 묻지 않았다" : "안내 없음"}</span>`;
      return;
    }
    const from = `<span class="guide-from">${esc(g.from)}</span>`;
    let body = "";
    if (g.kind === "speech") {
      body = `<div class="speech">${from}<q>${esc(g.says)}</q></div>`;
    } else if (g.kind === "map") {
      body = `<div class="phone-ui">${phoneSvg(mapInner)}<div>${from}<span class="says">“${esc(g.says)}”</span></div></div>`;
    } else if (g.kind === "battery") {
      body = `<div class="phone-ui" id="g-phone">${phoneSvg(`
          <rect x="16" y="36" width="24" height="40" rx="3" fill="none" stroke="${COLOR.ink}" stroke-width="2"/>
          <rect x="23" y="31" width="10" height="5" rx="1" fill="${COLOR.ink}"/>
          <rect id="g-batt-fill" x="19" y="73" width="18" height="0" fill="${COLOR.phone}"/>`)}
        <div>${from}<span class="says">${esc(g.says)}</span></div></div>`;
    } else if (g.kind === "motion") {
      body = `<div class="motion-ui"><div style="flex:none;max-width:40%">${from}</div>
        <svg viewBox="0 0 240 90" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path d="M10 70 C 80 70, 120 70, 150 50 S 210 22, 232 20" stroke="#cfcfcb" stroke-width="2" stroke-dasharray="4 5" fill="none"/>
          <g id="g-rider"><circle r="9" fill="${COLOR.person}"/><circle r="9" fill="none" stroke="${COLOR.ink}" stroke-width="1"/></g>
        </svg></div>`;
    } else if (g.kind === "handoff") {
      body = `<div class="handoff-ui">${g.before ? `<div class="speech person"><span class="from">${esc(g.before.from)}</span><q>${esc(g.before.says)}</q></div>` : ""}
        <span class="to">→</span>${phoneSvg(mapInner)}<div>${from}<span class="says" style="font-family:var(--serif)">${esc(g.says)}</span></div></div>`;
    }
    paneGuide.innerHTML = label + body;
  }

  function renderSpace(s) {
    filmstrip.style.transform = "";
    filmstrip.innerHTML = "";
    filmstrip.classList.toggle("blank", !s.files.length);
    if (s.files.length) {
      s.files.forEach((f) => filmstrip.appendChild(photoEl(f)));
    } else {
      const note = s.record.photosNote;
      filmstrip.innerHTML = `<span>사진 칸 비어 있음${note ? ` · 이 구간 사진 <span class="rec-v">${esc(note)}</span>` : ""}</span>`;
    }
    spaceSays.textContent = "눈앞의 길 · " + s.space.says;
    if (!$("#pane-space .pane-label")) {
      const l = document.createElement("span");
      l.className = "pane-label";
      l.textContent = "공간 · 그날 찍은 사진";
      $("#pane-space").prepend(l);
    }
  }

  /* ---------- 연결선 ---------- */
  function drawLink(s, p, batt) {
    const gc = s.guide && s.guide.who ? COLOR[s.guide.who] : COLOR.ink;
    const appear = smooth((p - 0.06) / 0.16); // 기록(사진)이 먼저, 선은 조금 뒤에
    let svg = "";
    const spaceDot = `<circle cx="100" cy="74" r="5" fill="#fff" stroke="${COLOR.space}" stroke-width="2.5"/>`;
    const guideDot = (o = 1) => `<circle cx="100" cy="6" r="5" fill="${gc}" stroke="${COLOR.ink}" stroke-width="1" opacity="${o}"/>`;

    if (s.state === "match") {
      const f = s.recovered ? smooth((p - 0.1) / 0.3) : appear;
      svg = `<line x1="100" y1="6" x2="100" y2="74" stroke="${COLOR.ink}" stroke-width="2.2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - f).toFixed(3)}"/>` + guideDot() + spaceDot;
    } else if (s.state === "none") {
      svg = spaceDot;
    } else if (s.state === "spaceOnly") {
      svg = `<path d="M94 52 L100 44 L106 52" stroke="${COLOR.space}" stroke-width="2" opacity="${appear}"/>` + spaceDot;
    } else if (s.state === "mismatch") {
      const d = lerp(10, 44, smooth(p / 0.25));
      const o = appear;
      svg = `<g opacity="${o}">
          <path d="M100 6 L${100 + d} 38" stroke="${COLOR.phone}" stroke-width="2.4"/>
          <path d="M100 74 L${100 - d} 42" stroke="${COLOR.space}" stroke-width="2.4"/>
          <text x="${100 + d + 6}" y="40" font-size="9" fill="var(--phone-ink)" font-family="var(--sans)">지도</text>
          <text x="${100 - d - 6}" y="44" font-size="9" fill="${COLOR.space}" font-family="var(--sans)" text-anchor="end">길</text>
        </g>` + guideDot() + spaceDot;
    } else if (s.state === "risk") {
      const from = num(s.batteryFrom) || 15, to = num(s.record.battery) || 7;
      const t = clamp((batt - to) / Math.max(1, from - to)); // 1 = 아직 남음, 0 = 바닥
      const dash = lerp(2, 14, t), gap = lerp(9, 1, t);
      svg = `<line class="${t < 0.6 ? "risk-flicker" : ""}" x1="100" y1="6" x2="100" y2="74" stroke="${COLOR.phone}" stroke-width="2.2"
          stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" opacity="${(0.3 + 0.7 * t).toFixed(2)}"/>` + guideDot(0.4 + 0.6 * t) + spaceDot;
    }
    link.innerHTML = `<g id="link-jit">${svg}</g>`;
  }

  /* ---------- 계기판 ---------- */
  const mScene = $("#m-scene"), mTime = $("#m-time"), mBatt = $("#m-batt"), gaugeNote = $("#gauge-note");

  function batteryAt(s, p) {
    const r = s.record;
    if (s.state === "risk" && s.batteryFrom != null) {
      return lerp(num(s.batteryFrom), num(r.battery), smooth((p - 0.1) / 0.7));
    }
    if (r.batteryAfter != null && num(r.batteryAfter) != null && num(r.battery) != null) {
      // 충전은 장면 마지막에야 일어난다 — 선이 먼저 이어지고, 숫자는 나중에 오른다
      return lerp(num(r.battery), num(r.batteryAfter), smooth((p - 0.72) / 0.22));
    }
    return num(r.battery);
  }

  function updateGauge(s, p, batt) {
    mScene.textContent = `${pad(s.id)} / ${pad(SCENES.length)}`;
    const m = num(s.record.minutes);
    const felt = num(s.memory && s.memory.felt);
    let note = "";
    if (m != null) {
      const reach = felt ? m / felt : 0.9; // 실제 시간만큼만 시계가 간다
      const sec = Math.round(Math.min(1, p / reach) * m * 60);
      mTime.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
      if (felt && p > reach) {
        note = `<span class="rec-v">기록은 ${m}분</span><span class="mem-v"><span class="mem-tag">기억 · 주관</span>체감 약 ${felt}분</span>`;
      }
    } else {
      mTime.innerHTML = `<span class="tbd">${TBD}</span>`;
    }
    if (batt == null) {
      mBatt.innerHTML = `<span class="tbd">${TBD}</span>`;
      mBatt.classList.remove("low");
    } else {
      mBatt.textContent = `${Math.round(batt)}%`;
      mBatt.classList.toggle("low", batt <= 10);
    }
    if (gaugeNote.innerHTML !== note) gaugeNote.innerHTML = note;
  }

  /* ---------- 스크롤 연동 ---------- */
  const stage = $("#stage");
  let current = -1;
  let ticking = false;

  function probeY() {
    const vh = window.innerHeight;
    if (window.matchMedia("(max-width: 899px)").matches) {
      const sh = stage.getBoundingClientRect().height;
      return sh + (vh - sh) * 0.3;
    }
    return vh * 0.5;
  }

  function update() {
    ticking = false;
    const y = probeY();
    let i = 0, p = 0;
    for (let k = 0; k < sceneEls.length; k++) {
      const r = sceneEls[k].getBoundingClientRect();
      if (r.top <= y) { i = k; p = clamp((y - r.top) / r.height); }
    }
    const s = SCENES[i];

    if (i !== current) {
      current = i;
      renderGuide(s);
      renderSpace(s);
    }

    // 바퀴
    const d = distAt(i, p);
    const rot = (before[i] + d * s.length) * 360 * TURNS_PER_SCREEN;
    wheelRot.setAttribute("transform", `rotate(${rot.toFixed(2)})`);

    // 덜컹거림: 스크롤한 만큼에서 계산 (시간에 따라 저절로 움직이지 않음)
    let jx = 0, jy = 0;
    if (s.bumpy) {
      jx = Math.sin(rot * 0.19) * 1.8 + Math.sin(rot * 0.53) * 1.2;
      jy = -Math.abs(Math.sin(rot * 0.31)) * 3;
    }
    wheelJit.setAttribute("transform", `translate(${jx.toFixed(2)} ${jy.toFixed(2)})`);

    // 사진: 바퀴가 굴러간 만큼만 지나간다
    const total = cum[i][N];
    const travel = Math.max(0, filmstrip.scrollWidth - filmstrip.clientWidth);
    if (total > 0 && travel > 0) filmstrip.style.transform = `translateX(${(-(d / total) * travel).toFixed(1)}px)`;

    const batt = batteryAt(s, p);
    drawLink(s, p, batt);
    if (s.bumpy) $("#link-jit").setAttribute("transform", `translate(${(jx * 1.5).toFixed(2)} ${(jy * 0.8).toFixed(2)})`);

    // 안내 칸 안의 움직임
    const fill = $("#g-batt-fill");
    if (fill && batt != null) {
      const h = (clamp(batt / 100) * 36);
      fill.setAttribute("y", (74 - h).toFixed(1));
      fill.setAttribute("height", h.toFixed(1));
      const from = num(s.batteryFrom) || 15, to = num(s.record.battery) || 7;
      $("#g-phone").style.opacity = (0.35 + 0.65 * clamp((batt - to) / Math.max(1, from - to))).toFixed(2);
    }
    const rider = $("#g-rider");
    if (rider) {
      const path = rider.parentNode.querySelector("path");
      const L = path.getTotalLength();
      const pt = path.getPointAtLength(L * lerp(0.08, 0.95, p));
      rider.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    }

    updateGauge(s, p, batt);
  }

  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  update();

  /* ---------- 상세 패널 ---------- */
  const dialog = $("#detail");
  function openDetail(i) {
    const s = SCENES[i], r = s.record, g = s.guide || {}, mem = s.memory || {};
    const rows = [
      ["실제 시각", rec(r.clock)],
      ["이 장면에 걸린 실제 시간", rec(r.minutes, "분")],
      ["사진 장수", rec(r.photos, "장") + (r.photosNote ? ` <span class="rec-v">(${esc(r.photosNote)})</span>` : "")],
      ["휴대폰 배터리", rec(r.battery, "%")]
    ];
    if ("batteryAfter" in r) rows.push(["충전 후 배터리", rec(r.batteryAfter, "%")]);
    if ("phoneLooked" in r) rows.push(["휴대폰 지도를 봤는지", rec(r.phoneLooked)]);
    const table = (list) => `<table>${list.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;

    dialog.innerHTML = `<div class="detail-inner">
      <button class="detail-close" type="button" aria-label="닫기">×</button>
      <div class="card-head"><span class="card-no">${pad(s.id)} / ${pad(SCENES.length)}</span>${s.node ? `<span class="card-node">NODE ${esc(s.node)}</span>` : ""}</div>
      <h3>${esc(s.title)}</h3>
      <div class="detail-photos" id="detail-photos"></div>
      <section><span class="layer-name">기록</span>${table(rows)}</section>
      <section><span class="layer-name">그때</span>${table([
        ["안내", g.who ? `<span class="who ${g.who}">${esc(g.from)}</span>${g.says ? ` “${esc(g.says)}”` : ""}` : `<span class="tbd" style="border-style:solid">안내 없음</span>`],
        ["공간", `<span class="who space">눈앞의 길</span> ${esc(s.space.says)}`]
      ])}<p class="card-text" style="margin-top:10px">${esc(s.text)}</p></section>
      <section><span class="layer-name">행동</span>${actions(s.actions)}</section>
      <section><span class="layer-name">관계</span>${stateTag(s.state)} <span class="plain" style="font-size:.85rem;color:var(--ink-2)">${esc(STATES[s.state].plain)}</span></section>
      ${(mem.text || mem.felt) ? `<section><span class="mem-v"><span class="mem-tag">기억 · 주관</span>${esc(mem.text || "")}${mem.felt ? ` 체감 약 ${esc(mem.felt)}분.` : ""}</span></section>` : ""}
    </div>`;
    const ph = dialog.querySelector("#detail-photos");
    if (s.files.length) {
      s.files.forEach((f) => {
        const el = photoEl(f);
        el.querySelector("img").addEventListener("click", () => window.open("photos/" + f, "_blank"));
        ph.appendChild(el);
      });
    } else {
      ph.outerHTML = `<div class="detail-nophoto">photos 폴더에 등록된 사진 없음${r.photosNote ? ` · 기록: 사진 ${esc(r.photosNote)}` : ""}</div>`;
    }
    dialog.querySelector(".detail-close").addEventListener("click", () => dialog.close());
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  // 바깥(어두운 부분)을 누르면 닫기
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------- 3. 펼친 경로 ---------- */
  function miniLink(s) {
    const m = {
      match: `<line x1="20" y1="2" x2="20" y2="38" stroke="${COLOR.ink}" stroke-width="2"/>`,
      none: ``,
      spaceOnly: `<path d="M16 30 L20 25 L24 30" stroke="${COLOR.space}" stroke-width="1.6" fill="none"/>`,
      mismatch: `<path d="M20 2 L32 17" stroke="${COLOR.phone}" stroke-width="2"/><path d="M20 38 L8 23" stroke="${COLOR.space}" stroke-width="2"/>`,
      risk: `<line x1="20" y1="2" x2="20" y2="38" stroke="${COLOR.phone}" stroke-width="2" stroke-dasharray="3 4" opacity=".6"/>`
    }[s.state];
    return `<svg viewBox="0 0 40 40" aria-hidden="true">${m}</svg>`;
  }

  const photoNums = SCENES.map((s) => num(s.record.photos)).filter((n) => n != null);
  const photoMax = Math.max(1, ...photoNums);
  const timeMax = Math.max(1, ...SCENES.flatMap((s) => [num(s.record.minutes), num(s.memory && s.memory.felt)]).filter((n) => n != null));

  const legs = SCENES.map((s, i) => {
    const g = s.guide || {};
    const guideCls = !g.who ? "empty" : (g.kind === "handoff" ? "handoff" : g.who);
    const guideTxt = !g.who ? "" : esc(g.from.replace(/\s*\(.*\)$/, ""));
    const n = num(s.record.photos);
    const photos = n != null
      ? `<span class="bar" style="height:${(n / photoMax) * 44}px; --w:${(n / photoMax) * 100}px"></span><span class="n">${n}장</span>`
      : `<span class="tbd">${TBD}</span>${s.record.photosNote ? `<span class="note">${esc(s.record.photosNote)}</span>` : ""}`;
    const m = num(s.record.minutes), felt = num(s.memory && s.memory.felt);
    const tm = m != null
      ? `<span class="tbar actual"><i style="width:${(m / timeMax) * 100}%"></i><span>${m}분</span></span>
         ${felt ? `<span class="tbar felt"><i style="width:${(felt / timeMax) * 100}%"></i><span>체감 ${felt}분</span></span>` : ""}`
      : `<span class="tbd">${TBD}</span>`;
    const inl = (t) => `<span class="leg-labels-inline">${t}</span>`;
    return `<li class="leg${s.node ? " is-node" : ""}">
      <span class="leg-no">${pad(s.id)}${s.node ? `<b>N${esc(s.node)}</b>` : ""}</span>
      <span class="leg-guide"><span class="${guideCls}">${guideTxt}</span></span>
      <span class="leg-link">${miniLink(s)}</span>
      <span class="leg-space"><i></i></span>
      <span class="leg-state ${s.state}">${esc(STATES[s.state].label)}</span>
      <span class="leg-act">${inl("행동")}${s.actions.map(esc).join(" → ")}</span>
      <span class="leg-photos">${inl("사진")}${photos}</span>
      <span class="leg-time">${tm}</span>
      <button class="leg-hit" type="button" data-i="${i}" aria-label="${pad(s.id)}. ${esc(s.title)} — 기록 자세히 보기"></button>
    </li>`;
  }).join("");

  const broken = SCENES.filter((s) => ["none", "mismatch", "risk"].includes(s.state));
  const photoKnown = SCENES.filter((s) => num(s.record.photos) != null).length;
  const photoSum = photoNums.reduce((a, b) => a + b, 0);

  $("#route").innerHTML = `
    <h2>${esc(TEXT.routeTitle)}</h2>
    <p class="route-lede">${esc(TEXT.routeLede)}</p>
    <div class="route-legend">
      ${Object.keys(STATES).map((k) => `<span>${glyph(k)}${esc(STATES[k].label)}</span>`).join("")}
      <span><i class="k" style="display:inline-block;width:10px;height:10px;background:var(--person-soft);border:1px solid var(--person)"></i>사람</span>
      <span><i class="k" style="display:inline-block;width:10px;height:10px;background:var(--phone-soft);border:1px solid var(--phone)"></i>휴대폰</span>
    </div>
    <ol class="legs">
      <li class="leg-labels" aria-hidden="true"><span></span><span>안내</span><span>연결</span><span style="color:var(--space)">공간</span><span>관계</span><span>행동</span><span>사진 장수</span><span>실제 / 체감</span></li>
      ${legs}
    </ol>
    <div class="route-sums">
      <span>연결이 끊긴 장면 <span class="rec-v">${broken.length}</span> — ${broken.map((s) => `NODE ${esc(s.node || pad(s.id))}`).join(", ")}</span>
      <span>사진 장수 합계 ${photoKnown ? `<span class="rec-v">${photoSum}장</span>` : ""} ${photoKnown < SCENES.length ? `<span class="tbd">${SCENES.length - photoKnown}개 장면 ${TBD}</span>` : ""}</span>
    </div>`;
  $("#route").addEventListener("click", (e) => {
    const b = e.target.closest(".leg-hit");
    if (b) openDetail(+b.dataset.i);
  });

  /* ---------- 4. 주제 문장 ---------- */
  const parts = TEXT.thesis.split(/(?<=다\.)\s+/);
  $("#thesis").innerHTML = `<p>${parts.map((t) => `<span>${esc(t)}</span>`).join("")}</p>`;
  $("#footer").textContent = TEXT.footer;
})();
