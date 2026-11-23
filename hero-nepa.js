/* Eleven Energy · homepage hero "Up NEPA". Loaded after script.js. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const clock = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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
