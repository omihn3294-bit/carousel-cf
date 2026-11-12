// src/render.js
// يحوّل مخطط التصميم (JSON) الذي ينتجه الذكاء الاصطناعي إلى HTML لشرائح 1080×1350.
// لا يعتمد على DOM: يعمل داخل Cloudflare Worker، ويُعيد نصوصًا آمنة فقط.

const HEX = /^#[0-9a-fA-F]{6}$/;

const FONTS = {
  "ibm-plex-ar": { stack: "'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif", arabic: true },
  "amiri": { stack: "'Amiri','Sakkal Majalla','Traditional Arabic',serif", arabic: true },
  "cairo": { stack: "'Cairo','Segoe UI',Tahoma,sans-serif", arabic: true },
  "tajawal": { stack: "'Tajawal','Segoe UI',Tahoma,sans-serif", arabic: true },
  "readex": { stack: "'Readex Pro','Segoe UI',Tahoma,sans-serif", arabic: true },
  "noto-kufi": { stack: "'Noto Kufi Arabic','Segoe UI',Tahoma,sans-serif", arabic: true },
  "inter": { stack: "'Inter','Segoe UI',sans-serif", arabic: false },
  "space-grotesk": { stack: "'Space Grotesk','Bahnschrift','Segoe UI',sans-serif", arabic: false },
  "fraunces": { stack: "'Fraunces','Georgia',serif", arabic: false },
  "dm-serif": { stack: "'DM Serif Display','Georgia',serif", arabic: false },
  "jetbrains": { stack: "'JetBrains Mono',Consolas,monospace", arabic: false },
};

const LAYOUTS = new Set([
  "cover", "statement", "metrics", "chart", "list", "table",
  "code", "quote", "chips", "media", "closing",
]);

const TEXTURES = new Set(["none", "dots", "grid", "rings", "paper"]);
const DENSITIES = new Set(["airy", "balanced", "dense"]);

const ROLE = {
  ar: {
    cover: "الغلاف", statement: "فكرة", metrics: "أرقام", chart: "بيانات",
    "list:steps": "خطوات", "list:timeline": "خط زمني", "list:checklist": "قائمة",
    table: "جدول", code: "كود", quote: "اقتباس", chips: "أدوات",
    media: "صورة", closing: "الخلاصة",
  },
  en: {
    cover: "Cover", statement: "Idea", metrics: "Numbers", chart: "Data",
    "list:steps": "Steps", "list:timeline": "Timeline", "list:checklist": "Checklist",
    table: "Table", code: "Code", quote: "Quote", chips: "Tools",
    media: "Visual", closing: "Close",
  },
};

/* ------------------------------ colour utils ----------------------------- */

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(arr) {
  return "#" + arr.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
function rgba(hex, alpha) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lum(hex) {
  const c = rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function textOn(bg) {
  const light = mix(bg, "#ffffff", 0.94);
  const dark = mix(bg, "#000000", 0.9);
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}
function readable(color, bg) {
  const target = lum(bg) > 0.45 ? "#000000" : "#ffffff";
  let c = color;
  for (let i = 0; i < 16 && contrast(c, bg) < 3; i++) c = mix(c, target, 0.12);
  return c;
}

/* -------------------------------- helpers -------------------------------- */

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const br = (v) => esc(v).replace(/\n/g, "<br>");
const pad = (n) => String(n).padStart(2, "0");
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmtPct = (n) => (Math.round(n * 10) / 10).toString();

function normalizeTheme(theme, lang) {
  const p = (theme && theme.palette) || {};
  let bg = HEX.test(p.bg || "") ? p.bg : (lang === "ar" ? "#F2ECDF" : "#F3EFE4");
  let ink = HEX.test(p.ink || "") ? p.ink : (lang === "ar" ? "#10231C" : "#141414");
  if (contrast(bg, ink) < 4.5) ink = textOn(bg);

  const accent = HEX.test(p.accent || "") ? p.accent : (lang === "ar" ? "#A9502B" : "#B4552D");
  const accent2 = HEX.test(p.accent2 || "") ? p.accent2 : (lang === "ar" ? "#2E5B49" : "#1F5E4B");

  const f = (theme && theme.fonts) || {};
  let display = FONTS[f.display] ? f.display : (lang === "ar" ? "ibm-plex-ar" : "space-grotesk");
  let body = FONTS[f.body] ? f.body : (lang === "ar" ? "ibm-plex-ar" : "inter");
  if (lang === "ar") {
    if (!FONTS[display].arabic) display = "ibm-plex-ar";
    if (!FONTS[body].arabic) body = "ibm-plex-ar";
  }

  const texture = TEXTURES.has(theme && theme.texture) ? theme.texture : "none";
  const density = DENSITIES.has(theme && theme.density) ? theme.density : "balanced";

  const vars = [
    `--bg:${bg}`,
    `--ink:${ink}`,
    `--ink-soft:${mix(ink, bg, 0.2)}`,
    `--muted:${mix(ink, bg, 0.46)}`,
    `--accent:${accent}`,
    `--accent-text:${readable(accent, bg)}`,
    `--accent-2:${accent2}`,
    `--line:${rgba(ink, 0.16)}`,
    `--surface:${rgba(ink, 0.045)}`,
    `--surface-2:${rgba(ink, 0.1)}`,
    `--display:${FONTS[display].stack}`,
    `--body:${FONTS[body].stack}`,
    "--num:'Space Grotesk','Bahnschrift','Segoe UI',sans-serif",
    "--mono:'JetBrains Mono',Consolas,monospace",
  ].join(";");

  return { bg, ink, accent, accent2, texture, density, vars, fonts: { display, body } };
}

function roleFor(slide, lang) {
  const table = ROLE[lang] || ROLE.ar;
  if (slide.layout === "list") return table["list:" + (slide.kind || "steps")] || table["list:steps"];
  return table[slide.layout] || table.statement;
}

function textureHtml(texture) {
  switch (texture) {
    case "dots": return '<span class="tx tx-dots"></span>';
    case "grid": return '<span class="tx tx-grid"></span>';
    case "rings": return '<span class="tx tx-rings"></span><span class="tx tx-rings inner"></span>';
    case "paper": return '<span class="tx tx-paper"></span>';
    default: return "";
  }
}

function kicker(s) {
  return s.kicker ? `<p class="kicker">${esc(s.kicker)}</p>` : "";
}
function display(s) {
  return s.title ? `<h1 class="display">${br(s.title)}</h1>` : "";
}
function title(s) {
  return s.title ? `<h2 class="title">${br(s.title)}</h2>` : "";
}
function lead(s) {
  return s.lead ? `<p class="lead">${esc(s.lead)}</p>` : "";
}
function note(s) {
  return s.note ? `<p class="small mt-a">${esc(s.note)}</p>` : "";
}
function quoteBlock(s) {
  if (!s.quote) return "";
  return `<p class="quote">${esc(s.quote)}${s.by ? `<span class="by">${esc(s.by)}</span>` : ""}</p>`;
}
function cta(s) {
  if (!s.cta) return "";
  return `<span class="cta">${esc(s.cta)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg></span>`;
}
function statsHtml(stats) {
  const list = (Array.isArray(stats) ? stats : []).filter((x) => x && x.value != null).slice(0, 4);
  if (!list.length) return "";
  return `<div class="stat-grid" style="grid-template-columns:repeat(${list.length},1fr)">` +
    list.map((x) => `<div class="stat"><span class="n">${esc(x.value)}</span><span class="l">${esc(x.label || "")}</span></div>`).join("") +
    `</div>`;
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';

/* -------------------------------- layouts -------------------------------- */

function cover(s, ctx) {
  const meta = (Array.isArray(s.meta) ? s.meta : []).filter(Boolean).slice(0, 3);
  const metaList = meta.length ? meta : [`${ctx.total} ${ctx.lang === "ar" ? "شرائح" : "slides"}`];
  const copy = `${kicker(s)}${display(s)}${lead(s)}<div class="cover-meta">${metaList.map((x) => `<span>${esc(x)}</span>`).join("")}</div>`;
  if (ctx.hasImage) {
    return `<main class="s-main cover-main has-media"><div class="cover-copy">${copy}</div><div class="cover-media"><div class="media-slot" data-media></div></div></main>`;
  }
  return `<main class="s-main cover-main">${copy}</main>`;
}

function statement(s) {
  return `<main class="s-main center-main">${kicker(s)}<h2 class="statement">${br(s.title || s.text || "")}</h2>${lead(s)}${quoteBlock(s)}</main>`;
}

function metrics(s, ctx) {
  const hero = s.hero && s.hero.value != null
    ? `<div class="hero-num"><span class="n">${esc(s.hero.value)}</span><span class="l">${esc(s.hero.label || "")}</span></div>`
    : "";
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}${hero}${statsHtml(s.stats)}${note(s)}</main>`;
}

function chart(s, ctx) {
  if (s.kind === "donut" || (s.percent != null && s.percent !== "")) {
    const pct = clamp(parseFloat(s.percent) || 0, 0, 100);
    const left = `${statsHtml(s.stats)}${s.note ? `<p class="small mt-2">${esc(s.note)}</p>` : ""}`;
    return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="split"><div>${left}</div><div class="donut" style="--p:${fmtPct(pct)}%"><div class="v">${fmtPct(pct)}%<small>${esc(s.label || "")}</small></div></div></div></main>`;
  }

  const segs = (Array.isArray(s.segments) ? s.segments : []).filter((x) => x && x.percent != null).slice(0, 4);
  if (!segs.length) return statement(s);
  const sum = segs.reduce((n, x) => n + (parseFloat(x.percent) || 0), 0) || 100;
  const bar = segs.map((x, i) => `<i class="b${Math.min(i + 1, 3)}" style="width:${((parseFloat(x.percent) || 0) / sum * 100).toFixed(2)}%"></i>`).join("");
  const legend = segs.map((x, i) => `<span><i class="b${Math.min(i + 1, 3)}"></i> ${esc(x.label || "")}${x.value != null ? ` <b>${esc(x.value)}</b>` : ""}${x.percent != null ? ` · <bdi dir="ltr">${fmtPct(parseFloat(x.percent) || 0)}%</bdi>` : ""}</span>`).join("");
  const callout = s.callout ? `<div class="callout mt-a">${esc(s.callout)}</div>` : note(s);
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="bar">${bar}</div><div class="legend">${legend}</div>${callout}</main>`;
}

function list(s, ctx) {
  const kind = ["steps", "timeline", "checklist"].includes(s.kind) ? s.kind : "steps";
  const items = Array.isArray(s.items) ? s.items : [];

  if (kind === "timeline") {
    const rows = items.slice(0, 7).map((it, i) => (
      `<div class="day"><span class="d">${esc(it.label || pad(i + 1))}</span><span class="t">${esc(it.title || "")}${it.text ? `<small>${esc(it.text)}</small>` : ""}</span>${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ""}</div>`
    )).join("");
    if (!rows) return statement(s);
    return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="days">${rows}</div>${note(s)}</main>`;
  }

  if (kind === "checklist") {
    const rows = items.slice(0, 5).map((it) => (
      `<div class="check"><span class="box">${CHECK_SVG}</span><span>${esc(it.text || "")}${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</span></div>`
    )).join("");
    if (!rows) return statement(s);
    return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="checklist">${rows}</div>${quoteBlock(s)}</main>`;
  }

  const rows = items.slice(0, 4).map((it, i) => (
    `<div class="step"><div class="n">${pad(i + 1)}</div><div><h3>${esc(it.title || "")}</h3><p>${esc(it.text || "")}</p></div></div>`
  )).join("");
  if (!rows) return statement(s);
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="steps">${rows}</div>${quoteBlock(s)}${cta(s)}</main>`;
}

function table(s) {
  const head = (Array.isArray(s.head) ? s.head : []).slice(0, 4);
  const rows = (Array.isArray(s.rows) ? s.rows : []).slice(0, 5).map((r) => (Array.isArray(r) ? r.slice(0, head.length) : []));
  if (!head.length || !rows.length) return statement(s);
  const thead = head.map((h) => `<th>${esc(h)}</th>`).join("");
  const tbody = rows.map((r) => `<tr>${head.map((_, i) => `<td>${esc(r[i] == null ? "" : r[i])}</td>`).join("")}</tr>`).join("");
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="table-wrap"><table class="data-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>${note(s)}</main>`;
}

function code(s, ctx) {
  if (!s.code) return statement(s);
  const steps = (Array.isArray(s.items) ? s.items : []).slice(0, 3).map((it, i) => (
    `<div class="step"><div class="n">${pad(i + 1)}</div><div><h3>${esc(it.title || "")}</h3><p>${esc(it.text || "")}</p></div></div>`
  )).join("");
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="split code-split"><div class="code-copy">${steps ? `<div class="steps">${steps}</div>` : ""}</div><pre class="code" dir="ltr">${esc(s.code)}</pre></div>${quoteBlock(s)}${cta(s)}</main>`;
}

function quote(s) {
  return `<main class="s-main center-main">${kicker(s)}<blockquote class="big-quote">${br(s.text || s.title || "")}</blockquote>${s.by ? `<p class="by">${esc(s.by)}</p>` : ""}${s.context ? `<p class="context">${esc(s.context)}</p>` : ""}</main>`;
}

function chips(s) {
  const list = (Array.isArray(s.chips) ? s.chips : []).slice(0, 12).map((c) => (
    `<span class="chip"><i></i>${esc(typeof c === "string" ? c : (c && (c.label || c.text)) || "")}</span>`
  )).join("");
  if (!list) return statement(s);
  return `<main class="s-main">${kicker(s)}${title(s)}${lead(s)}<div class="chips">${list}</div>${statsHtml(s.stats)}${note(s)}</main>`;
}

function media(s, ctx) {
  if (!ctx.hasImage) return statement(s);
  return `<main class="s-main">${kicker(s)}<div class="media-split"><div class="media-shot"><div class="media-slot" data-media></div></div><div>${title(s)}${lead(s)}${s.caption ? `<p class="small">${esc(s.caption)}</p>` : ""}</div></div></main>`;
}

function closing(s) {
  const raw = (Array.isArray(s.points) ? s.points : []).slice(0, 4);
  const points = raw.map((p, i) => (
    `<div><b>${pad(i + 1)}</b><span>${esc(typeof p === "string" ? p : (p && (p.text || p.title)) || "")}</span></div>`
  )).join("");
  const cols = Math.max(1, raw.length || 4);
  return `<main class="s-main center-main">${kicker(s)}<h2 class="closing-display">${br(s.title || "")}</h2>${lead(s)}${points ? `<div class="closing-points" style="grid-template-columns:repeat(${cols},1fr)">${points}</div>` : ""}${quoteBlock(s)}${cta(s)}</main>`;
}

const RENDERERS = { cover, statement, metrics, chart, list, table, code, quote, chips, media, closing };

/* --------------------------------- public -------------------------------- */

export function renderDeck(spec, opts = {}) {
  const lang = spec && spec.language === "en" ? "en" : "ar";
  const slides = spec && Array.isArray(spec.slides) ? spec.slides.slice(0, 10) : [];
  const theme = normalizeTheme(spec && spec.theme, lang);
  const handle = String(opts.handle || (lang === "ar" ? "استوديو" : "STUDIO")).slice(0, 30);
  const ctx = { lang, theme, handle, hasImage: !!opts.hasImage, total: slides.length };

  const html = slides.map((raw, i) => {
    const slide = raw && typeof raw === "object" ? raw : {};
    if (!LAYOUTS.has(slide.layout)) slide.layout = "statement";
    const body = (RENDERERS[slide.layout] || statement)(slide, ctx);
    const role = roleFor(slide, lang);
    const dir = lang === "ar" ? "rtl" : "ltr";
    const brand = esc(handle);
    const extra = slide.layout === "cover" ? "cover" : "";
    return `<article class="slide lay-${slide.layout} ${extra} tex-${theme.texture}" dir="${dir}" lang="${lang}" style="${theme.vars}">` +
      `<div class="deco">${textureHtml(theme.texture)}</div>` +
      `<header class="s-head"><span class="brand"><i class="mark"></i>${brand}</span><span class="idx">${pad(i + 1)} / ${pad(slides.length)}</span></header>` +
      body +
      `<footer class="s-foot"><span>${brand}</span><span>${pad(i + 1)} · ${esc(role)}</span></footer>` +
      `</article>`;
  });

  return {
    html,
    meta: {
      lang,
      count: slides.length,
      fonts: [theme.fonts.display, theme.fonts.body],
      roles: slides.map((s) => roleFor(s, lang)),
      palette: { bg: theme.bg, ink: theme.ink, accent: theme.accent, accent2: theme.accent2 },
    },
  };
}
