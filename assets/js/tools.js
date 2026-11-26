/* buzzoffapp.com tools: the page glue for /tools/*. Loaded as a module on the
   tool pages only; the maths lives in caffeine-model.js.

   Privacy: everything runs in the browser. Nothing a visitor types is stored
   (no cookies, localStorage or sessionStorage), sent (no fetch, no GA event),
   put in the URL (no <form>; only the radio group has a name, which nothing
   submits) or logged to the console.

   Units style: a number, a non-breaking space ( ), then the unit. */
import {
  DRINKS,
  HALF_LIFE,
  caffeineCurve,
  caffeineInBodyMg,
  mgToApproxCups,
  planRoadmap,
} from "./caffeine-model.js";

const NBSP = " ";
const MAX_MG = 5000;
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MIN = 24 * 60;
const SVG_NS = "http://www.w3.org/2000/svg";
const whole = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/* ---------- Formatting ---------- */

/** Whole mg; anything above 0 and under 1 reads "less than 1 mg". */
export function formatMg(mg) {
  if (!(mg > 0)) return `0${NBSP}mg`;
  if (mg < 1) return `less than 1${NBSP}mg`;
  return `${whole.format(Math.round(mg))}${NBSP}mg`;
}

/** Units style: "200 ml" -> "200\u00A0ml", "fl oz" -> "fl\u00A0oz". */
function nbspUnits(text) {
  return text.replace(/(\d) (?=[a-z])/g, `$1${NBSP}`).replace(/fl oz/g, `fl${NBSP}oz`);
}

function formatHours(h) {
  return `${h}${NBSP}${h === 1 ? "hour" : "hours"}`;
}

/** Clock time for a minute count from the anchor day's midnight. */
function formatClock(minutes) {
  const m = ((Math.round(minutes) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60));
  const t = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(d)
    .replace(/\s/g, NBSP);
  const day = Math.floor(minutes / DAY_MIN);
  if (day === 1) return `${t} (next day)`;
  if (day > 1) return `${t} (${day} days later)`;
  return t;
}

/** Parse a number input; empty or invalid gives NaN, then clamp to [0, max]. */
function readNumber(input, max = MAX_MG) {
  const raw = input.value.trim();
  if (raw === "") return NaN;
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return Math.min(Math.max(n, 0), max);
}

function readClock(input) {
  const m = /^(\d{1,2}):(\d{2})/.exec(input.value || "");
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) node.append(c);
  return node;
}

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/* ---------- Drink picker (shared) ----------
   <div data-drinks data-extra="count|time"></div> + <button data-add-drink>.
   Each row: drink, mg each (prefilled, editable), and how many or what time. */

function drinkPicker(root, { extra, onChange, firstRow }) {
  const list = root.querySelector("[data-drink-list]");
  const addBtn = root.querySelector("[data-add-drink]");

  function optionLabel(d) {
    return nbspUnits(`${d.label}, ${d.serving}`);
  }

  function addRow(preset = {}) {
    const index = list.children.length + 1;
    const ids = { drink: nextId("drink"), mg: nextId("mg"), extra: nextId(extra) };
    const select = el("select", { id: ids.drink });
    for (const d of DRINKS) select.append(el("option", { value: d.id, text: optionLabel(d) }));
    select.append(el("option", { value: "other", text: "Other (enter the mg)" }));
    select.value = preset.drink || DRINKS[0].id;

    const mg = el("input", {
      id: ids.mg,
      type: "number",
      inputmode: "decimal",
      min: "0",
      max: String(MAX_MG),
      step: "any",
      autocomplete: "off",
    });
    const setMg = () => {
      const d = DRINKS.find((x) => x.id === select.value);
      mg.value = d ? String(d.mg) : "";
    };
    setMg();

    let extraInput;
    if (extra === "time") {
      extraInput = el("input", { id: ids.extra, type: "time", value: preset.time || "08:00", autocomplete: "off" });
    } else {
      extraInput = el("input", {
        id: ids.extra,
        type: "number",
        inputmode: "decimal",
        min: "0",
        max: "50",
        step: "any",
        value: preset.count ?? "1",
        autocomplete: "off",
      });
    }

    const label = `Drink ${index}`;
    const remove = el("button", {
      type: "button",
      class: "drink-row__remove",
      "aria-label": `Remove drink ${index}`,
      text: "Remove",
    });
    const row = el("div", { class: "drink-row", role: "group", "aria-label": label }, [
      el("div", { class: "field field--drink" }, [el("label", { for: ids.drink, text: label }), select]),
      el("div", { class: "field field--mg" }, [el("label", { for: ids.mg, text: "mg each" }), mg]),
      el("div", { class: "field field--extra" }, [
        el("label", { for: ids.extra, text: extra === "time" ? "Time" : "How many" }),
        extraInput,
      ]),
      remove,
    ]);
    select.addEventListener("change", () => {
      setMg();
      onChange();
    });
    for (const input of [mg, extraInput]) input.addEventListener("input", onChange);
    remove.addEventListener("click", () => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      relabel();
      onChange();
      (next ? next.querySelector("select") : addBtn).focus();
    });
    list.append(row);
    relabel();
    return row;
  }

  function relabel() {
    [...list.children].forEach((row, i) => {
      const n = i + 1;
      row.setAttribute("aria-label", `Drink ${n}`);
      row.querySelector(".field--drink label").textContent = `Drink ${n}`;
      const btn = row.querySelector(".drink-row__remove");
      btn.setAttribute("aria-label", `Remove drink ${n}`);
      btn.hidden = list.children.length === 1;
    });
  }

  addBtn.addEventListener("click", () => {
    const last = list.lastElementChild;
    let time;
    if (extra === "time" && last) {
      const prev = readClock(last.querySelector(".field--extra input"));
      if (Number.isFinite(prev)) {
        const m = Math.min(prev + 180, DAY_MIN - 1);
        time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      }
    }
    const row = addRow({ time });
    onChange();
    row.querySelector("select").focus();
  });

  addRow(firstRow);

  /** Rows with a usable mg (and count or time). */
  return function read() {
    return [...list.children]
      .map((row) => {
        const mg = readNumber(row.querySelector(".field--mg input"));
        const extraInput = row.querySelector(".field--extra input");
        const value = extra === "time" ? readClock(extraInput) : readNumber(extraInput, 50);
        return { mg, [extra]: value };
      })
      .filter((r) => r.mg > 0 && Number.isFinite(r[extra]));
  };
}

/* ---------- 1. Caffeine calculator ---------- */

function calculator(root) {
  const out = root.querySelector("[data-out=total]");
  const detail = root.querySelector("[data-out=detail]");
  const read = drinkPicker(root, { extra: "count", onChange: update, firstRow: { count: "1" } });
  function update() {
    const rows = read();
    const total = Math.min(rows.reduce((s, r) => s + r.mg * r.count, 0), MAX_MG * 50);
    out.textContent = `About ${formatMg(total)} today`;
    const n = rows.reduce((s, r) => s + r.count, 0);
    if (n > 0) {
      // Name and link the section with the figures: a positional "table" reference read as the drink rows.
      const link = document.createElement("a");
      link.href = "#how-it-works";
      link.textContent = "How this is worked out";
      detail.replaceChildren(
        `From ${count.format(n)} ${n === 1 ? "drink" : "drinks"}, using the figures in `,
        link,
        ", or the mg you entered."
      );
    } else {
      detail.textContent = "Add a drink to see your total.";
    }
  }
  update();
}

/* ---------- 2. When will my caffeine wear off? ---------- */

const HALF_LIVES = [
  { key: "mean", h: HALF_LIFE.meanH, name: "Average", cls: "line--mean" },
  { key: "min", h: HALF_LIFE.minH, name: "Fastest in the research range", cls: "line--min" },
  { key: "max", h: HALF_LIFE.maxH, name: "Slowest in the research range", cls: "line--max" },
];

function wearOff(root) {
  const bedInput = root.querySelector("[data-in=bedtime]");
  const hlSelect = root.querySelector("[data-in=half-life]");
  const summary = root.querySelector("[data-out=summary]");
  const halves = root.querySelector("[data-out=halves]");
  const chartBox = root.querySelector("[data-out=chart]");
  const tableBody = root.querySelector("[data-out=table]");
  const read = drinkPicker(root, { extra: "time", onChange: update, firstRow: { time: "08:00" } });
  bedInput.addEventListener("input", update);
  hlSelect.addEventListener("change", update);
  let last = null;

  function update() {
    const rows = read();
    const bedClock = readClock(bedInput);
    const chosen = HALF_LIVES.find((x) => x.key === hlSelect.value) || HALF_LIVES[0];
    if (!rows.length) {
      summary.textContent = "Add a drink with its time to see your estimate.";
      halves.textContent = "";
      tableBody.replaceChildren();
      chartBox.replaceChildren();
      last = null;
      return;
    }
    // The day starts at the earliest drink; a bedtime at or before it is the next day.
    const anchor = Math.min(...rows.map((r) => r.time));
    const doses = rows.map((r) => ({ mg: r.mg, takenAt: r.time * MIN_MS }));
    let bed = Number.isFinite(bedClock) ? bedClock : NaN;
    if (Number.isFinite(bed) && bed <= anchor) bed += DAY_MIN;

    const opts = { halfLifeH: chosen.h };
    // Peak, then when it falls to (and stays under) a half and a quarter of it.
    const start = anchor * MIN_MS;
    const samples = [];
    for (let t = start; t <= start + 72 * HOUR_MS; t += MIN_MS) {
      samples.push({ t, mg: caffeineInBodyMg(doses, t, opts) });
    }
    const peak = samples.reduce((a, b) => (b.mg > a.mg ? b : a));
    const fallsTo = (level) => {
      let i = samples.length - 1;
      while (i >= 0 && samples[i].mg <= level) i--;
      return i >= 0 && i < samples.length - 1 ? samples[i + 1].t : null;
    };
    const half = fallsTo(peak.mg / 2);
    const quarter = fallsTo(peak.mg / 4);

    if (Number.isFinite(bed)) {
      const atBed = caffeineInBodyMg(doses, bed * MIN_MS, opts);
      summary.textContent = `About ${formatMg(atBed)} may still be in your body at your ${formatClock(bed)} bedtime, using a half-life of ${formatHours(chosen.h)} (${chosen.name.toLowerCase()}).`;
    } else {
      summary.textContent = `Add your bedtime to see how much may be left then.`;
    }
    const peakText = `It peaks at about ${formatMg(peak.mg)} around ${formatClock(peak.t / MIN_MS)}`;
    const halfText = half ? `falls to half that by about ${formatClock(half / MIN_MS)}` : null;
    const quarterText = quarter ? `and to a quarter by about ${formatClock(quarter / MIN_MS)}` : null;
    halves.textContent = [peakText, halfText, quarterText].filter(Boolean).join(", ") + ".";

    tableBody.replaceChildren(
      ...HALF_LIVES.map((x) => {
        const v = Number.isFinite(bed) ? formatMg(caffeineInBodyMg(doses, bed * MIN_MS, { halfLifeH: x.h })) : "–";
        return el("tr", {}, [
          el("th", { scope: "row", text: `${x.name} (${formatHours(x.h)})` }),
          el("td", { class: "num", text: v }),
        ]);
      })
    );
    last = { doses, anchor, bed, chosen };
    drawChart();
  }

  function drawChart() {
    if (!last) return;
    const { doses, anchor, bed, chosen } = last;
    const width = Math.max(280, Math.round(chartBox.clientWidth || 640));
    const height = width < 480 ? 220 : 280;
    const pad = { l: 44, r: 12, t: 28, b: 32 };
    const from = Math.floor(anchor / 60) * 60; // round down to the hour
    const to = from + DAY_MIN;
    const curves = HALF_LIVES.map((x) => ({
      ...x,
      pts: caffeineCurve(doses, from * MIN_MS, to * MIN_MS, 5, { halfLifeH: x.h }),
    }));
    const maxMg = Math.max(1, ...curves.flatMap((c) => c.pts.map((p) => p.mg)));
    const yStep = niceStep(maxMg / 4);
    const yMax = Math.ceil(maxMg / yStep) * yStep;
    const x = (min) => pad.l + ((min - from) / (to - from)) * (width - pad.l - pad.r);
    const y = (mg) => pad.t + (1 - mg / yMax) * (height - pad.t - pad.b);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      `Estimated caffeine in your body over 24${NBSP}hours from ${formatClock(from)}, for half-lives of ${HALF_LIVES.map((h) => formatHours(h.h)).join(", ")}. The table “Caffeine that may be left at bedtime” gives the bedtime figures.`
    );
    const add = (tag, attrs, text) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text != null) n.textContent = text;
      svg.append(n);
      return n;
    };
    for (let v = 0; v <= yMax + 1e-9; v += yStep) {
      add("line", { x1: pad.l, x2: width - pad.r, y1: y(v), y2: y(v), class: "grid" });
      add("text", { x: pad.l - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" }, `${whole.format(v)}`);
    }
    add("text", { x: pad.l - 6, y: 12, class: "tick unit", "text-anchor": "end" }, "mg");
    const every = width < 480 ? 6 : 3;
    for (let m = from; m <= to; m += every * 60) {
      add("line", { x1: x(m), x2: x(m), y1: height - pad.b, y2: height - pad.b + 4, class: "axis" });
      add("text", { x: x(m), y: height - 10, class: "tick", "text-anchor": "middle" }, shortClock(m));
    }
    add("line", { x1: pad.l, x2: width - pad.r, y1: y(0), y2: y(0), class: "axis" });
    if (Number.isFinite(bed) && bed <= to) {
      add("line", { x1: x(bed), x2: x(bed), y1: 16, y2: height - pad.b, class: "bedtime" });
      const right = x(bed) > width - 70;
      add(
        "text",
        { x: x(bed) + (right ? -4 : 4), y: 12, class: "tick bed-label", "text-anchor": right ? "end" : "start" },
        "Bedtime"
      );
    }
    // Draw the chosen half-life last so it sits on top.
    const order = curves.filter((c) => c.key !== chosen.key).concat(curves.filter((c) => c.key === chosen.key));
    for (const c of order) {
      const d = c.pts.map((p, i) => `${i ? "L" : "M"}${x(p.t / MIN_MS).toFixed(1)},${y(p.mg).toFixed(1)}`).join("");
      add("path", { d, class: `line ${c.cls}${c.key === chosen.key ? " is-chosen" : ""}` });
    }
    chartBox.replaceChildren(svg);
  }

  function shortClock(minutes) {
    const h = Math.floor((((minutes % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, 0, 1, h)))
      .replace(/\s/g, NBSP);
  }

  if ("ResizeObserver" in window) {
    let w = 0;
    new ResizeObserver((entries) => {
      const nw = Math.round(entries[0].contentRect.width);
      if (nw !== w) {
        w = nw;
        drawChart();
      }
    }).observe(chartBox);
  }
  update();
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

/* ---------- 3. Taper planner ---------- */

function taper(root) {
  const mgInput = root.querySelector("[data-in=daily-mg]");
  const dateInput = root.querySelector("[data-in=start-date]");
  const toggle = root.querySelector("[data-toggle-drinks]");
  const picker = root.querySelector("[data-drinks]");
  const useBtn = root.querySelector("[data-use-total]");
  const pickerTotal = root.querySelector("[data-out=picker-total]");
  const summary = root.querySelector("[data-out=summary]");
  const table = root.querySelector("[data-out=plan]");
  const tbody = table.querySelector("tbody");

  const read = drinkPicker(picker, { extra: "count", onChange: updatePicker, firstRow: { count: "2" } });
  function pickerSum() {
    return Math.min(read().reduce((s, r) => s + r.mg * r.count, 0), MAX_MG);
  }
  function updatePicker() {
    pickerTotal.textContent = `Your drinks add up to about ${formatMg(pickerSum())} a day.`;
  }
  updatePicker();
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    picker.hidden = !open;
    if (open) picker.querySelector("select").focus();
  });
  useBtn.addEventListener("click", () => {
    mgInput.value = String(Math.round(pickerSum()));
    update();
    mgInput.focus();
  });
  mgInput.addEventListener("input", update);
  dateInput.addEventListener("input", update);

  const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  function weekDates(start, week) {
    const a = new Date(start.getTime() + (week - 1) * 7 * 86400000);
    const b = new Date(a.getTime() + 6 * 86400000);
    const text = dateFmt.formatRange ? dateFmt.formatRange(a, b) : `${dateFmt.format(a)}–${dateFmt.format(b)}`;
    return text.replace(/\s/g, NBSP);
  }

  function update() {
    const mg = readNumber(mgInput);
    if (!(mg >= 1)) {
      summary.textContent = "Enter how much caffeine you usually have in a day to see your plan.";
      table.hidden = true;
      return;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.value || "");
    const start = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    const rows = planRoadmap(mg);
    tbody.replaceChildren(
      ...rows.map((r) =>
        el("tr", {}, [
          el("th", { scope: "row" }, [
            `Week ${r.week} `,
            el("span", { class: "sub", text: r.subtitle }),
            ...(start ? [el("span", { class: "sub", text: weekDates(start, r.week) })] : []),
          ]),
          el("td", { text: mgToApproxCups(r.targetMg).replace(/ /g, NBSP) }),
          el("td", { text: formatMg(r.targetMg) }),
        ])
      )
    );
    table.hidden = false;
    summary.textContent = `From ${formatMg(rows[0].targetMg)} a day, your week 6 target would be ${formatMg(rows[5].targetMg)} a day.`;
  }
  update();
}

/* ---------- 4. Money saved calculator ---------- */

function moneySaved(root) {
  const perDay = root.querySelector("[data-in=per-day]");
  const price = root.querySelector("[data-in=price]");
  const currency = root.querySelector("[data-in=currency]");
  const fewer = root.querySelector("[data-in=fewer]");
  const modes = root.querySelectorAll("[data-in=mode]");
  const summary = root.querySelector("[data-out=summary]");
  const cells = {
    week: root.querySelector("[data-out=week]"),
    month: root.querySelector("[data-out=month]"),
    year: root.querySelector("[data-out=year]"),
  };
  for (const input of [perDay, price, fewer]) input.addEventListener("input", update);
  currency.addEventListener("change", update);
  modes.forEach((m) => m.addEventListener("change", update));

  function update() {
    const mode = [...modes].find((m) => m.checked)?.value || "quit";
    fewer.disabled = mode !== "cut";
    const drinks = readNumber(perDay, 50);
    const each = readNumber(price, 1000);
    const cut = mode === "cut" ? Math.min(readNumber(fewer, 50), drinks) : drinks;
    const money = new Intl.NumberFormat(undefined, { style: "currency", currency: currency.value });
    if (!(drinks > 0) || !(each > 0) || !(cut > 0)) {
      summary.textContent = "Enter your drinks a day and what one costs to see what you could save.";
      for (const c of Object.values(cells)) c.textContent = "–";
      return;
    }
    const day = cut * each;
    cells.week.textContent = money.format(day * 7);
    cells.month.textContent = money.format((day * 365) / 12);
    cells.year.textContent = money.format(day * 365);
    summary.textContent = `${mode === "cut" ? `Cutting back by ${count.format(cut)} ${cut === 1 ? "drink" : "drinks"} a day` : "Quitting"} could save you about ${money.format(day * 365)} a year, from your own numbers.`;
  }
  update();
}

/* ---------- Start ---------- */
const TOOLS = { calculator, "wear-off": wearOff, taper, "money-saved": moneySaved };
for (const root of document.querySelectorAll("[data-tool]")) {
  const run = TOOLS[root.getAttribute("data-tool")];
  if (run) {
    root.classList.add("is-ready");
    run(root);
  }
}
