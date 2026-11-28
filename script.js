/* Eleven Energy · hero interactions */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const hero = $("#hero");
  const heroImg = $("#heroImg");
  const art = $("#heroArt");
  const inlineImg = $("#inlineImg");
  const linesSvg = $("#nodeLines");
  const nodes = $$(".node");
  let placeholder = false;

  /* ── Art: use assets/hero.jpg when it exists, otherwise stage the reference photo ── */
  const usePlaceholder = () => {
    if (placeholder) return;
    placeholder = true;
    hero.classList.add("is-placeholder");
    heroImg.src = "assets/placeholder-unit.jpg";
  };
  const inlineFallback = () => inlineImg.parentElement.classList.add("is-placeholder");
  if (heroImg) {
    heroImg.addEventListener("error", usePlaceholder);
    heroImg.addEventListener("load", layoutNodes);
    inlineImg.addEventListener("error", inlineFallback);
    // the script runs after the images started loading, so catch failures that already happened
    if (heroImg.complete && !heroImg.naturalWidth) usePlaceholder();
    if (inlineImg.complete && !inlineImg.naturalWidth) inlineFallback();
  }

  /* ── Map a point on the image (0–1) to a point in the hero, honouring object-fit: cover ── */
  function imagePoint(fx, fy) {
    const box = heroImg.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    const nw = heroImg.naturalWidth, nh = heroImg.naturalHeight;
    if (!nw || !nh) return null;
    const pos = getComputedStyle(heroImg).objectPosition.split(" ").map(v => parseFloat(v) / 100);
    const scale = Math.max(box.width / nw, box.height / nh);
    const dw = nw * scale, dh = nh * scale;
    const ox = (box.width - dw) * pos[0];
    const oy = (box.height - dh) * pos[1];
    return { x: box.left - h.left + ox + fx * dw, y: box.top - h.top + oy + fy * dh, dw, dh, ox, oy, box, h };
  }

  /* ── Framing: on every screen, slide the photo so the unit starts below the buttons
        and its base (and the charger) stays in view. Anchors live on #heroArt:
        data-top = highest point of the product, data-base = where it meets the ground. ── */
  function fitArt() {
    if (!heroImg) return;
    const nw = heroImg.naturalWidth, nh = heroImg.naturalHeight;
    if (!nw) return;
    if (window.innerWidth <= 900) { heroImg.style.objectPosition = ""; return; }
    const W = hero.clientWidth, H = hero.clientHeight;
    const scale = Math.max(W / nw, H / nh), dh = nh * scale;
    const spare = H - dh;                    // ≤ 0: how much of the photo's height is cropped
    if (spare > -1) { heroImg.style.objectPosition = "50% 50%"; return; }
    const topF = parseFloat(art.dataset.top || "0.6"), baseF = parseFloat(art.dataset.base || "0.9");
    const cta = $(".cta-row").getBoundingClientRect();
    const copyBottom = cta.bottom - hero.getBoundingClientRect().top - 16; // ignore the reveal offset
    let oy = copyBottom + 36 - topF * dh;   // product top just under the buttons
    const fold = H - (parseFloat(getComputedStyle(hero).getPropertyValue("--tail")) || 0);
    oy = Math.min(oy, fold - 24 - baseF * dh);  // ...but keep its base above the fold
    oy = Math.max(spare, Math.min(0, oy));
    heroImg.style.objectPosition = "50% " + (oy / spare * 100).toFixed(2) + "%";
  }

  function layoutNodes() {
    if (!heroImg || !heroImg.naturalWidth) return;
    fitArt();
    const W = hero.clientWidth, H = hero.clientHeight;
    linesSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let paths = "";
    const wide = W > 960;
    const hr = hero.getBoundingClientRect();
    const copyBox = (() => {
      const els = [$(".tag"), $(".headline"), $(".lede"), $(".cta-row")].map(e => e.getBoundingClientRect());
      return { l: Math.min(...els.map(e => e.left)) - hr.left, r: Math.max(...els.map(e => e.right)) - hr.left,
               t: Math.min(...els.map(e => e.top)) - hr.top, b: Math.max(...els.map(e => e.bottom)) - hr.top - 16 };
    })();
    const taken = [copyBox, { l: 0, t: 0, r: W, b: 90 }];

    nodes.forEach((node, i) => {
      const fx = parseFloat(placeholder ? node.dataset.px : node.dataset.x);
      const fy = parseFloat(placeholder ? node.dataset.py : node.dataset.y);
      if (Number.isNaN(fx) || Number.isNaN(fy)) { node.hidden = true; return; }
      const p = imagePoint(fx, fy);
      if (!p || p.x < 12 || p.x > W - 12 || p.y < 12 || p.y > H - 12) { node.hidden = true; return; }
      node.hidden = false;
      node.style.transform = `translate(${p.x}px, ${p.y}px)`;
      node.style.setProperty("--i", i);
      node.querySelector(".node-dot").style.setProperty("--ping", `${i * 0.7}s`);

      const chip = node.querySelector(".chip");
      const side = node.dataset.side;
      // optional placeholder-only overrides (data-preach / data-plift)
      const pick = k => (placeholder && node.dataset["p" + k] ? node.dataset["p" + k] : node.dataset[k]);
      const reach = +pick("reach") * (wide ? Math.min(1, W / 1440) : 0.4);
      const lift = +pick("lift");
      const cw = chip.offsetWidth || 180, ch = chip.offsetHeight || 40;

      // chip sits beside the elbow; keep it on screen
      let cx = side === "right" ? reach : -reach - cw;
      const absLeft = p.x + cx;
      if (absLeft < 16) cx += 16 - absLeft;
      if (absLeft + cw > W - 16) cx -= absLeft + cw - (W - 16);
      const cy = lift - ch / 2;
      chip.style.left = `${cx}px`;
      chip.style.top = `${cy}px`;
      const box = { l: p.x + cx, t: p.y + cy, r: p.x + cx + cw, b: p.y + cy + ch };
      const hit = q => !(box.r + 10 < q.l || box.l - 10 > q.r || box.b + 10 < q.t || box.t - 10 > q.b);
      if (taken.some(hit) || (p.y < copyBox.b + 8)) { node.hidden = true; return; }
      taken.push(box);

      if (wide) {
        // elbow: from dot straight up/down to the chip's centre line, then across to its edge
        const ex = p.x + (side === "right" ? Math.min(28, reach * 0.3) : -Math.min(28, reach * 0.3));
        const ey = p.y + lift;
        const edge = side === "right" ? p.x + cx : p.x + cx + cw;
        const d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} L${edge.toFixed(1)} ${ey.toFixed(1)}`;
        const len = Math.hypot(ex - p.x, ey - p.y) + Math.abs(edge - ex);
        paths += `<path data-node="${i}" d="${d}" style="--len:${len.toFixed(0)}"/>`;
      }
    });
    linesSvg.innerHTML = paths;
    requestAnimationFrame(() => {
      linesSvg.classList.add("is-drawn");
      $("#nodes").classList.add("is-in");
    });
  }

  // Hover/tap a node to open its detail line and brighten its connector
  nodes.forEach((node, i) => {
    const set = on => {
      node.classList.toggle("is-open", on);
      const path = linesSvg.querySelector(`[data-node="${i}"]`);
      if (path) path.classList.toggle("is-hot", on);
    };
    node.addEventListener("mouseenter", () => set(true));
    node.addEventListener("mouseleave", () => set(false));
    node.querySelector(".node-dot").addEventListener("click", e => {
      e.stopPropagation();
      const open = !node.classList.contains("is-open");
      nodes.forEach(n => n.classList.remove("is-open"));
      set(open);
    });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".node")) nodes.forEach(n => n.classList.remove("is-open")); });

  let rT;
  window.addEventListener("resize", () => { cancelAnimationFrame(rT); rT = requestAnimationFrame(layoutNodes); });

  /* ── Calibration: open with ?calibrate, click the image to read a point ── */
  if (hero && new URLSearchParams(location.search).has("calibrate")) {
    const panel = $("#calibrate"), out = $("#calibrateOut");
    panel.hidden = false;
    hero.classList.add("is-calibrating");
    art.addEventListener("click", e => {
      const o = imagePoint(0, 0);
      const fx = (e.clientX - o.h.left - (o.box.left - o.h.left) - o.ox) / o.dw;
      const fy = (e.clientY - o.h.top - (o.box.top - o.h.top) - o.oy) / o.dh;
      const key = placeholder ? ["data-px", "data-py"] : ["data-x", "data-y"];
      out.textContent = `${key[0]}="${fx.toFixed(3)}" ${key[1]}="${fy.toFixed(3)}"`;
      navigator.clipboard?.writeText(out.textContent).catch(() => {});
    });
  }

  const setMenu = () => {};   // the nav has no dropdown any more

  /* ── Drawer content ── */
  const icon = id => `<svg class="ico"><use href="#i-${id}"/></svg>`;
  const SOLUTIONS = {
    about: {
      eyebrow: "About Eleven Energy", icon: "bolt",
      title: "Powering up Africa",
      lede: "We develop accessible, affordable, reliable energy for every sector, from residential areas to commercial hubs and industrial centres. Our engineers bring decades of experience across renewable technology, project delivery and sustainability.",
      stats: [["6", "solution lines, one delivery team"], ["1", "audit before any design"], ["24/7", "remote monitoring after handover"]],
      list: ["Energy audits that log your real loads before we size anything", "Microgrid, storage and solar design in-house", "Installation, commissioning and staff training on site", "Monitoring and maintenance for the life of the system"],
      sites: ["Businesses", "Schools", "Clinics", "Communities", "Housing estates", "Industrial sites"],
      interest: "General enquiry"
    },
    microgrids: {
      eyebrow: "Solution 01", icon: "grid",
      title: "Renewable microgrid solutions",
      lede: "Custom microgrids that combine solar and wind with battery storage, giving communities and organisations power that doesn't depend on the national grid. Built for places where outages are routine, from rural villages to new urban developments.",
      stats: [["<20 ms", "switchover when the grid drops"], ["70–90%", "typical diesel reduction"], ["1 unit", "containerised, ships pre-wired"]],
      list: ["Solar arrays and, where the site allows, small wind", "Containerised lithium iron phosphate storage", "Grid-forming inverters that run the site islanded", "A controller that decides between solar, battery, grid and generator"],
      sites: ["Community centres", "Schools", "Clinics", "Residential areas", "Remote villages"],
      interest: "Renewable microgrid"
    },
    storage: {
      eyebrow: "Energy storage", icon: "battery",
      title: "Battery storage that covers the outage",
      lede: "Containerised battery systems that store solar through the day and carry your site through grid failures and evening peaks, so the generator becomes the last resort instead of the routine.",
      stats: [["250 kWh+", "per container"], ["6,000", "rated cycles, LFP cells"], ["15 yrs", "design life"]],
      list: ["Lithium iron phosphate cells, actively cooled", "Fire detection and suppression inside the unit", "Battery management with cell-level monitoring", "Pairs with existing solar or generators"],
      sites: ["Factories", "Cold storage", "Data rooms", "Hospitals", "Telecom sites"],
      interest: "Energy storage"
    },
    audits: {
      eyebrow: "Energy audits", icon: "clipboard",
      title: "Find out where your energy money goes",
      lede: "Every project starts here. An engineer logs your consumption, generator runtime and outage pattern for a week, then shows you which systems would pay back and how fast.",
      stats: [["7 days", "of load logging on site"], ["1 report", "with sizing and payback"], ["No", "obligation to build with us"]],
      list: ["Load and power-quality logging on your main boards", "Generator runtime and fuel spend review", "Roof, land and shading survey", "A sized system proposal with payback period"],
      sites: ["Any business", "Schools", "Estates", "Public buildings"],
      interest: "Energy audit"
    },
    home: {
      eyebrow: "Home solar", icon: "home",
      title: "Rooftop solar with battery backup",
      lede: "Right-sized rooftop systems for homes that want quiet nights without the generator. We size from your actual appliances, not a package off the shelf.",
      stats: [["5–15 kWp", "typical rooftop size"], ["10–30 kWh", "battery backup"], ["App", "to see what you're using"]],
      list: ["Tier-one panels and hybrid inverters", "Battery sized to your evening load", "Changeover that protects sensitive appliances", "Annual maintenance visits"],
      sites: ["Detached homes", "Duplexes", "Housing estates"],
      interest: "Home solar"
    },
    sme: {
      eyebrow: "SME energy", icon: "store",
      title: "Small business power without the diesel bill",
      lede: "Solar and storage packages for shops, pharmacies, workshops and small clinics, where every hour of downtime costs sales and every litre of diesel eats margin.",
      stats: [["3–50 kWp", "solar for small sites"], ["Same week", "install for standard systems"], ["Flexible", "payment plans available"]],
      list: ["Solar sized around your trading hours", "Storage for fridges, POS and lighting", "Generator integration for long outages", "Remote monitoring so faults are caught early"],
      sites: ["Shops", "Pharmacies", "Workshops", "Small clinics", "Restaurants"],
      interest: "SME energy"
    },
    ev: {
      eyebrow: "Solution 02", icon: "plug",
      title: "EV charging networks",
      lede: "Charging networks designed and deployed for residential complexes, commercial properties and public spaces, with Level 2 stations, fast chargers and smart network management in one system.",
      stats: [["7–22 kW", "Level 2 AC chargers"], ["60–150 kW", "DC fast chargers"], ["1 portal", "for access, billing and usage"]],
      list: ["Level 2 stations for overnight and workplace charging", "DC fast chargers for fleets and public bays", "Load management so chargers don't overload your supply", "Solar and storage pairing to charge from your own power"],
      sites: ["Residential complexes", "Office parks", "Malls", "Public car parks", "Fleet depots"],
      interest: "EV charging network"
    },
    commercial: {
      eyebrow: "Solution 03", icon: "building",
      title: "Commercial energy solutions",
      lede: "For businesses cutting their carbon footprint and energy costs at the same time: solar installations, energy-efficient lighting upgrades and smart building technology, planned together rather than piecemeal.",
      stats: [["30–60%", "lower lighting load after LED retrofit"], ["kWp to MWp", "rooftop and ground-mount solar"], ["1 dashboard", "for every site you run"]],
      list: ["Rooftop, carport and ground-mounted solar", "LED retrofits with occupancy and daylight controls", "Smart metering and building management integration", "Sustainability reporting for your board and lenders"],
      sites: ["Offices", "Warehouses", "Hotels", "Factories", "Retail chains"],
      interest: "Commercial energy"
    }
  };

  const drawer = $("#drawer"), scrim = $("#scrim");
  let lastFocus = null, currentInterest = "";

  function openDrawer(key) {
    const s = SOLUTIONS[key]; if (!s) return;
    closeSheet(); setMenu(false);
    $("#drawerEyebrow").textContent = s.eyebrow;
    $("#drawerBadge").innerHTML = icon(s.icon);
    $("#drawerTitle").textContent = s.title;
    $("#drawerLede").textContent = s.lede;
    $("#drawerStats").innerHTML = s.stats.map(([v, l]) => `<div class="stat"><b class="num">${v}</b><span>${l}</span></div>`).join("");
    $("#drawerList").innerHTML = s.list.map(t => `<li>${icon("check")}<span>${t}</span></li>`).join("");
    $("#drawerSites").innerHTML = s.sites.map(t => `<span>${t}</span>`).join("");
    $("#drawerCta span").textContent = key === "about" ? "Book an energy audit" : `Book an audit for ${s.title.split(" ").slice(0, 2).join(" ").toLowerCase()}`;
    currentInterest = s.interest;
    lastFocus = document.activeElement;
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-on"));
    drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false");
    $(".drawer-body", drawer).scrollTop = 0;
    setTimeout(() => $("[data-close]", drawer).focus(), 50);
  }
  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("is-on"); setTimeout(() => { scrim.hidden = true; }, 250);
    lastFocus?.focus?.();
  }
  $("#drawerCta").addEventListener("click", () => { closeDrawer(); openModal("audit", currentInterest); });
  scrim.addEventListener("click", closeDrawer);

  /* ── Contact modal: the sentence form, opened from any contact or audit button ── */
  const modal = $("#talkModal");
  const tform = modal && $(".talk-form", modal);
  function openModal(m = "contact", interest = "") {
    if (!modal) return;
    closeSheet(); closeDrawer();
    tform.talk.restart(m === "audit" ? "audit" : "project");
    const about = $(".tm-about", modal);
    about.hidden = !interest; $("b", about).textContent = interest; tform.elements.interest.value = interest;
    lastFocus = document.activeElement;
    modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    tform.talk.fit();
    setTimeout(() => tform.elements.name.focus({ preventScroll: true }), 120);
  }
  function closeModal() {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lastFocus?.focus?.();
  }
  modal?.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  /* ── Mobile sheet ── */
  const sheet = $("#sheet"), burger = $("#burger");
  function closeSheet() { if (!sheet.hidden) { sheet.hidden = true; burger.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; } }
  burger.addEventListener("click", () => { sheet.hidden = false; burger.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; });

  /* ── Wiring ── */
  document.addEventListener("click", e => {
    const d = e.target.closest("[data-open-drawer]");
    if (d) { e.preventDefault(); openDrawer(d.dataset.openDrawer); return; }
    const m = e.target.closest("[data-open-modal]");
    if (m) { e.preventDefault(); openModal(m.dataset.openModal, m.dataset.interest || ""); return; }
    const c = e.target.closest("[data-close]");
    if (c) {
      if (c.closest("#talkModal")) closeModal();
      else if (c.closest("#drawer")) closeDrawer();
      else closeSheet();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (modal?.classList.contains("is-open")) closeModal();
    else if (drawer.classList.contains("is-open")) closeDrawer();
    else closeSheet();
  });

  /* ── Tab nav: a soft lens follows the pointer across the links ── */
  const dock = $("#dock"), lens = $("#lens");
  const dockLinks = $$(".dock-link", dock);
  function moveLens(el) {
    if (!el || !dock.offsetWidth) return;
    const d = dock.getBoundingClientRect(), r = el.getBoundingClientRect();
    lens.style.left = (r.left - d.left) + "px";
    lens.style.top = (r.top - d.top) + "px";
    lens.style.width = r.width + "px";
    lens.style.height = r.height + "px";
    lens.classList.add("is-on");
  }
  function restLens() {
    const open = dock.querySelector('.dock-link[aria-expanded="true"]');
    if (open) moveLens(open); else lens.classList.remove("is-on");
  }
  dockLinks.forEach(l => { l.addEventListener("mouseenter", () => moveLens(l)); l.addEventListener("focus", () => moveLens(l)); });
  dock.addEventListener("mouseleave", restLens);
  window.addEventListener("resize", restLens);

  /* ── Nav: plain over the photo, a glass capsule once the page scrolls ── */
  const navEl = $("#nav");
  const onScroll = () => {
    navEl.classList.toggle("is-scrolled", window.scrollY > 24);
    const top = hero || $(".ph");
    navEl.classList.toggle("is-light", top ? top.getBoundingClientRect().bottom < 200 : true);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  navEl.addEventListener("transitionend", e => { if (e.target.id === "bar" && e.propertyName === "width") restLens(); });

  /* ── Text motion ── */
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // wrap every word of el's text in spans, leaving child elements (like the headline photo) where they are
  function splitWords(el, make) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else frag.appendChild(make(part, i++));
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("inline-art")) walk(n);
      });
    };
    walk(el);
    return i;
  }
  const masked = (word, i) => { const o = document.createElement("span"); o.className = "w"; o.innerHTML = `<span style="--i:${i}">${word}</span>`; return o; };
  if ($("#headline")) splitWords($("#headline"), masked);
  $$(".words").forEach(el => splitWords(el, masked));

  // the about statement lights up word by word as it scrolls through the screen
  const scrub = $(".scrub");
  let scrubWords = [];
  if (scrub) {
    splitWords(scrub, word => { const s = document.createElement("span"); s.className = "sw"; s.textContent = word; return s; });
    scrubWords = $$(".sw", scrub);
  }
  function runScrub() {
    if (!scrub) return;
    if (still) { scrubWords.forEach(s => s.classList.add("on")); return; }
    const r = scrub.getBoundingClientRect(), vh = window.innerHeight;
    const p = Math.max(0, Math.min(1, (vh * 0.86 - r.top) / (r.height + vh * 0.3)));
    const lit = Math.round(p * scrubWords.length);
    scrubWords.forEach((s, i) => s.classList.toggle("on", i < lit));
  }
  let scrubQueued = false;
  window.addEventListener("scroll", () => { if (!scrubQueued) { scrubQueued = true; requestAnimationFrame(() => { scrubQueued = false; runScrub(); }); } }, { passive: true });
  window.addEventListener("resize", runScrub);
  runScrub();

  // fade-ups and word rises fire once, when they come into view
  const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("inview"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -12% 0px" }) : null;
  $$(".rise, .words").forEach(el => io && !still ? io.observe(el) : el.classList.add("inview"));

  /* ── Solutions film strip: the arrows or a click on a closed slide open it;
        the strip can be dragged, and each photo drifts a little against the movement ── */
  const fsTrack = $(".fs-track");
  if (fsTrack) {
    const rail = $(".fs-rail", fsTrack);
    const slides = $$(".fs-slide", fsTrack), steps = $$(".fs-step", fsTrack.closest("section")), cursor = $(".fs-cursor", fsTrack);
    const phone = window.matchMedia("(max-width: 760px)");
    let cur = 0;

    const edge = () => parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const syncSteps = () => {
      steps[0].disabled = cur === 0;
      steps[1].disabled = cur === slides.length - 1;
    };
    function scrollToSlide(i, closedWidth) {
      // where the slide will sit once the open one has finished resizing: every slide before it is closed
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      let left = 0;
      if (phone.matches) left = slides[i].offsetLeft - edge();
      else left = i * (closedWidth + gap);
      fsTrack.scrollTo({ left: Math.max(0, left), behavior: still ? "auto" : "smooth" });
    }
    function show(i) {
      const next = Math.max(0, Math.min(slides.length - 1, i));
      const closed = slides.find((slide, index) => index !== cur && index !== next);
      const closedWidth = closed.getBoundingClientRect().width;
      cur = next;
      slides.forEach((s, k) => s.classList.toggle("is-active", k === cur));
      syncSteps();
      scrollToSlide(cur, closedWidth);
    }
    steps.forEach(b => b.addEventListener("click", () => show(cur + +b.dataset.step)));
    $$("[data-fs-open]", fsTrack).forEach(b => b.addEventListener("click", event => {
      const index = Number(b.dataset.fsOpen);
      show(index);
      if (event.detail === 0) {
        $(".fs-cta", slides[index]).focus({ preventScroll: true });
      }
    }));
    fsTrack.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); show(cur + d); }
    });

    // drag to scroll with the mouse; phones already swipe natively
    let down = null, moved = 0;
    fsTrack.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("a, button:not(.fs-open)")) return;
      down = { x: e.clientX, left: fsTrack.scrollLeft }; moved = 0;
    });
    window.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - down.x; moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) { fsTrack.classList.add("is-dragging"); fsTrack.scrollLeft = down.left - dx; }
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = null;
      if (fsTrack.classList.contains("is-dragging")) {
        // settle on the slide nearest the left edge
        const x = fsTrack.scrollLeft;
        let best = 0, bestD = Infinity;
        slides.forEach((s, k) => { const dd = Math.abs(s.offsetLeft - edge() - x); if (dd < bestD) { bestD = dd; best = k; } });
        requestAnimationFrame(() => fsTrack.classList.remove("is-dragging"));
        show(best);
      }
    });
    fsTrack.addEventListener("dragstart", e => e.preventDefault());
    fsTrack.addEventListener("click", e => { if (moved > 4) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);

    // the cursor bubble
    if (cursor && window.matchMedia("(hover: hover)").matches) {
      fsTrack.addEventListener("pointermove", e => {
        const r = fsTrack.getBoundingClientRect();
        cursor.style.setProperty("--cx", e.clientX - r.left + fsTrack.scrollLeft + "px");
        cursor.style.setProperty("--cy", e.clientY - r.top + "px");
        fsTrack.classList.add("show-cursor");
        fsTrack.classList.toggle("over-button", !!e.target.closest("a, button:not(.fs-open)"));
      });
      fsTrack.addEventListener("pointerleave", () => fsTrack.classList.remove("show-cursor"));
    }

    // photos drift against the strip's movement
    let pxQueued = false;
    function drift() {
      pxQueued = false;
      const vw = window.innerWidth;
      slides.forEach(s => {
        const r = s.getBoundingClientRect();
        const off = (r.left + r.width / 2 - vw / 2) / vw;
        $("img", s).style.setProperty("--px", (Math.max(-1, Math.min(1, off)) * -36).toFixed(1) + "px");
      });
    }
    if (!still) {
      fsTrack.addEventListener("scroll", () => { if (!pxQueued) { pxQueued = true; requestAnimationFrame(drift); } }, { passive: true });
      drift();
    }
    // phones: whichever slide is snapped becomes the current one
    fsTrack.addEventListener("scroll", () => {
      if (!phone.matches) return;
      const x = fsTrack.scrollLeft;
      let best = 0, bestD = Infinity;
      slides.forEach((s, k) => { const dd = Math.abs(s.offsetLeft - edge() - x); if (dd < bestD) { bestD = dd; best = k; } });
      if (best !== cur) {
        cur = best;
        slides.forEach((s, k) => s.classList.toggle("is-active", k === cur));
        syncSteps();
      }
    }, { passive: true });

    syncSteps();
  }

  /* ── Get in touch: a form written as a sentence; the topic rewrites the middle of it ── */
  const esc = s => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const v = el => esc(el.value.trim());
  const TOPICS = {
    project: { team: "Goes to an engineer", who: "An engineer, not a sales rep. They’ll reply within one working day.", btn: "Send to an engineer",
      done: (n, how, f) => `Thanks, <b>${n}</b>. An engineer will ${how} within one working day to talk about your ${esc(f.p_site.value)} in <b>${v(f.p_loc)}</b>.` },
    audit: { team: "Goes to our audit team", who: "We’ll call to agree a date, then an engineer logs your site for seven days.", btn: "Request an audit",
      done: (n, how, f) => `Thanks, <b>${n}</b>. Our audit team will ${how} within two working days to book a visit to your ${esc(f.a_site.value)} in <b>${v(f.a_loc)}</b>.` },
    support: { team: "Goes to the support desk", who: "Our support desk answers within four hours, 7am to 9pm, every day. If the site is down, call us instead.", btn: "Report the problem",
      done: (n, how, f) => `Thanks, <b>${n}</b>. Support has logged the fault at <b>${v(f.s_site)}</b> and will ${how} within four hours.` },
    partner: { team: "Goes to our partnerships lead", who: "Developers, NGOs, financiers and installers. Expect a reply within three working days.", btn: "Send to partnerships",
      done: (n, how, f) => `Thanks, <b>${n}</b>. Our partnerships lead will ${how} within three working days about working with <b>${v(f.r_org)}</b>.` },
    press: { team: "Goes to our press team", who: "Interviews, site visits and photos. We’ll work to your deadline.", btn: "Send to our press team",
      done: (n, how, f) => `Thanks, <b>${n}</b>. Our press team will ${how}${f.m_when.value.trim() ? ` before <b>${v(f.m_when)}</b>` : " within one working day"}.` },
    other: { team: "Goes to our Lagos office", who: "Someone who can actually answer will reply within one working day.", btn: "Send message",
      done: (n, how) => `Thanks, <b>${n}</b>. We’ll ${how} within one working day.` }
  };
  // each blank is as wide as its words: the placeholder at first, then whatever is typed
  const ruler = document.createElement("canvas").getContext("2d");
  const textWidth = (el, s) => {
    const cs = getComputedStyle(el);
    ruler.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ("letterSpacing" in ruler) ruler.letterSpacing = cs.letterSpacing;
    return ruler.measureText(s).width;
  };
  function initTalk(form) {
    const host = form.closest(".talk-host"), f = form.elements;
    const parts = $$(".talk-part", form), err = $(".talk-err", form), done = $(".talk-done", form);
    const typed = '.blank input:not([type="hidden"])';
    let topic = "project";
    const fit = el => { el.style.width = Math.ceil(textWidth(el, el.value || el.placeholder) + 4) + "px"; };
    const fitAll = () => $$(typed, form).forEach(el => { if (!el.closest("[hidden]")) fit(el); });
    $$(typed, form).forEach(el => el.addEventListener("input", () => fit(el)));
    (document.fonts?.ready || Promise.resolve()).then(fitAll);
    window.addEventListener("resize", fitAll);

    function setTopic(t) {
      topic = t; const T = TOPICS[t];
      parts.forEach(p => {
        const on = p.dataset.topic === t;
        p.hidden = !on; p.classList.toggle("is-in", on && !still);
        $$("input, button", p).forEach(el => (el.disabled = !on));
      });
      $$(".blank.is-error", form).forEach(b => b.classList.remove("is-error"));
      err.hidden = true;
      $(".talk-submit", form).textContent = T.btn;
      $$(".talk-who-team", host).forEach(e => (e.textContent = T.team));
      $$(".talk-who-text", host).forEach(e => (e.textContent = T.who));
      $$(".talk-who, .tm-who", host).forEach(w => { w.classList.remove("is-swapping"); void w.offsetWidth; w.classList.add("is-swapping"); });
      fitAll();
    }
    function restart(t = topic) {
      const interest = f.interest.value;
      form.reset(); f.interest.value = interest;
      $$("[data-pick]", form).forEach(p => p.resetPick());
      $(`input[name="topic"][value="${t}"]`, form).checked = true;
      form.classList.remove("is-sent"); done.hidden = true;
      setTopic(t);
    }
    $$('input[name="topic"]', form).forEach(r => r.addEventListener("change", () => setTopic(r.value)));
    form.addEventListener("submit", e => {
      e.preventDefault();
      let first = null;
      $$("[data-req]", form).forEach(el => {
        if (el.disabled) return;
        const bad = !el.value.trim();
        el.closest(".blank").classList.toggle("is-error", bad);
        if (bad && !first) first = el;
      });
      err.hidden = !first;
      if (first) { first.focus(); return; }
      const name = esc(f.name.value.trim().split(/\s+/)[0]);
      const reach = f.reach.value.trim();
      const how = `${reach.includes("@") ? "email you at" : "call you on"} <b>${esc(reach)}</b>`;
      $(".talk-done-text", form).innerHTML = TOPICS[topic].done(name, how, f);
      form.classList.add("is-sent"); done.hidden = false;
      $(".talk-again", form).focus();
    });
    form.addEventListener("input", e => {
      e.target.closest(".blank")?.classList.remove("is-error");
      if (!$(".blank.is-error", form)) err.hidden = true;
    });
    $(".talk-again", form).addEventListener("click", () => { restart(topic); f.name.focus(); });
    form.talk = { restart, fit: fitAll };
    setTopic("project");
  }

  /* ── Custom picker: a listbox that sits inside a sentence ── */
  $$("[data-pick]").forEach(pk => {
    const btn = $(".pick-btn", pk), list = $(".pick-list", pk), input = $('input[type="hidden"]', pk), val = $(".pick-val", pk);
    const opts = $$(".pick-opt", pk), label = list.getAttribute("aria-label");
    let active = 0;
    const setActive = i => {
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle("is-active", k === active));
      list.setAttribute("aria-activedescendant", opts[active].id);
      opts[active].scrollIntoView({ block: "nearest" });
    };
    const close = focusBtn => {
      if (list.hidden) return;
      list.hidden = true; pk.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false");
      if (focusBtn) btn.focus();
    };
    const open = () => {
      $$("[data-pick].is-open").forEach(o => o !== pk && o.closePick());
      list.hidden = false; pk.classList.add("is-open"); btn.setAttribute("aria-expanded", "true");
      list.style.left = ""; list.classList.remove("is-up");
      const r = list.getBoundingClientRect(), room = window.innerWidth - 12;
      if (r.right > room) list.style.left = Math.round(room - r.right - 6) + "px";
      if (r.bottom > window.innerHeight - 12 && btn.getBoundingClientRect().top > r.height + 24) list.classList.add("is-up");
      setActive(Math.max(0, opts.findIndex(o => o.getAttribute("aria-selected") === "true")));
      list.focus({ preventScroll: true });
    };
    const choose = (i, focus = true) => {
      opts.forEach((o, k) => o.setAttribute("aria-selected", String(k === i)));
      input.value = val.textContent = opts[i].dataset.value;
      btn.setAttribute("aria-label", `${label}: ${opts[i].dataset.value}`);
      close(focus);
    };
    pk.closePick = () => close(false);
    pk.resetPick = () => choose(0, false);
    btn.addEventListener("click", () => (list.hidden ? open() : close(true)));
    btn.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
    list.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); setActive(0); }
      else if (e.key === "End") { e.preventDefault(); setActive(opts.length - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === "Tab") close(false);
      else if (/^\w$/.test(e.key)) { const k = opts.findIndex((o, n) => n > active && o.dataset.value.startsWith(e.key.toLowerCase())); const f = k >= 0 ? k : opts.findIndex(o => o.dataset.value.startsWith(e.key.toLowerCase())); if (f >= 0) setActive(f); }
    });
    opts.forEach((o, k) => {
      o.addEventListener("click", () => choose(k));
      o.addEventListener("mousemove", () => { if (active !== k) setActive(k); });
    });
    document.addEventListener("pointerdown", e => { if (!pk.contains(e.target)) close(false); });
  });

  $$(".talk-form").forEach(initTalk);

  /* ── About: values light up as they reach the middle of the screen ── */
  const vals = $$(".val");
  if (vals.length) {
    if (still || !("IntersectionObserver" in window)) vals.forEach(v => v.classList.add("is-on"));
    else {
      const vio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-on"); vio.unobserve(e.target); } }), { rootMargin: "-30% 0px -40% 0px" });
      vals.forEach(v => vio.observe(v));
    }
  }

  /* ── Solutions: the index follows the section you're reading ── */
  const spies = $$("[data-spy]");
  if (spies.length && "IntersectionObserver" in window) {
    const sio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      spies.forEach(s => s.classList.toggle("is-on", s.dataset.spy === e.target.id));
      const on = spies.find(s => s.dataset.spy === e.target.id), bar = on?.parentElement;
      if (on && bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2, behavior: still ? "auto" : "smooth" });
    }), { rootMargin: "-40% 0px -55% 0px" });
    $$(".svc").forEach(s => sio.observe(s));
    spies[0].classList.add("is-on");
  }

  /* ── Tiles: figures count up once, renders drift a little against the scroll ── */
  const counters = $$(".tile-fig");
  function countUp(fig) {
    const nums = $$(".cu", fig), t0 = performance.now(), dur = 1300;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      nums.forEach(n => { n.textContent = Math.round(+n.dataset.to * e); });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && !still) {
    const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }), { rootMargin: "0px 0px -15% 0px" });
    counters.forEach(f => { $$(".cu", f).forEach(n => { n.textContent = "0"; }); cio.observe(f); });
  }
  const arts = $$(".tile-art");
  let driftQueued = false;
  function drift() {
    driftQueued = false;
    const vh = window.innerHeight;
    arts.forEach(a => {
      const r = a.parentElement.getBoundingClientRect();
      const off = (r.top + r.height / 2 - vh / 2) / vh;      // -1 … 1 across the screen
      a.style.setProperty("--py", (Math.max(-1, Math.min(1, off)) * -14).toFixed(1) + "px");
    });
  }
  if (!still && arts.length) {
    window.addEventListener("scroll", () => { if (!driftQueued) { driftQueued = true; requestAnimationFrame(drift); } }, { passive: true });
    drift();
  }


  /* ── Entrance ── */
  const copyrightYear = $("#copyrightYear");
  if (copyrightYear) copyrightYear.textContent = new Date().getFullYear();
  const start = () => { document.body.classList.add("is-loaded"); layoutNodes(); restLens(); };
  (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(start));
})();
