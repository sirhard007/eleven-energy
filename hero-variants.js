/* Eleven Energy · hero options (A Hear the difference, B Cut the grid, C Up NEPA). Loaded after script.js on the option pages only. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const clock = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───────── A · Hear the difference ─────────
     One power line across the hero. Left of the handle it's a 60 kVA generator: ragged,
     sooty, loud. Right of it, the same load on solar and storage: a calm line. Drag the
     handle; with sound on you hear the generator shrink as you push it back. */
  const WV = $(".hv-wave");
  if (WV) {
    const cv = $(".hvw-canvas", WV), ctx = cv.getContext("2d"), handle = $(".hvw-handle", WV);
    const left = $(".hvw-left", WV), right = $(".hvw-right", WV), copy = $(".hv-copy", WV), soundBtn = $(".hvw-sound", WV);
    let W = 0, H = 0, dpr = 1, wy = 0, s = still ? 0.5 : 0.97, sT = 0.5, drag = false, soot = [], raf = 0, visible = true, t0 = performance.now();
    const noise = Float32Array.from({ length: 2048 }, () => Math.random() * 2 - 1);
    const size = () => {
      const r = WV.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const cb = copy.getBoundingClientRect().bottom - r.top, st = Math.min(left.getBoundingClientRect().top, right.getBoundingClientRect().top) - r.top;
      wy = Math.round(cb + (st - cb) * 0.5);
      WV.style.setProperty("--wy", `${wy}px`);
    };
    const dieselY = (x, t) => {
      const chug = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
      const n = noise[(Math.floor(x / 3) + Math.floor(t * 50)) & 2047];
      return wy + chug * (22 * Math.sin(x * 0.043 - t * 9) + 11 * Math.sin(x * 0.13 + t * 17) + 9 * n);
    };
    const cleanY = (x, t) => wy + 11 * Math.sin(x * 0.011 - t * 1.9);
    function draw(now) {
      const t = (now - t0) / 1000, sx = W * s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // a warm, smoky cast behind the generator and a cool one behind the battery
      let g = ctx.createRadialGradient(sx * 0.5, wy, 0, sx * 0.5, wy, Math.max(240, sx * 0.8));
      g.addColorStop(0, "rgba(150,80,30,0.16)"); g.addColorStop(1, "rgba(150,80,30,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, sx, H);
      g = ctx.createRadialGradient(sx + (W - sx) * 0.5, wy, 0, sx + (W - sx) * 0.5, wy, Math.max(240, (W - sx) * 0.8));
      g.addColorStop(0, "rgba(205,235,107,0.10)"); g.addColorStop(1, "rgba(205,235,107,0)");
      ctx.fillStyle = g; ctx.fillRect(sx, 0, W - sx, H);
      // soot
      if (!still && sx > 10) for (let k = 0; k < 2; k++) { const x = Math.random() * sx; soot.push({ x, y: dieselY(x, t), r: 1 + Math.random() * 2, a: 0.45, vx: -0.2 - Math.random() * 0.4, vy: -0.4 - Math.random() * 0.7 }); }
      soot = soot.filter(p => { p.x += p.vx; p.y += p.vy; p.r += 0.05; p.a -= 0.004; return p.a > 0 && p.x < sx; });
      soot.forEach(p => { ctx.fillStyle = `rgba(120,108,96,${p.a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); });
      // the generator's line
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (sx > 2) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip();
        [[5, "rgba(232,150,79,0.18)", 0], [2.2, "#E8964F", 14]].forEach(([w, c, b]) => {
          ctx.lineWidth = w; ctx.strokeStyle = c; ctx.shadowColor = "rgba(232,150,79,0.7)"; ctx.shadowBlur = b;
          ctx.beginPath();
          for (let x = 0; x <= sx + 3; x += 3) { const y = dieselY(x, t); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        });
        ctx.restore();
      }
      // the battery's line, with energy gliding along it
      if (sx < W - 2) {
        ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, H); ctx.clip();
        ctx.lineWidth = 2.4; ctx.strokeStyle = "#CDEB6B"; ctx.shadowColor = "rgba(205,235,107,0.8)"; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let x = sx - 3; x <= W + 4; x += 4) { const y = cleanY(x, t); x <= sx - 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 10; ctx.fillStyle = "#F1FBC9";
        for (let k = 0; k < 9; k++) {
          const x = sx + (((t * 120 + k * 173) % (W - sx + 60)) - 30);
          ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, cleanY(x, t), 2.4, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      ctx.shadowBlur = 0;
      // the seam
      g = ctx.createLinearGradient(0, wy - 150, 0, wy + 150);
      g.addColorStop(0, "rgba(244,247,242,0)"); g.addColorStop(0.5, "rgba(244,247,242,0.5)"); g.addColorStop(1, "rgba(244,247,242,0)");
      ctx.fillStyle = g; ctx.fillRect(sx - 0.5, wy - 150, 1, 300);
      handle.style.left = `${sx}px`;
      const e = v => clamp(v, 0, 1);
      left.style.opacity = (0.3 + 0.7 * e((s - 0.12) / 0.3)).toFixed(2);
      right.style.opacity = (0.3 + 0.7 * e((0.88 - s) / 0.3)).toFixed(2);
      handle.setAttribute("aria-valuenow", Math.round(s * 100));
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      s += (sT - s) * (drag ? 0.35 : 0.07);
      draw(now);
      sound.mix(s);
    }
    // sound, built only when asked for
    const sound = {
      ctx: null, d: null, c: null, on: false,
      start() {
        const A = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const out = A.createGain(); out.gain.value = 0.9; out.connect(A.destination);
        this.d = A.createGain(); this.d.gain.value = 0; this.d.connect(out);
        this.c = A.createGain(); this.c.gain.value = 0; this.c.connect(out);
        const lp = A.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.connect(this.d);
        const chug = A.createGain(); chug.gain.value = 0.6; chug.connect(lp);
        const lfo = A.createOscillator(), lfoG = A.createGain(); lfo.frequency.value = 7.5; lfoG.gain.value = 0.35; lfo.connect(lfoG); lfoG.connect(chug.gain); lfo.start();
        [[49, "sawtooth", 0.5], [98, "square", 0.12], [24.5, "sawtooth", 0.4]].forEach(([f, type, v]) => { const o = A.createOscillator(), og = A.createGain(); o.type = type; o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(chug); o.start(); });
        const buf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const nz = A.createBufferSource(), bp = A.createBiquadFilter(), ng = A.createGain();
        nz.buffer = buf; nz.loop = true; bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7; ng.gain.value = 0.25;
        nz.connect(bp); bp.connect(ng); ng.connect(chug); nz.start();
        // the battery side: an inverter's faint whine and a cooling fan
        const hum = A.createOscillator(), hg = A.createGain(); hum.frequency.value = 7800; hg.gain.value = 0.004; hum.connect(hg); hg.connect(this.c); hum.start();
        const fan = A.createBufferSource(), fl = A.createBiquadFilter(), fg = A.createGain();
        fan.buffer = buf; fan.loop = true; fl.type = "lowpass"; fl.frequency.value = 300; fg.gain.value = 0.05; fan.connect(fl); fl.connect(fg); fg.connect(this.c); fan.start();
      },
      mix(v) {
        if (!this.on || !this.ctx) return;
        const n = this.ctx.currentTime;
        this.d.gain.setTargetAtTime(0.32 * v * v, n, 0.08);
        this.c.gain.setTargetAtTime(0.9 * (1 - v), n, 0.08);
      },
      toggle() {
        if (!this.ctx) this.start();
        this.on = !this.on;
        if (this.on) { this.ctx.resume(); this.mix(s); } else { this.d.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); this.c.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
        soundBtn.setAttribute("aria-pressed", String(this.on));
        $(".hvw-sound-label", soundBtn).textContent = this.on ? "Sound off" : "Turn sound on";
        $("use", soundBtn).setAttribute("href", this.on ? "#i-mute" : "#i-sound");
      },
    };
    soundBtn.addEventListener("click", () => sound.toggle());
    // dragging, from the handle or anywhere along the line
    const setFrom = e => { const r = WV.getBoundingClientRect(); sT = clamp((e.clientX - r.left) / W, 0.03, 0.97); };
    const near = e => Math.abs(e.clientY - WV.getBoundingClientRect().top - wy) < 90;
    const down = e => { drag = true; setFrom(e); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    handle.addEventListener("pointerdown", down);
    cv.addEventListener("pointerdown", e => { if (near(e)) down(e); });
    [handle, cv].forEach(el => {
      el.addEventListener("pointermove", e => {
        if (el === cv) cv.classList.toggle("is-near", near(e));
        if (drag) setFrom(e);
        else if (e.pointerType === "mouse" && el === cv && near(e)) setFrom(e); // hover along the line moves it too
      });
      el.addEventListener("pointerup", () => { drag = false; });
      el.addEventListener("pointercancel", () => { drag = false; });
    });
    handle.addEventListener("keydown", e => {
      const k = { ArrowLeft: -0.05, ArrowRight: 0.05, Home: -1, End: 1 }[e.key];
      if (k) { e.preventDefault(); sT = clamp(sT + k, 0.03, 0.97); if (still) { s = sT; draw(performance.now()); } }
    });
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(WV);
    window.addEventListener("resize", () => { size(); if (still) draw(performance.now()); });
    const go = () => { size(); if (still) { s = sT; draw(t0 + 400); } else if (!raf) raf = requestAnimationFrame(tick); };
    (document.fonts?.ready || Promise.resolve()).then(go);
    window.addEventListener("load", size);
  }

  /* ───────── B · Cut the grid ─────────
     A street in Kaduna at 19:40. Press the switch: the street goes dark in a wave,
     three neighbours start generators, the clinic on our microgrid carries on. */
  const B = $(".hv-b");
  if (B) {
    const svg = $(".hvb-svg", B), btn = $(".hvb-switch", B), label = $(".hvb-label", B);
    const stateEl = $(".hvb-state", B), pin = $(".hvb-pin", B), genTags = $$(".hvb-gen", B);
    const out = { sw: $("[data-k=sw]", B), time: $("[data-k=time]", B), bat: $("[data-k=bat]", B), here: $("[data-k=here]", B), next: $("[data-k=next]", B) };
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const W = 1440, G = 300; // viewBox width, ground line
    const CL = { x: 590, w: 250, h: 96 }; // the clinic
    const top = G - CL.h;
    // phones see a narrow slice around the clinic, so the street is drawn taller there
    // and the generators start in the buildings either side of it
    const mq = window.matchMedia("(max-width: 900px)");
    let narrow = mq.matches, genSpots = [];
    const build = () => {
    seed = 11;
    let html = `<defs><radialGradient id="hvbLamp"><stop offset="0" stop-color="#F6D49A" stop-opacity=".42"/><stop offset="1" stop-color="#F6D49A" stop-opacity="0"/></radialGradient>
      <radialGradient id="hvbSpark"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".25" stop-color="#F1FBC9" stop-opacity=".7"/><stop offset="1" stop-color="#CDEB6B" stop-opacity="0"/></radialGradient>
      <radialGradient id="hvbHalo"><stop offset="0" stop-color="#CDEB6B" stop-opacity=".22"/><stop offset="1" stop-color="#CDEB6B" stop-opacity="0"/></radialGradient></defs>`;
    const windows = (x, top, w, h, size, gapX, gapY, p, cls = "") => {
      let s = "";
      const cols = Math.max(1, Math.floor((w - 12) / gapX)), rows = Math.max(1, Math.floor((h - 16) / gapY));
      const ox = x + (w - (cols - 1) * gapX - size[0]) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = ox + c * gapX, on = rnd() < p;
        s += `<rect class="sk-win${on ? " on" : ""}${cls}" x="${wx.toFixed(1)}" y="${(top + 10 + r * gapY).toFixed(1)}" width="${size[0]}" height="${size[1]}" style="--d:${Math.round(wx * 0.55 + rnd() * 60)}ms"/>`;
      }
      return s;
    };
    // far row
    let fx = -20, far = "";
    while (fx < W) {
      const w = 46 + rnd() * 70, near = Math.abs(fx + w / 2 - W / 2) < 330;
      const h = near ? (narrow ? 104 : 70) + rnd() * 50 : 110 + rnd() * 110;
      far += `<g class="sk-far sk-lit"><rect x="${fx.toFixed(1)}" y="${(G - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>${windows(fx, G - h, w, h, [4, 6], 11, 15, 0.28, " sk-dim")}</g>`;
      fx += w + 2 + rnd() * 6;
    }
    html += far;
    // near row, leaving the clinic's plot clear
    const near = [];
    let nx = -10;
    while (nx < W) {
      const w = 64 + rnd() * 70;
      const gap = narrow ? 80 : 96;
      if (nx + w > CL.x - 24 && nx < CL.x + CL.w + gap) { nx = CL.x + CL.w + gap + 4; continue; }
      const dist = Math.abs(nx + w / 2 - W / 2);
      const h = dist < 330 ? (narrow ? 92 + rnd() * 54 : 58 + rnd() * 26) : dist < 520 ? 110 + rnd() * 60 : 150 + rnd() * 100;
      near.push({ x: nx, w, h });
      nx += w + 8 + rnd() * 16;
    }
    const gens = new Set();
    (narrow ? [CL.x - 80, CL.x + CL.w + 120, 330] : [CL.x - 130, 330, 110]).forEach(target => {
      let best = 0, bd = 1e9;
      near.forEach((b, i) => { const d = Math.abs(b.x + b.w / 2 - target); if (d < bd && !gens.has(i)) { bd = d; best = i; } });
      gens.add(best);
    });
    genSpots = [];
    near.forEach((b, i) => {
      const gen = gens.has(i), g = gen ? 1800 + genSpots.length * 900 : 0;
      let extra = "";
      if (gen) {
        const gx = b.x + b.w + 3;
        extra = `<rect class="sk-genbox" x="${gx.toFixed(1)}" y="${G - 14}" width="16" height="14" rx="2"/>` +
          [0, 700, 1400].map(p => `<circle class="sk-puff" cx="${(gx + 10).toFixed(1)}" cy="${G - 18}" r="4" style="--p:${p}ms"/>`).join("");
        genSpots.push({ x: b.x + b.w / 2, y: G - b.h });
      }
      html += `<g class="sk-lit${gen ? " sk-gen" : ""}" style="--g:${g}ms"><rect class="sk-bld" x="${b.x.toFixed(1)}" y="${(G - b.h).toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}"/>${windows(b.x, G - b.h, b.w, b.h, [7, 10], 15, 19, 0.6)}${extra}</g>`;
    });
    // the clinic, its roof array and the battery container beside it
    let panels = "";
    for (let i = 0; i < 9; i++) {
      const px = CL.x + 10 + i * 25.5;
      panels += `<polygon class="sk-panel" points="${px},${top} ${px + 22},${top} ${px + 27},${top - 13} ${px + 5},${top - 13}"/>`;
    }
    let bars = "";
    for (let i = 0; i < 11; i++) bars += `<rect class="sk-bar${i > 8 ? " sk-v" : ""}" x="${CL.x + CL.w + 22 + i * 4.2}" y="${G - 30}" width="${i > 8 ? 2.6 : 2}" height="16" style="--n:${i * 120}ms"/>`;
    html += `<ellipse class="sk-halo" cx="${CL.x + CL.w / 2 + 30}" cy="${G - 20}" rx="230" ry="90" fill="url(#hvbHalo)"/>
      <g class="sk-lit sk-ours"><rect class="sk-body" x="${CL.x}" y="${top}" width="${CL.w}" height="${CL.h}" rx="2"/>${panels}
      ${windows(CL.x, top + 4, CL.w, CL.h - 18, [14, 12], 24, 24, 1)}
      <rect class="sk-cross" x="${CL.x + CL.w / 2 - 2.5}" y="${top + 6}" width="5" height="13"/><rect class="sk-cross" x="${CL.x + CL.w / 2 - 6.5}" y="${top + 10}" width="13" height="5"/>
      <rect class="sk-box" x="${CL.x + CL.w + 14}" y="${G - 38}" width="62" height="38" rx="2"/>${bars}</g>`;
    // overhead lines: the grid feed for the whole street
    const POLES = [40, 280, 520, 940, 1140, 1380], PT = G - 128;
    let poles = "";
    POLES.forEach(x => { poles += `<path class="sk-pole" d="M${x} ${G} V${PT - 4} M${x - 14} ${PT} H${x + 14}"/>`; });
    const wire = off => {
      let d = `M-30 ${PT + 10}`;
      const xs = [-30, ...POLES, W + 30];
      for (let i = 1; i < xs.length; i++) d += ` Q${(xs[i - 1] + xs[i]) / 2} ${PT + 32} ${xs[i]} ${PT + (i === xs.length - 1 ? 10 : 0)}`;
      return `<path class="sk-wire" d="${d}" transform="translate(${off} 0)"/>`;
    };
    html += poles + wire(-12) + wire(12) + `<g class="sk-spark"><circle r="22" fill="url(#hvbSpark)"/><circle r="2.6" fill="#FFFFFF"/></g>`;
    // street lamps and the ground
    let lamps = "";
    for (let x = 60; x < W; x += 150) {
      if (x > CL.x - 10 && x < CL.x + CL.w + 90) continue;
      lamps += `<g style="--d:${Math.round(x * 0.55)}ms"><circle class="sk-lamp-glow" cx="${x + 8}" cy="${G - 40}" r="30" fill="url(#hvbLamp)"/><path class="sk-lamp" d="M${x} ${G} V${G - 42} h8" fill="none"/><circle class="sk-lamp-head" cx="${x + 8}" cy="${G - 40}" r="2.6"/></g>`;
    }
    html += lamps + `<rect class="sk-ground" x="0" y="${G}" width="${W}" height="${320 - G}"/><line class="sk-kerb" x1="0" x2="${W}" y1="${G}" y2="${G}"/>`;
    svg.innerHTML = html;
    };
    build();

    // labels in HTML, placed over the drawing
    const place = () => {
      const m = svg.getScreenCTM(), box = B.getBoundingClientRect();
      if (!m) return;
      const at = (x, y, el) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        el.style.left = `${p.x - box.left}px`;
        el.style.top = `${p.y - box.top}px`;
      };
      at(CL.x + CL.w / 2, top - 14, pin);
      genTags.forEach((t, i) => {
        if (!genSpots[i]) return;
        at(genSpots[i].x, genSpots[i].y, t);
        // keep the tag on screen if its building is; hide it if the building is off the edge
        const x = parseFloat(t.style.left), half = t.offsetWidth / 2 + 8;
        t.style.visibility = x < 0 || x > box.width ? "hidden" : "";
        t.style.left = `${clamp(x, half, box.width - half)}px`;
      });
    };
    place();
    mq.addEventListener?.("change", e => { narrow = e.matches; build(); place(); });
    window.addEventListener("resize", place);
    window.addEventListener("load", place);
    genTags.forEach((t, i) => t.style.setProperty("--g", `${1800 + i * 900}ms`));

    // the clinic: 120 kWh of storage, about 9 kW in the evening
    let isOut = false, simMin = 0, diesel = 0, loop = 0, genTimer = 0, msgTimer = 0;
    const fmt = m => (m < 60 ? `${Math.floor(m)} min` : `${Math.floor(m / 60)} h ${pad(Math.floor(m % 60))} min`);
    const setState = t => { if (stateEl.textContent !== t) stateEl.textContent = t; };
    const paint = () => {
      const bat = clamp(100 - simMin * 0.125, 12, 100), left = Math.max(0, ((bat - 10) / 100) * 120 / 9);
      out.time.textContent = isOut ? fmt(simMin) : "None";
      out.bat.textContent = `${Math.round(bat)}%`;
      out.next.textContent = `${diesel.toFixed(1)} L`;
      out.next.classList.toggle("is-bad", diesel > 0);
      if (isOut && simMin > 90) setState(`Still on battery after ${fmt(simMin)}. About ${Math.round(left)} hours left at tonight's load.`);
    };
    const cut = () => {
      isOut = true; simMin = 0; diesel = 0;
      B.classList.add("is-out");
      btn.setAttribute("aria-pressed", "true");
      label.textContent = "Bring the grid back";
      out.sw.textContent = "18 ms"; out.sw.classList.add("is-good");
      setState("Grid down at 19:40. The clinic switched to battery in 18 ms.");
      clearTimeout(genTimer);
      genTimer = setTimeout(() => { B.classList.add("is-gen"); setState("Three generators running on this street. The clinic is on battery, and quiet."); }, 1800);
      let lastT = performance.now();
      clearInterval(loop);
      loop = setInterval(() => {
        const t = performance.now(), dt = (t - lastT) / 1000; lastT = t;
        simMin = Math.min(simMin + dt * 3, 720);              // three minutes a second
        if (B.classList.contains("is-gen")) diesel += dt * 3 * (3 * 7.5 / 60); // three 20 kVA sets, ~7.5 L/h each
        paint();
      }, 250);
      paint();
    };
    const restore = () => {
      isOut = false;
      clearInterval(loop); clearTimeout(genTimer);
      B.classList.remove("is-out", "is-gen");
      btn.setAttribute("aria-pressed", "false");
      label.textContent = "Cut the grid";
      out.sw.textContent = "Not needed"; out.sw.classList.remove("is-good");
      setState("Grid back. The battery refills from the grid tonight and the sun tomorrow.");
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { if (!isOut) { simMin = 0; setState("Grid on. The battery is full from today's sun."); paint(); } }, 5000);
      paint();
    };
    // on a cut, a spark runs down the line and the dark follows it
    const runSpark = () => {
      const wireEl = $(".sk-wire", svg), spark = $(".sk-spark", svg);
      if (still || !wireEl) return;
      const len = wireEl.getTotalLength(), t0 = performance.now();
      const f = ts => {
        const k = Math.min(1, (ts - t0) / 820), p = wireEl.getPointAtLength(len * k);
        spark.setAttribute("transform", `translate(${(p.x - 12).toFixed(1)} ${p.y.toFixed(1)}) scale(${(1 + Math.sin(ts / 30) * 0.18).toFixed(2)})`);
        spark.style.opacity = k < 0.9 ? 1 : (1 - k) * 10;
        if (k < 1) requestAnimationFrame(f); else spark.style.opacity = 0;
      };
      requestAnimationFrame(f);
    };
    btn.addEventListener("click", () => (isOut ? restore() : (runSpark(), cut())));
    paint();
    if (location.hash === "#cut") window.addEventListener("load", () => setTimeout(() => { runSpark(); cut(); }, 300));
  }

  /* ───────── C · Up NEPA ─────────
     One bulb on a cord, the only light in the room. The grid sags, teases, and goes; the
     filament cools in the dark and the street groans. Switch to Eleven's battery: a relay
     clicks, the filament flares and the light sweeps back across the room. */
  const L = $(".hv-bulb");
  if (L) {
    const cv = $(".hvl-canvas", L), ctx = cv.getContext("2d"), grab = $(".hvl-grab", L), hint = $(".hvl-hint", L);
    const statusEl = $(".hvl-status span", L), sw = $(".hvl-switch", L), swLabel = $(".hvl-switch-label", L), tag = $(".tag", L);
    const N = 14;
    let W = 0, H = 0, dpr = 1, pts = [], seg = 12, held = false, raf = 0, visible = true;
    // light: how much of the room is lit; heat: how hot the filament is; reach: how far the light has spread
    let state = "grid", light = 1, heat = 0.9, reach = 1, phase = null, phaseT = 0, timers = [], dust = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
    const say = t => { statusEl.textContent = t; };
    const ease = k => 1 - (1 - k) ** 3;
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const EMBER = [255, 96, 30], GRID = [255, 212, 148], CELL = [255, 246, 224];

    const size = () => {
      const r = L.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const ropeLen = Math.max(120, tag.getBoundingClientRect().top - r.top - 58);
      seg = ropeLen / (N - 1);
      pts = Array.from({ length: N }, (_, i) => ({ x: W / 2, y: i * seg, px: W / 2, py: i * seg }));
      dust = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.8, v: 0.1 + Math.random() * 0.25, r: 0.6 + Math.random() * 1.1, p: Math.random() * 6.28 }));
    };
    function physics() {
      const a = pts[0]; a.x = W / 2; a.y = -6;
      for (let i = 1; i < N; i++) {
        const p = pts[i];
        if (held && i === N - 1) continue;
        const vx = (p.x - p.px) * 0.993, vy = (p.y - p.py) * 0.993;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + 0.45;
      }
      for (let k = 0; k < 16; k++) for (let i = 0; i < N - 1; i++) {
        const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, diff = (d - seg) / d;
        const pinP = i === 0, pinQ = held && i + 1 === N - 1;
        if (pinP && pinQ) continue;
        const wp = pinP ? 0 : pinQ ? 1 : 0.5, wq = 1 - wp;
        p.x += dx * diff * wp; p.y += dy * diff * wp;
        q.x -= dx * diff * wq; q.y -= dy * diff * wq;
      }
    }

    // what the light is doing right now
    function level(now) {
      const e = now - phaseT;
      if (phase === "outage") {
        // 0–1.6 s: the voltage sags, the bulb goes dim and orange and wobbles
        if (e < 1600) { const k = ease(e / 1600), w = 0.07 * Math.sin(e / 38) + 0.05 * Math.sin(e / 13); light = 1 - 0.62 * k + w; heat = 0.9 - 0.45 * k + w; reach = 1 - 0.25 * k; return; }
        // a hopeful surge, brighter than before
        if (e < 1900) { light = 1.15; heat = 1; reach = 1; return; }
        // it sags again and stutters
        if (e < 2250) { const on = Math.floor(e / 55) % 2; light = on ? 0.75 : 0.2; heat = on ? 0.7 : 0.4; reach = 0.85; return; }
        // and it's gone; only the filament still glows, cooling
        light = 0; reach = 0.3;
        heat = 0.55 * Math.exp(-(e - 2250) / 520);
        return;
      }
      if (phase === "switch") {
        // the relay takes 18 ms; then the filament flares and the light sweeps outwards
        if (e < 18) { light = 0; return; }
        const k = Math.min(1, (e - 18) / 650);
        heat = Math.min(1, (e - 18) / 110);
        reach = 0.12 + 0.88 * ease(k);
        light = Math.min(1.35, (e - 18) / 40) * (1 + 0.35 * Math.exp(-(e - 18) / 260));
        light = Math.min(light, 1 + 0.35 * Math.exp(-(e - 18) / 260));
        if (e > 1400) phase = null;
        return;
      }
      if (state === "grid") { const dip = Math.random() < 0.025 ? 0.22 * Math.random() : 0; light += (1 - dip - light) * 0.5; heat += (0.9 - dip - heat) * 0.5; reach += (1 - reach) * 0.1; return; }
      if (state === "eleven") { light += (1 - light) * 0.3; heat += (1 - heat) * 0.3; reach += (1 - reach) * 0.1; return; }
      // dark: whatever's left of the filament keeps cooling
      light = 0; heat *= 0.985;
    }

    function draw(now) {
      level(now);
      // the battery's light is the same warm light as the grid's; only the switch-on flare runs white
      const b = pts[N - 1], flare = phase === "switch" ? Math.max(0, 1 - (now - phaseT - 18) / 700) : 0;
      const col = heat < 0.55 ? mix(EMBER, GRID, Math.max(0, heat) / 0.55) : mix(GRID, CELL, flare);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(3,8,6,0.965)";
      ctx.fillRect(0, 0, W, H);
      const R = Math.max(W, H) * 0.62 * reach, Lc = Math.min(1, light);
      if (light > 0.01) {
        ctx.globalCompositeOperation = "destination-out";
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
        g.addColorStop(0, `rgba(0,0,0,${Lc})`); g.addColorStop(0.32, `rgba(0,0,0,${0.94 * Lc})`);
        g.addColorStop(0.62, `rgba(0,0,0,${0.5 * Lc})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        const w = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 0.55);
        w.addColorStop(0, `rgba(${col},${0.22 * light})`); w.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = w; ctx.fillRect(0, 0, W, H);
        dust.forEach(d => {
          d.y -= d.v * 0.3; d.x += Math.sin(now / 1400 + d.p) * 0.15;
          if (d.y < 0) { d.y = H * 0.8; d.x = Math.random() * W; }
          const f = Math.max(0, 1 - Math.hypot(d.x - b.x, d.y - b.y) / (R * 0.45));
          if (f <= 0) return;
          ctx.fillStyle = `rgba(${col},${(0.5 * f * Lc).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill();
        });
      }
      // the switch: a ring of light running out from the bulb
      if (phase === "switch") {
        const e = now - phaseT - 18;
        if (e > 0 && e < 900) {
          const k = e / 900;
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(205,235,107,${(0.55 * (1 - k)).toFixed(3)})`;
          ctx.lineWidth = 2 + 6 * (1 - k);
          ctx.beginPath(); ctx.arc(b.x, b.y + 26, 20 + ease(k) * Math.max(W, H) * 0.5, 0, 6.2832); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      // the cord
      ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.strokeStyle = light > 0.05 ? "rgba(150,140,120,0.9)" : "rgba(40,48,44,0.9)";
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      // the bulb: holder, glass, filament
      const q = pts[N - 2], ang = Math.atan2(b.y - q.y, b.x - q.x) - Math.PI / 2;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
      ctx.fillStyle = "#1A2420"; ctx.fillRect(-7, -4, 14, 12);
      ctx.fillStyle = "#2C3832"; ctx.fillRect(-6, 8, 12, 5);
      const glow = Math.max(Lc, heat * 0.35);
      const gl = ctx.createRadialGradient(0, 26, 2, 0, 26, 17);
      gl.addColorStop(0, glow > 0.04 ? `rgba(${mix(col, [255, 255, 255], Lc * 0.7)},${0.3 + 0.7 * glow})` : "rgba(70,80,76,0.6)");
      gl.addColorStop(0.5, glow > 0.04 ? `rgba(${col},${0.2 + 0.6 * glow})` : "rgba(40,50,46,0.5)");
      gl.addColorStop(1, glow > 0.04 ? `rgba(${col},${0.12 + 0.2 * glow})` : "rgba(30,38,34,0.4)");
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.moveTo(-6, 13); ctx.bezierCurveTo(-7, 18, -16, 20, -16, 28); ctx.arc(0, 28, 16, Math.PI, 0, true); ctx.bezierCurveTo(16, 20, 7, 18, 6, 13); ctx.closePath(); ctx.fill();
      const fil = heat > 0.03 ? `rgba(${mix(col, [255, 255, 255], Math.max(0, heat - 0.6))},${Math.min(1, 0.25 + heat)})` : "rgba(90,96,92,0.6)";
      ctx.strokeStyle = fil; ctx.lineWidth = 1.3;
      if (heat > 0.03) { ctx.shadowColor = `rgba(${col},0.9)`; ctx.shadowBlur = 4 + 10 * heat; }
      ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(-3, 24); ctx.lineTo(-1, 21); ctx.lineTo(1, 25); ctx.lineTo(3, 21); ctx.lineTo(4, 14); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      grab.style.left = `${b.x}px`; grab.style.top = `${b.y + 22}px`;
      hint.style.left = `${b.x}px`; hint.style.top = `${b.y + 26}px`;
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      physics(); draw(now);
    }

    // the street reacts when it goes
    const SHOUTS = [["Haaa!", 0.16, 0.3], ["NEPA!", 0.8, 0.22], ["Not again o!", 0.72, 0.62], ["Ehn ehn…", 0.2, 0.7]];
    const groan = () => {
      if (still) return;
      SHOUTS.forEach(([t, x, y], i) => later(() => {
        const s = document.createElement("span");
        s.className = "hvl-shout"; s.textContent = t; s.setAttribute("aria-hidden", "true");
        s.style.left = `${x * 100}%`; s.style.top = `${y * 100}%`;
        L.appendChild(s);
        setTimeout(() => s.remove(), 2600);
      }, 160 + i * 330));
    };
    const outage = ms => {
      later(() => {
        if (state !== "grid") return;
        say("Voltage dropping…");
        phase = "outage"; phaseT = performance.now();
        later(() => {
          if (phase !== "outage") return;
          state = "dark"; L.dataset.state = "dark";
          L.classList.remove("is-cut"); void L.offsetWidth; L.classList.add("is-cut");
          say("NEPA has taken light.");
          swLabel.textContent = "Switch to Eleven";
          groan();
          later(() => { if (state === "dark") say("Third time today."); }, 2600);
          if (still) draw(performance.now());
        }, still ? 0 : 2250);
      }, ms);
    };
    const toEleven = () => {
      clearLater();
      const wasDark = state === "dark";
      state = "eleven"; L.dataset.state = "eleven";
      $$(".hvl-shout", L).forEach(s => s.remove());
      sw.classList.remove("is-clicked"); void sw.offsetWidth; sw.classList.add("is-clicked");
      if (!still) { phase = "switch"; phaseT = performance.now(); }
      else { phase = null; light = heat = reach = 1; }
      say(wasDark ? "Back on in 18 ms. On Eleven battery." : "On Eleven battery · 9 h left");
      swLabel.textContent = "Back to grid";
      later(() => say("On Eleven battery · 9 h left"), 2600);
      let n = 0;
      const loop = () => later(() => { if (state !== "eleven") return; n += 1; say(n % 2 ? "Grid flickered. Lights stayed on." : "On Eleven battery · 9 h left"); loop(); }, 6000);
      loop();
      if (still) draw(performance.now());
    };
    const toGrid = () => {
      clearLater();
      state = "grid"; phase = null; L.dataset.state = "grid";
      say("Grid on · for now");
      swLabel.textContent = "Switch to Eleven";
      outage(4500);
      if (still) draw(performance.now());
    };
    sw.addEventListener("click", () => (state === "eleven" ? toGrid() : toEleven()));

    // grabbing the bulb
    const at = e => { const r = L.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    grab.addEventListener("pointerdown", e => {
      e.preventDefault(); held = true; grab.classList.add("is-held"); hint.classList.add("is-gone");
      try { grab.setPointerCapture(e.pointerId); } catch (_) {}
    });
    grab.addEventListener("pointermove", e => {
      if (!held) return;
      const b = pts[N - 1], [x, y] = at(e);
      b.px = b.x; b.py = b.y;
      b.x = clamp(x, 20, W - 20); b.y = clamp(y - 22, 30, H - 120);
      if (still) draw(performance.now());
    });
    const letGo = () => { held = false; grab.classList.remove("is-held"); };
    grab.addEventListener("pointerup", letGo);
    grab.addEventListener("pointercancel", letGo);
    grab.addEventListener("keydown", e => {
      const k = { ArrowLeft: -14, ArrowRight: 14 }[e.key];
      if (k) { e.preventDefault(); pts[N - 1].px -= k; hint.classList.add("is-gone"); }
    });
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(L);
    let rz;
    window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { size(); if (still) draw(performance.now()); }, 120); });
    const go = () => {
      size();
      L.dataset.state = "grid";
      say("Grid on · Surulere, 20:12");
      if (still) { draw(performance.now()); return; }
      pts[N - 1].px -= 26; // a small push so it's already swinging
      raf = requestAnimationFrame(tick);
      outage(3200);
    };
    (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(go));
  }
})();
