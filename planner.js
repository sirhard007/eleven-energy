(() => {
  const appliances = {
    led: { name: "LED bulb", category: "Lighting", watts: 12, hours: 6, duty: 100 },
    fan: { name: "Fan", category: "Cooling", watts: 60, hours: 8, duty: 100 },
    fridge: { name: "Refrigerator", category: "Refrigeration", watts: 150, hours: 24, duty: 35 },
    freezer: { name: "Chest freezer", category: "Refrigeration", watts: 200, hours: 24, duty: 45 },
    ac: { name: "Air conditioner", category: "Cooling", watts: 1000, hours: 8, duty: 65 },
    tv: { name: "Television", category: "Electronics", watts: 90, hours: 4, duty: 100 },
    laptop: { name: "Laptop", category: "Electronics", watts: 65, hours: 8, duty: 100 },
    router: { name: "Wi-Fi router", category: "Electronics", watts: 12, hours: 24, duty: 100 },
    pump: { name: "Water pump", category: "Motors", watts: 750, hours: 1, duty: 100 },
    washer: { name: "Washing machine", category: "Laundry", watts: 550, hours: 1, duty: 100 },
    custom: { name: "Other appliance", category: "Other", watts: 0, hours: 1, duty: 100 },
  };
  const moduleArea = { 400: 2, 550: 2.6, 650: 3.1 };
  const $ = id => document.getElementById(id);
  const list = $("planner-appliances");
  const assumptions = $("planner-assumptions");
  const property = $("space-type");
  const backupPresets = [...assumptions.querySelectorAll("[data-backup-hours]")];
  const feedback = $("planner-feedback");
  const catalogSelect = $("catalog-appliance");
  const storageKey = "eleven-energy-planner-v1";
  const format = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
  const catalog = Object.entries(appliances);
  const categories = new Set(catalog.map(([, item]) => item.category));
  const applianceOptions = [...categories].map(category => {
    const options = catalog.filter(([, item]) => item.category === category)
      .map(([id, item]) => `<option value="${id}">${item.name}</option>`).join("");
    return `<optgroup label="${category}">${options}</optgroup>`;
  }).join("");
  catalogSelect.innerHTML = '<option value="">Browse all appliances</option>' + applianceOptions;

  function number(field) {
    const value = Number(field.value);
    return Math.max(Number(field.min || 0), Math.min(Number(field.max || Infinity), value));
  }

  const tabs = [...document.querySelectorAll(".energy-tabs [role=tab]:not([hidden])")];
  const panels = tabs.map(tab => $(tab.getAttribute("aria-controls")));

  function selectTool(index, navigate = false) {
    tabs.forEach((tab, position) => {
      const active = position === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[position].hidden = !active;
    });
    if (navigate) {
      const hash = `#${panels[index].id}`;
      if (location.hash !== hash) history.pushState(null, "", hash);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTool(index, true));
    tab.addEventListener("keydown", event => {
      const positions = {
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        ArrowRight: (index + 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      const next = positions[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectTool(next, true);
      tabs[next].focus();
    });
  });

  function restoreTool() {
    const index = panels.findIndex(panel => `#${panel.id}` === location.hash);
    if (index < 0 && location.hash === "#roof-explorer") history.replaceState(null, "", "#planner");
    selectTool(Math.max(0, index));
  }

  window.addEventListener("hashchange", restoreTool);
  restoreTool();

  function readRow(row) {
    const get = name => row.querySelector(`[name="${name}"]`);
    return {
      type: get("type").value,
      watts: number(get("watts")),
      quantity: number(get("quantity")),
      hours: number(get("hours")),
      duty: number(get("duty")),
      backup: get("backup").checked,
    };
  }

  function update() {
    const rows = [...list.children];
    const data = rows.map(readRow);
    const fields = Object.fromEntries([...assumptions.querySelectorAll("input, select")].map(field => [field.name, number(field)]));
    let daily = 0, connected = 0, backup = 0;
    data.forEach((item, index) => {
      const rated = item.watts * item.quantity / 1000;
      const average = rated * item.duty / 100;
      const energy = average * item.hours;
      daily += energy;
      connected += rated;
      if (item.backup) backup += average * Math.min(fields.backup, item.hours);
      rows[index].querySelector("output").textContent = format.format(energy);
    });

    const panels = Math.ceil(daily / (fields.sun * fields.solar / 100) * 1000 / fields.module);
    const inverter = Math.ceil(connected * fields.simultaneous / 100 * 10) / 10;
    const battery = Math.ceil(backup / (fields.usable / 100) * 10) / 10;
    const dailyTotal = format.format(daily);
    if ($("planner-live-total").textContent !== dailyTotal) $("planner-live-total").textContent = dailyTotal;
    $("result-solar").textContent = `${format.format(panels * fields.module / 1000)} kWp`;
    $("result-panels").textContent = `${format.format(panels)} × ${fields.module} W`;
    $("result-inverter").textContent = `${format.format(inverter)} kW`;
    $("result-battery").textContent = `${format.format(battery)} kWh`;
    $("result-monthly").textContent = `${format.format(daily * 30)} kWh`;
    $("result-area").textContent = `${format.format(panels * moduleArea[fields.module])} m²`;
    $("result-note").textContent = rows.length
      ? `${format.format(connected)} kW connected load · ${format.format(data.reduce((count, item) => count + (item.backup ? item.quantity : 0), 0))} appliances on backup`
      : "Add appliances to build your plan.";
    $("clear-appliances").hidden = !rows.length;
    $("planner-empty").hidden = Boolean(rows.length);
    $("planner-count").textContent = rows.length ? format.format(data.reduce((count, item) => count + item.quantity, 0)) : "";
    backupPresets.forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.backupHours) === fields.backup)));
    try { localStorage.setItem(storageKey, JSON.stringify({ data, fields })); } catch {}
  }

  function addRow(type, settings = {}) {
    const item = { ...appliances[type], quantity: 1, backup: true, ...settings };
    const row = document.createElement("div");
    row.className = "planner-appliance";
    row.innerHTML = `
      <label class="planner-type">Appliance<select name="type">${applianceOptions}</select></label>
      <label>Quantity<input name="quantity" type="number" min="0" max="10000" step="1"></label>
      <label>Hours / day<input name="hours" type="number" min="0" max="24" step="any"></label>
      <div class="planner-row-footer">
        <label class="planner-backup">
          <input class="visually-hidden" name="backup" type="checkbox">
          <span class="planner-check" aria-hidden="true"></span>
          Keep on during an outage
        </label>
        <span class="planner-row-total"><output aria-label="Appliance daily energy use">0</output> kWh/day</span>
        <button class="planner-remove" type="button" aria-label="Remove appliance">×</button>
      </div>
      <details class="planner-row-settings">
        <summary>Power rating and duty cycle</summary>
        <div class="planner-fields">
          <label>Power (W)<input name="watts" type="number" min="0" max="1000000" step="any"></label>
          <label>Duty cycle (%)<input name="duty" type="number" min="0" max="100" step="any"></label>
        </div>
        <p class="planner-help">Use the appliance’s rated watts. For appliances that cycle on and off, duty cycle is the percentage of run time spent drawing that power.</p>
      </details>`;
    for (const name of ["watts", "quantity", "hours", "duty"]) row.querySelector(`[name="${name}"]`).value = item[name];
    row.querySelector("[name=type]").value = type;
    row.querySelector("[name=backup]").checked = item.backup;
    if (type === "custom") row.querySelector("details").open = true;
    list.append(row);
    return row;
  }

  function useTemplate() {
    const home = property.querySelector(":checked").value === "home";
    const size = Number($("space-size").value);
    const propertyType = $("property-type").value;
    const standard = $("space-profile").value === "standard";
    const template = home
      ? [["led", size * 3 + 2], ["fan", size], ["fridge", 1], ["tv", 1], ["router", 1]]
      : [["led", size * 6], ["laptop", size * 3], ["router", 1], ["ac", size]];
    if (home && standard) template.push(["ac", Math.max(1, size - 1)]);
    if (propertyType === "house") template.push(["pump", 1]);
    if (propertyType === "shop") template.push(["freezer", 1]);
    if (list.children.length && !window.confirm("Replace your current appliance list with this starter list?")) return;
    list.replaceChildren();
    for (const [type, quantity] of template) {
      const watts = standard ? Math.round(appliances[type].watts * 1.25) : appliances[type].watts;
      addRow(type, { quantity, watts });
    }
    feedback.textContent = "Starter list loaded.";
    update();
    $("appliances-title").focus();
  }

  property.addEventListener("change", event => {
    const home = event.target.value === "home";
    $("size-label").textContent = home ? "Bedrooms" : "Team size";
    const labels = home ? ["1 bedroom", "2 bedrooms", "3 bedrooms", "4 or more bedrooms"] : ["1–3 people", "4–6 people", "7–9 people", "10–12 people"];
    $("space-size").replaceChildren(...labels.map((label, index) => new Option(label, index + 1)));
    const properties = home ? [["Flat", "flat"], ["House", "house"]] : [["Office", "office"], ["Shop", "shop"]];
    $("property-type").replaceChildren(...properties.map(([label, value]) => new Option(label, value)));
  });
  $("use-template").addEventListener("click", useTemplate);

  function addFromCatalog(type, edit) {
    const row = addRow(type);
    feedback.textContent = `${appliances[type].name} added.`;
    update();
    if (edit) row.querySelector(type === "custom" ? "[name=watts]" : "[name=quantity]").focus();
  }

  document.querySelectorAll("[data-add-appliance]").forEach(button => {
    button.addEventListener("click", () => addFromCatalog(button.dataset.addAppliance));
  });
  $("add-appliance").disabled = true;
  catalogSelect.addEventListener("change", () => { $("add-appliance").disabled = !catalogSelect.value; });
  $("add-appliance").addEventListener("click", () => {
    if (catalogSelect.value) addFromCatalog(catalogSelect.value, true);
  });
  $("clear-appliances").addEventListener("click", () => {
    list.replaceChildren();
    feedback.textContent = "Appliance list cleared.";
    catalogSelect.focus();
    update();
  });
  list.addEventListener("click", event => {
    const remove = event.target.closest(".planner-remove");
    if (!remove) return;
    const row = remove.closest(".planner-appliance");
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    (next?.querySelector(".planner-remove") || catalogSelect).focus();
    update();
  });
  list.addEventListener("input", event => {
    if (event.target.name === "type") {
      const defaults = appliances[event.target.value];
      const row = event.target.closest(".planner-appliance");
      for (const field of ["watts", "hours", "duty"]) {
        row.querySelector(`[name="${field}"]`).value = defaults[field];
      }
      if (event.target.value === "custom") row.querySelector("details").open = true;
    }
    update();
  });
  assumptions.addEventListener("input", update);
  backupPresets.forEach(button => button.addEventListener("click", () => {
    assumptions.querySelector("[name=backup]").value = button.dataset.backupHours;
    update();
  }));
  $("print-blueprint").addEventListener("click", () => window.print());

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.data)) {
      for (const item of saved.data) if (Object.hasOwn(appliances, item.type)) addRow(item.type, item);
      for (const field of assumptions.querySelectorAll("input, select")) {
        if (Number.isFinite(saved.fields?.[field.name])) field.value = saved.fields[field.name];
      }
      if (list.children.length) $("planner-feedback").textContent = "Your saved appliance list was restored.";
    }
  } catch {}
  update();
})();
