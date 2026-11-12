// src/worker.js
// Cloudflare Worker — image sets designed from scratch for every request.
// Pass 1: art direction + image plan (JSON). Pass 2: finished HTML/CSS.
// No layout library: palette, type, grid, motif and every composition
// are invented for the subject.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const FONTS = {
  "Cairo": [400, 600, 700, 800],
  "Tajawal": [400, 500, 700, 800],
  "Almarai": [400, 700, 800],
  "IBM Plex Sans Arabic": [400, 500, 600, 700],
  "Noto Kufi Arabic": [400, 600, 700, 800],
  "Noto Naskh Arabic": [400, 500, 600, 700],
  "Amiri": [400, 700],
  "El Messiri": [400, 500, 600, 700],
  "Readex Pro": [400, 500, 600, 700],
  "Reem Kufi": [400, 500, 600, 700],
  "Lalezar": [400],
  "Inter": [400, 500, 600, 700, 800],
  "Manrope": [400, 500, 700, 800],
  "Space Grotesk": [400, 500, 700],
  "Sora": [400, 600, 700, 800],
  "Outfit": [400, 500, 600, 700],
  "Syne": [400, 600, 700, 800],
  "Playfair Display": [400, 500, 700, 800],
  "Fraunces": [400, 600, 700],
  "Cormorant Garamond": [400, 500, 600, 700],
  "DM Serif Display": [400],
  "Bebas Neue": [400],
  "JetBrains Mono": [400, 500, 700],
};

const AR_FONTS = new Set(["Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic",
  "Noto Kufi Arabic", "Noto Naskh Arabic", "Amiri", "El Messiri", "Readex Pro",
  "Reem Kufi", "Lalezar"]);

const RATIOS = {
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "9:16": [1080, 1920],
  "16:9": [1080, 608],
  "3:4": [1080, 1440],
  "2:3": [1080, 1620],
};

const FONT_LIST = Object.keys(FONTS).map((n) => n + " (" + FONTS[n].join(", ") + ")").join("; ");

const CONSTRAINTS = [
  "Typography is the image: no boxes, no cards, no icons. Structure comes from scale, rules and margins.",
  "The canvas is a printed page: folios, captions, figure numbers, hairline rules and generous margins.",
  "One color floods 40 to 60 percent of every image; type sits inside the flood, not beside it.",
  "Every image is built around one oversized graphic gesture: a numeral, a ring, a route, a silhouette drawn in CSS or inline SVG.",
  "The set behaves like a field guide: specimen labels, index numbers, annotations and one consistent label system.",
  "The set behaves like a poster series: one bold statement per image, very little body copy, strong figure-ground contrast.",
  "Information lives in a ledger, not in cards: rows, rules, aligned figures and small labels.",
  "The set behaves like a museum wall: object, label, number and a lot of air; one image may be almost empty.",
  "Use a strict modular grid with visible seams; some modules stay deliberately empty.",
  "Treat the set like a technical manual: numbered figures, leader lines, part labels, measured spacing.",
];

const PLAN_PROMPT = `You are the art director of a studio that designs image sets for social media: carousels, posters, infographics, invitations, study sheets, quote cards, product ads, event announcements, job posts, recipes, travel guides, data stories, menus and covers. Anything visual.

You never start from a template and you have no house style. Every set grows out of the subject itself: its material, place, era, process, vocabulary or audience. The same brief twice should look like two different studios solved it.

INPUT: the client request, the UI language, optional fixed limits (number of images, canvas ratio, artifact type), whether a photo is attached, one creative constraint, and recent directions to avoid.

Return strict JSON only. No HTML, no commentary.

THINK IN THIS ORDER

1. Artifact and job. What is being made, and what must it do: sell, teach, announce, explain, invite, provoke, document, recruit, guide.

2. Number of images. If a number is fixed, obey it exactly. Otherwise one idea per image:
   1 image: a single thought, quote, product, invitation or poster.
   3 to 4: a short announcement, a comparison, a recipe, a three-step idea.
   5 to 8: an explanation, tutorial, data story, walkthrough, case study or event recap.
   9 to 10: only for a genuinely long sequence.
   Never pad. Never merge two ideas into one image.

3. Concept. Find a concrete source in the subject and name it in 2 to 4 words. Then define:
   - palette: exactly five hex colors with roles: bg, surface, ink, accent, accent2. bg and ink must be tinted, never pure #fff or #000. accent must read at 4.5:1 on bg.
   - type: display and body from the allowed list. Pair across categories (serif + grotesque, kufi + naskh, mono + humanist). Arabic needs an Arabic family.
   - motif: one visual device that recurs and transforms across images.
   - grid: the layout logic for the set.
   - rhythm: the tone sequence, for example light, light, dark, tint, light, dark.

4. Image plan. For each image: job, layout, dominant element, tone, and one sentence on what it says.

STRUCTURAL RULES (hard)
- No two adjacent images share a layout. No layout appears more than twice.
- At least three different dominant elements across the set.
- At least two tones; with five or more images, at least one dark image.
- At least one quiet image (few words, much air) and one dense image.
- Vary the axis: start edge, end edge, centred, and at least one full-bleed.
- The first image must not be the default "kicker + big title + lead" unless it earns it.
- Headlines 8 words or fewer. Body 40 words or fewer.

LAYOUT VOCABULARY (structures, not templates; bend and combine them)
edge-title: oversized headline anchored to one edge, the rest open.
full-bleed-type: the headline is the image and bleeds off two edges.
number-first: one enormous numeral is the protagonist, everything else annotates it.
split-thirds: a 1/3 to 2/3 split, content on the narrow side.
ledger: rows on hairline rules, aligned figures, small labels.
specimen: a labelled diagram with leader lines and part numbers.
index: a numbered list where the indexes are the largest element.
frame-in-frame: an inset panel crops the subject, type sits outside.
text-on-flood: a colour field covers 40 to 60 percent, type inside it.
timeline-rail: a rail with stops and labels.
matrix: 2x2 or 3x2 cells with a clear reading order.
quote-monument: the quote owns 70 percent of the canvas.
table-slab: a comparison table with an oversized header row.
photo-cut: type overlaps the photo edge, photo bleeds off two sides.
collage: two or three fragments at slight angles, pinned.
map-abstract: a simplified map or route as the main graphic.
chart-hero: a single chart is the protagonist, drawn in CSS or SVG.
step-ladder: steps ascending diagonally, each one a beat.
dictionary: term, pronunciation, definition.
marquee: a repeated word band as a graphic device.
corner-stack: content pushed into one corner, the rest empty.
gatefold: a mirrored centre split, two halves answering each other.

ANTI-CLICHE (do not produce)
- cream + forest green + copper; navy + gold; black + neon; purple-blue gradients; pastel pink + blue; pure white with one bright accent.
- a centred title with a thin rule under it on a flat background.
- three equal rounded cards in a row; icon + label + paragraph feature rows.
- big number plus three stat boxes unless the data genuinely needs it.
- emoji as icons, glowing gradients, text shadows, generic abstract blobs.
- marketing filler: "اكتشف", "ارتقِ", "أطلق العنان", "الحل الأمثل", "لا تفوّت", "game-changer", "unlock", "elevate", "seamless".
- any number, price, date, name, quote, testimonial or statistic the client did not provide.

CONTENT RULES
- Write in the language of the client request. Arabic means clear Modern Standard Arabic.
- One idea per image, in specific words. No sentence repeated between images.
- If no numbers were given, the design has no numbers. Counters like 03/07 are fine.
- If no contact or offer was given, there is no call to action.
- Titles are sentences with a subject and a verb, not category labels.

PLAN JSON (exactly these keys)
{
  "title": "short title in the content language",
  "artifact": "carousel | poster | infographic | invitation | study sheet | quote card | ad | announcement | recipe | guide | menu | other",
  "language": "ar | en",
  "ratio": "4:5 | 1:1 | 9:16 | 16:9 | 3:4 | 2:3",
  "count": 1,
  "concept": {
    "name": "2 to 4 words in the content language",
    "root": "the concrete source in the subject",
    "idea": "one sentence connecting source to design",
    "palette": {"bg": "#RRGGBB", "surface": "#RRGGBB", "ink": "#RRGGBB", "accent": "#RRGGBB", "accent2": "#RRGGBB"},
    "type": {"display": "font name", "body": "font name", "why": "one clause"},
    "motif": "one sentence",
    "grid": "one sentence",
    "rhythm": "light, dark, light"
  },
  "slides": [
    {"n": 1, "job": "hook | context | evidence | comparison | step | quote | detail | turn | close", "layout": "one name from the vocabulary", "dominant": "type | number | diagram | table | photo | quote | list | map", "tone": "light | dark | tint", "text": "what this image says, one sentence"}
  ],
  "rejected": ["the cliche you deliberately avoided"]
}`;

const BUILD_PROMPT = `You are the designer executing an approved plan. The plan is a contract: same concept, palette, type pairing, number of images, order and layout for each.

Write the final copy and produce finished HTML and CSS, one section per image.

CANVAS (fixed by the host)
- Width 1080px. Height: 1350 for 4:5, 1080 for 1:1, 1920 for 9:16, 608 for 16:9, 1440 for 3:4, 1620 for 2:3.
- The host already sets .slide to position relative, width and height 100 percent, overflow hidden, background var(--bg), color var(--ink), and defines --bg, --surface, --ink, --accent, --accent2, --font-display, --font-body. Use those variables. You may override them per tone.
- Use px sizes. Do not use vw, vh, cqw or percentages for type.
- Each image is exactly one <section class="slide"> and nothing else. No wrapper, no html, no body.

PALETTE
- The five colors are the whole palette. Make tints with rgba() or color-mix of those colors, never a new hue.
- Every text element needs an explicit color. Contrast at least 4.5:1 for body, 3:1 for type above 48px.
- Tone variants override --bg and --ink on .slide.dark or .slide.tint. Keep accent readable on each.

TYPE
- Only these families: ${FONT_LIST}. At most two. Arabic text uses a family with Arabic support.
- Build one scale and keep it: for example 168/96/56/40/32/26. Body at least 30px. Nothing below 24px except captions and folios.
- Arabic: line-height at least 1.55 for body and 1.25 for headlines, no letter-spacing, no uppercase.
- Latin: tight tracking for display, normal for body. No fake small caps.
- One dominant type size per image. No three sizes competing.

LAYOUT SAFETY (non-negotiable)
- All text lives in normal flow: flex or grid. Never absolute-position text. Decoration may be absolute, behind text, with aria-hidden="true".
- Safe margins 72 to 110px. Nothing touches the edge except deliberate full-bleed art.
- No fixed heights on text boxes. Let text grow.
- Count characters: at 120px, a 900px line holds about 14 Arabic or 22 Latin characters. Break headlines into 2 to 4 lines.
- No text over text. No text over a busy photo without a solid or heavily tinted panel.

COMPOSITION
- Execute the layout named in the plan. Do not fall back to a generic stack.
- Vary the skeleton between images even within the same layout family: mirror it, change the dominant element, change the crop.
- Each image needs one deliberate gesture: an oversized numeral, a crop, a rule running off-canvas, a colour field, a diagram.
- Use inline SVG for icons, charts, maps and diagrams. No icon fonts, no external images.
- Reuse the motif across the set, transformed each time.

COPY
- Only facts from the request. If a number is missing, write around it.
- Headlines 8 words or fewer, specific, in the content language.
- No repeated sentence between images. No CTA unless the client gave a way to act.
- No brand, handle or watermark unless the client gave one. Counters like 02/07 are allowed.

PHOTO
- When a photo is attached, reference it exactly as <img src="{{PHOTO}}" alt=""> at most twice in the set, with object-fit cover and explicit dimensions or an absolute bleed. Design the crop.
- When no photo is attached, no <img> at all.

SELF-CHECK BEFORE ANSWERING
1. Does the number of sections equal the plan?
2. Does any text cross the edge, overlap other text, or get clipped? Shrink and retest.
3. Is every text color readable on the color behind it?
4. Does the set look like one system while no two images share a skeleton?
5. Is every number, name and claim from the request?

OUTPUT (exactly this, no markdown fences)
<<<CSS>>>
...css...
<<<SLIDE>>>
<section class="slide" data-layout="...">...</section>
<<<SLIDE>>>
...
<<<END>>>`;

/* ------------------------------------------------------------------ *
 * errors / helpers
 * ------------------------------------------------------------------ */

class Upstream extends Error {
  constructor(status, message) {
    super(message || "upstream");
    this.status = status || 502;
  }
}

const MESSAGES = {
  ar: {
    no_key: "خدمة الذكاء الاصطناعي غير مهيأة على الخادم. أضف المفتاح ثم أعد المحاولة.",
    invalid_request: "تعذّر قراءة الطلب، أعد المحاولة.",
    empty_description: "اكتب طلبك أولًا.",
    upstream: "خدمة الذكاء الاصطناعي مشغولة الآن، جرّب بعد قليل.",
    upstream_error: "خدمة الذكاء الاصطناعي أعادت خطأً، جرّب بعد قليل.",
    incomplete: "جاء التصميم ناقصًا، أعد المحاولة.",
    network_error: "تعذّر الاتصال بالخدمة، جرّب بعد قليل.",
  },
  en: {
    no_key: "The AI service is not configured on the server yet.",
    invalid_request: "The request could not be read. Please try again.",
    empty_description: "Please describe what you want first.",
    upstream: "The AI service is busy right now. Try again in a moment.",
    upstream_error: "The AI service returned an error. Try again shortly.",
    incomplete: "The design came back incomplete. Please try again.",
    network_error: "Could not reach the service. Try again shortly.",
  },
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: JSON_HEADERS });
}

function reply(lang, code, status) {
  const table = MESSAGES[lang] || MESSAGES.en;
  return json({ code, error: table[code] || table.invalid_request }, status);
}

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

function detectLang(text) {
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  if (!ar) return "en";
  return ar >= en * 0.4 ? "ar" : "en";
}

function pick(list, avoid) {
  const pool = list.filter((v) => !avoid.includes(v));
  const src = pool.length ? pool : list;
  return src[Math.floor(Math.random() * src.length)];
}

/* ------------------------------------------------------------------ *
 * color math: guarantee a readable palette before the model paints
 * ------------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/i;

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function luminance(h) {
  const c = hexRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function readableOn(bg) {
  const light = mix(bg, "#ffffff", 0.94);
  const dark = mix(bg, "#000000", 0.90);
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

function ensureContrast(color, bg, min) {
  if (contrast(color, bg) >= min) return color;
  const light = mix(bg, "#ffffff", 0.96);
  const dark = mix(bg, "#000000", 0.92);
  const target = contrast(light, bg) > contrast(dark, bg) ? light : dark;
  for (let i = 1; i <= 10; i++) {
    const c = mix(color, target, i / 10);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

function distance(a, b) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
}

function normalizePalette(input) {
  const p = input && typeof input === "object" ? input : {};
  const bg = HEX.test(p.bg) ? p.bg : "#f3efe7";
  let ink = HEX.test(p.ink) ? p.ink : readableOn(bg);
  if (contrast(ink, bg) < 7) ink = readableOn(bg);

  let surface = HEX.test(p.surface) ? p.surface : mix(bg, ink, 0.07);
  if (contrast(surface, bg) < 1.04) surface = mix(bg, ink, 0.09);

  let accent = HEX.test(p.accent) ? p.accent : "#b4552d";
  accent = ensureContrast(accent, bg, 4.5);

  let accent2 = HEX.test(p.accent2) ? p.accent2 : mix(accent, ink, 0.35);
  accent2 = ensureContrast(accent2, bg, 3);
  if (distance(accent, accent2) < 30) {
    accent2 = ensureContrast(mix(accent, ink, 0.5), bg, 3);
  }

  return { bg, surface, ink, accent, accent2 };
}

/* ------------------------------------------------------------------ *
 * plan normalization
 * ------------------------------------------------------------------ */

function normalizeFonts(type, lang) {
  const t = type && typeof type === "object" ? type : {};
  const ar = lang === "ar";
  const ok = (name, fallback) => {
    if (!FONTS[name]) return fallback;
    if (ar && !AR_FONTS.has(name)) return fallback;
    return name;
  };
  const display = ok(clip(t.display, 40), ar ? "Readex Pro" : "Fraunces");
  const body = ok(clip(t.body, 40), ar ? "IBM Plex Sans Arabic" : "Inter");
  return Array.from(new Set([display, body]));
}

function normalizePlan(raw, ctx) {
  const p = raw && typeof raw === "object" ? raw : {};
  const c = p.concept && typeof p.concept === "object" ? p.concept : {};
  const fonts = normalizeFonts(c.type, ctx.lang);

  const slides = Array.isArray(p.slides)
    ? p.slides.slice(0, 10).map((s, i) => ({
        n: i + 1,
        job: clip(s && s.job, 30),
        layout: clip(s && s.layout, 40),
        dominant: ["type", "number", "diagram", "table", "photo", "quote", "list", "map"].includes(s && s.dominant)
          ? s.dominant
          : "type",
        tone: ["light", "dark", "tint"].includes(s && s.tone) ? s.tone : "light",
        text: clip(s && s.text, 260),
      }))
    : [];

  const ratio = ctx.ratio !== "auto" ? ctx.ratio : (RATIOS[p.ratio] ? p.ratio : "4:5");
  const planned = slides.length > 0;

  return {
    title: clip(p.title, 120),
    artifact: clip(p.artifact, 40) || "image set",
    language: ctx.lang,
    ratio,
    count: ctx.count || slides.length,
    concept: {
      name: clip(c.name, 60),
      root: clip(c.root, 200),
      idea: clip(c.idea, 300),
      palette: normalizePalette(c.palette),
      type: {
        display: fonts[0],
        body: fonts[1] || fonts[0],
        why: clip(c.type && c.type.why, 160),
      },
      motif: clip(c.motif, 200),
      grid: clip(c.grid, 200),
      rhythm: clip(c.rhythm, 120),
    },
    slides,
    rejected: Array.isArray(p.rejected) ? p.rejected.slice(0, 5).map((v) => clip(v, 80)) : [],
    constraint: ctx.constraint,
    planned,
  };
}

function planWarnings(plan) {
  const notes = [];
  const layouts = plan.slides.map((s) => s.layout).filter(Boolean);

  for (let i = 1; i < layouts.length; i++) {
    if (layouts[i] === layouts[i - 1]) {
      notes.push('images ' + i + " and " + (i + 1) + ' share the layout "' + layouts[i] + '"; rebuild one with a different structure');
    }
  }

  const tones = new Set(plan.slides.map((s) => s.tone));
  if (plan.slides.length >= 3 && tones.size < 2) {
    notes.push("all images use one tone; introduce a dark or tinted image");
  }

  const dominant = new Set(plan.slides.map((s) => s.dominant));
  if (plan.slides.length >= 4 && dominant.size < 3) {
    notes.push("too few dominant element types; vary type, number, diagram, table, photo or quote");
  }

  return notes;
}

function normalizeAvoid(input) {
  const a = input && typeof input === "object" ? input : {};
  const list = (v, n) => (Array.isArray(v) ? v.map((x) => clip(x, 90)).filter(Boolean).slice(0, n) : []);
  return {
    concepts: list(a.concepts, 5),
    palettes: list(a.palettes, 5),
    fonts: list(a.fonts, 4),
    constraints: list(a.constraints, 5),
  };
}

/* ------------------------------------------------------------------ *
 * Groq
 * ------------------------------------------------------------------ */

async function chat(env, messages, opts) {
  const o = opts || {};
  const model = env.GROQ_MODEL || "openai/gpt-oss-120b";
  const body = {
    model,
    messages,
    temperature: o.temperature == null ? 0.8 : o.temperature,
    max_tokens: o.maxTokens || 6000,
  };
  if (/gpt-oss/i.test(model)) body.reasoning_effort = env.GROQ_REASONING || "low";
  if (o.json) body.response_format = { type: "json_object" };

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + env.GROQ_API_KEY,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(env.UPSTREAM_TIMEOUT_MS) || 110000);

  try {
    let res = await fetch(GROQ_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok && body.response_format && (res.status === 400 || res.status === 422)) {
      delete body.response_format;
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = (err.error && err.error.message) || "";
      } catch (e) {}
      throw new Upstream(res.status, detail);
    }

    const data = await res.json();
    const choice = data.choices && data.choices[0];
    const content = choice && choice.message && choice.message.content;
    if (!content) throw new Upstream(502, "empty completion");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * pass 1: plan
 * ------------------------------------------------------------------ */

function planUser(ctx) {
  const rows = [
    "CLIENT REQUEST",
    '"""',
    ctx.description,
    '"""',
    "",
    "UI language: " + ctx.uiLang,
    "Artifact type: " + (ctx.kind === "auto" ? "decide from the request" : ctx.kind),
    "Number of images: " + (ctx.count ? "exactly " + ctx.count : "decide between 1 and 10"),
    "Canvas ratio: " + (ctx.ratio === "auto" ? "decide" : ctx.ratio),
    "Photo attached: " + (ctx.hasPhoto ? "yes" : "no"),
    "Creative constraint to honour: " + ctx.constraint,
  ];

  const avoid = [].concat(ctx.avoid.concepts, ctx.avoid.palettes, ctx.avoid.fonts);
  if (avoid.length) rows.push("Recent directions to avoid: " + avoid.join(" | "));
  if (ctx.variation) rows.push("This is a re-roll: the previous direction was rejected. Move clearly away from it.");

  return rows.join("\n");
}

function parseJson(raw) {
  const s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(s);
  } catch (e) {}
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch (e) {}
  }
  return null;
}

async function makePlan(env, ctx) {
  const system = PLAN_PROMPT + "\n\nAllowed families: " + FONT_LIST + ".";

  let last = 0;
  let fallbackPlan = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt && ctx.count && last
      ? "\n\nYour previous plan had " + last + " images. The client fixed the number at " + ctx.count + ": return exactly that many."
      : "";

    try {
      const raw = await chat(
        env,
        [
          { role: "system", content: system },
          { role: "user", content: planUser(ctx) + extra },
        ],
        { json: true, maxTokens: 2600, temperature: attempt ? 0.45 : 0.9 }
      );

      const plan = parseJson(raw);
      if (plan && Array.isArray(plan.slides) && plan.slides.length) {
        fallbackPlan = plan;
        if (!ctx.count || plan.slides.length === ctx.count) return plan;
        last = plan.slides.length;
      }
    } catch (e) {
      if (e instanceof Upstream) return fallbackPlan;
    }
  }

  return fallbackPlan;
}

/* ------------------------------------------------------------------ *
 * pass 2: build
 * ------------------------------------------------------------------ */

function planForPrompt(plan) {
  return {
    title: plan.title,
    artifact: plan.artifact,
    language: plan.language,
    ratio: plan.ratio,
    concept: plan.concept,
    slides: plan.slides,
    constraint: plan.constraint,
  };
}

function buildUser(ctx, plan, want) {
  const rows = [
    "CLIENT REQUEST",
    '"""',
    ctx.description,
    '"""',
    "",
    "UI language: " + ctx.uiLang,
    "Content language: " + ctx.lang,
    "Artifact: " + (ctx.kind === "auto" ? "decide from the request" : ctx.kind),
    "Number of images: " + (want ? "exactly " + want : "decide between 1 and 10"),
    "Canvas: " + plan.ratio + " — " + RATIOS[plan.ratio][0] + " x " + RATIOS[plan.ratio][1] + " px",
    "Photo attached: " + (ctx.hasPhoto ? "yes, design the crop and use {{PHOTO}}" : "no, never use <img>"),
    "Creative constraint: " + ctx.constraint,
  ];

  const avoid = [];
  if (ctx.avoid.concepts.length) avoid.push("directions: " + ctx.avoid.concepts.join(" | "));
  if (ctx.avoid.palettes.length) avoid.push("palettes: " + ctx.avoid.palettes.join(" | "));
  if (ctx.avoid.fonts.length) avoid.push("type pairings: " + ctx.avoid.fonts.join(" | "));
  if (avoid.length) rows.push("Do not repeat — " + avoid.join("; "));
  if (ctx.variation) rows.push("This is a re-roll: the client rejected the previous direction, move clearly away from it.");

  if (plan.planned) {
    rows.push("", "APPROVED PLAN", JSON.stringify(planForPrompt(plan), null, 2));
    const notes = planWarnings(plan);
    if (notes.length) rows.push("", "DIRECTOR NOTES", ...notes.map((n) => "- " + n));
  } else {
    rows.push("", "No plan was approved. Decide the concept and the image list yourself, following the rules, then design the set.");
  }

  rows.push("", "Produce the complete set now. Follow the plan exactly.");
  return rows.join("\n");
}

function extractSlide(part) {
  const s = String(part || "").trim();
  if (!s) return "";
  const m = /<(section|article|div)\b[^>]*\bclass\s*=\s*["'][^"']*\bslide\b[^"']*["'][\s\S]*<\/\1>/i.exec(s);
  return m ? m[0] : "";
}

function parseDesign(raw) {
  let text = String(raw || "").replace(/```[a-z]*\s*/gi, "").replace(/```/g, "");
  const at = text.indexOf("<<<CSS>>>");
  if (at < 0) return null;
  text = text.slice(at + 9);
  const end = text.indexOf("<<<END>>>");
  if (end >= 0) text = text.slice(0, end);

  const parts = text.split("<<<SLIDE>>>");
  const css = (parts.shift() || "").trim();
  const slides = parts.map(extractSlide).filter(Boolean);

  if (!css || !slides.length) return null;
  return { css, slides };
}

function validateDesign(design, ctx, want) {
  if (!design) return ["the output did not contain a CSS block and <section class=slide> images"];

  const errors = [];

  if (!design.css || design.css.length < 60) errors.push("the CSS block is missing or nearly empty");
  if (design.css.length > 60000) errors.push("the CSS block is too long");
  if (!design.slides.length) errors.push("no images were returned");
  if (want && design.slides.length !== want) {
    errors.push("returned " + design.slides.length + " images; the set must contain exactly " + want);
  }
  if (design.slides.length > 10) errors.push("more than 10 images");

  if (/@import\b/i.test(design.css)) errors.push("CSS must not contain @import");
  if (/url\(\s*['"]?(?:https?:|\/\/)/i.test(design.css)) errors.push("CSS must not load external files");
  if (/position\s*:\s*fixed/i.test(design.css)) errors.push("CSS must not use position: fixed");

  const forbidden = /<(script|style|link|iframe|object|embed|form|input|button|video|audio|canvas)\b/i;

  design.slides.forEach((slide, i) => {
    const n = i + 1;
    if (!/<(section|article|div)\b[^>]*\bclass\s*=\s*["'][^"']*\bslide\b/i.test(slide)) {
      errors.push("image " + n + ': the root element must have class="slide"');
    }
    if (forbidden.test(slide)) errors.push("image " + n + ": contains a forbidden tag");
    if (/\son[a-z]+\s*=/i.test(slide)) errors.push("image " + n + ": contains an inline event handler");
    if (/@import\b/i.test(slide)) errors.push("image " + n + ": contains @import");

    const imgs = slide.match(/<img\b[^>]*>/gi) || [];
    if (imgs.length && !ctx.hasPhoto) errors.push("image " + n + ": uses <img> but no photo was attached");
    if (imgs.some((tag) => !/src\s*=\s*["'](?:\{\{PHOTO\}\}|data:image\/)/i.test(tag))) {
      errors.push('image ' + n + ': <img> must use src="{{PHOTO}}"');
    }
    if (slide.length > 26000) errors.push("image " + n + ": HTML is too long");
  });

  return errors;
}

async function buildDesign(env, ctx, plan, want) {
  const maxTokens = Math.min(Number(env.GROQ_MAX_TOKENS) || 20000, 24000);
  const messages = [
    { role: "system", content: BUILD_PROMPT },
    { role: "user", content: buildUser(ctx, plan, want) },
  ];

  let raw = await chat(env, messages, { maxTokens, temperature: 0.85 });
  let design = parseDesign(raw);
  let errors = validateDesign(design, ctx, want);

  if (errors.length) {
    const fix = messages[1].content +
      "\n\nCORRECTION REQUIRED — the previous attempt failed:\n- " +
      errors.slice(0, 14).join("\n- ") +
      "\n\nReturn the complete set again in the same format, fixing every item. No explanations.";

    raw = await chat(
      env,
      [{ role: "system", content: BUILD_PROMPT }, { role: "user", content: fix }],
      { maxTokens, temperature: 0.55 }
    );
    design = parseDesign(raw);
    errors = validateDesign(design, ctx, want);
  }

  return { design, errors };
}

/* ------------------------------------------------------------------ *
 * fonts + canvas
 * ------------------------------------------------------------------ */

function fontStack(name) {
  const serif = /Amiri|Playfair|Fraunces|Cormorant|DM Serif|Noto Naskh/i.test(name);
  return "'" + name + "', " + (serif ? "Georgia, serif" : "'Segoe UI', system-ui, sans-serif");
}

function fontsUrl(names) {
  const fams = names
    .filter((n) => FONTS[n])
    .map((n) => "family=" + n.replace(/ /g, "+") + ":wght@" + FONTS[n].join(";"));
  return fams.length ? "https://fonts.googleapis.com/css2?" + fams.join("&") + "&display=swap" : "";
}

function usedFonts(css, seed) {
  const names = new Set(seed.filter((n) => FONTS[n]));
  const re = /font-family\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css))) {
    const value = m[1].toLowerCase();
    for (const name of Object.keys(FONTS)) {
      if (value.includes(name.toLowerCase())) names.add(name);
    }
  }
  return Array.from(names).slice(0, 4);
}

function baseCss(plan, W, H) {
  const p = plan.concept.palette;
  const display = fontStack(plan.concept.type.display);
  const body = fontStack(plan.concept.type.body || plan.concept.type.display);

  return [
    "*,*::before,*::after{box-sizing:border-box}",
    ".__root{width:" + W + "px;height:" + H + "px;margin:0;padding:0;position:relative;overflow:hidden}",
    ".slide{position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;background:var(--bg);color:var(--ink);",
    "--bg:" + p.bg + ";--surface:" + p.surface + ";--ink:" + p.ink + ";--accent:" + p.accent + ";--accent2:" + p.accent2 + ";",
    "--font-display:" + display + ";--font-body:" + body + ";",
    "font-family:var(--font-body);line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
    ".slide h1,.slide h2,.slide h3,.slide p,.slide figure,.slide blockquote,.slide ul,.slide ol{margin:0}",
    ".slide ul,.slide ol{padding:0;list-style:none}",
    ".slide img{display:block;max-width:100%}",
    '.slide [aria-hidden="true"]{pointer-events:none}',
  ].join("");
}

/* ------------------------------------------------------------------ *
 * handler
 * ------------------------------------------------------------------ */

async function handleGenerate(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return reply("en", "invalid_request", 400);
  }

  const uiLang = body.uiLang === "en" || body.lang === "en" ? "en" : "ar";
  const description = String(body.description || "").slice(0, 2000).trim();
  if (!description) return reply(uiLang, "empty_description", 400);
  if (!env.GROQ_API_KEY) return reply(uiLang, "no_key", 500);

  const lang = detectLang(description);
  const count = Math.max(0, Math.min(10, Number(body.count) || 0));
  const ratio = RATIOS[body.ratio] ? body.ratio : "auto";
  const kind = typeof body.kind === "string" ? body.kind.slice(0, 30) : "auto";
  const avoid = normalizeAvoid(body.avoid);

  const ctx = {
    description,
    uiLang,
    lang,
    count,
    ratio,
    kind,
    avoid,
    hasPhoto: body.hasPhoto === true,
    photoRatio: Number(body.photoRatio) > 0 ? Number(body.photoRatio) : 0,
    variation: body.variation === true,
    constraint: pick(CONSTRAINTS, avoid.constraints),
  };

  try {
    let rawPlan = null;
    try {
      rawPlan = await makePlan(env, ctx);
    } catch (e) {
      rawPlan = null;
    }

    const plan = normalizePlan(rawPlan, ctx);
    const want = count || plan.slides.length || 0;
    const built = await buildDesign(env, ctx, plan, want);

    if (!built.design || built.errors.length) {
      return reply(uiLang, "incomplete", 502);
    }

    const [W, H] = RATIOS[plan.ratio];
    const fonts = usedFonts(built.design.css, [plan.concept.type.display, plan.concept.type.body]);

    const meta = {
      title: plan.title || description.slice(0, 60),
      type: plan.artifact,
      direction: plan.concept.name,
      root: plan.concept.root,
      idea: plan.concept.idea,
      motif: plan.concept.motif,
      grid: plan.concept.grid,
      rhythm: plan.concept.rhythm,
      constraint: plan.constraint,
      ratio: plan.ratio,
      w: W,
      h: H,
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      fonts,
      palette: plan.concept.palette,
      count: built.design.slides.length,
      planned: plan.planned,
    };

    return json({
      meta,
      fontsUrl: fontsUrl(fonts),
      css: baseCss(plan, W, H) + "\n" + built.design.css,
      slides: built.design.slides,
    });
  } catch (err) {
    if (err instanceof Upstream) return reply(uiLang, "upstream_error", 502);
    return reply(uiLang, "network_error", 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate") {
      if (request.method !== "POST") {
        return reply("en", "invalid_request", 405);
      }
      return handleGenerate(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
