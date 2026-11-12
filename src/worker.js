// src/worker.js
// Cloudflare Worker: /api/generate يبني مخطط التصميم بالذكاء الاصطناعي،
// ثم src/render.js يحوّله إلى شرائح HTML بمقاس 1080×1350.

import { renderDeck } from "./render.js";

const MESSAGES = {
  ar: {
    no_key: "خدمة الذكاء الاصطناعي غير مهيأة على الخادم. أضف المفتاح ثم أعد المحاولة.",
    invalid_request: "تعذّر قراءة الطلب، أعد المحاولة.",
    empty_description: "اكتب وصف الفكرة أولًا.",
    method: "يجب أن يكون الطلب POST.",
    upstream: "خدمة الذكاء الاصطناعي مشغولة الآن، جرّب بعد قليل.",
    invalid_json: "جاء الرد غير مكتمل، أعد الإنشاء.",
    incomplete: "جاء الرد ناقصًا، أعد الإنشاء.",
    network_error: "تعذّر الاتصال بالخدمة، جرّب بعد قليل.",
  },
  en: {
    no_key: "The AI service is not configured on the server yet.",
    invalid_request: "The request could not be read. Please try again.",
    empty_description: "Please describe your idea first.",
    method: "This endpoint only accepts POST.",
    upstream: "The AI service is busy right now. Try again in a moment.",
    invalid_json: "The response came back incomplete. Generate again.",
    incomplete: "The response was incomplete. Generate again.",
    network_error: "Could not reach the service. Try again shortly.",
  },
};

const LAYOUTS = new Set([
  "cover", "statement", "metrics", "chart", "list", "table",
  "code", "quote", "chips", "media", "closing",
]);
const LIST_KINDS = new Set(["steps", "timeline", "checklist"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

const SCHEMA_AR = `
أعد JSON فقط، بدون أي كلام قبله أو بعده، بهذا الشكل:
{
  "title": "عنوان الملف",
  "theme": {
    "mood": "editorial|data|warm|bold|minimal|luxury|playful",
    "palette": { "bg": "#RRGGBB", "ink": "#RRGGBB", "accent": "#RRGGBB", "accent2": "#RRGGBB" },
    "fonts": { "display": "ibm-plex-ar", "body": "ibm-plex-ar" },
    "texture": "none|dots|grid|rings|paper",
    "density": "airy|balanced|dense"
  },
  "slides": [
    { "layout": "cover", "kicker": "...", "title": "...", "lead": "...", "meta": ["...", "..."] }
  ]
}

حقول كل layout (استخدم ما يلزم فقط):
cover: kicker, title, lead, meta[]
statement: kicker, title, lead, quote
metrics: kicker, title, lead, hero{value,label}, stats[{value,label}], note
chart: kind:"bar"|"donut", kicker, title, lead, segments[{label,value,percent}], percent, label, stats[], callout, note
list: kind:"steps"|"timeline"|"checklist", kicker, title, lead, items[{title,text,label,tag}], quote, cta, note
table: kicker, title, lead, head[], rows[][], note
code: kicker, title, lead, items[{title,text}], code, quote
quote: kicker, text, by, context
chips: kicker, title, lead, chips[], stats[], note
media: kicker, title, lead, caption
closing: kicker, title, lead, points[], quote, cta
`;

const SYSTEM_AR = `أنت مدير فني وكاتب محتوى لشرائح إنستغرام. مهمتك تحويل أي طلب إلى 3–10 شرائح بهوية بصرية مصممة لذلك الطلب، لا قالب جاهز.

قبل الكتابة، حدّد نوع المحتوى: عرض منتج، شرح تعليمي، قصة بيانات، إعلان، اقتباس، دليل خطوة بخطوة، مقارنة، تغطية حدث، إعلان وظيفة، أو غير ذلك.
اكتب بلغة الطلب. إن كان عربيًا فبالفصحى الحديثة.
عدد الشرائح: فكرة واحدة لكل شريحة، من 3 إلى 10. إذا حدد المستخدم عددًا فالتزم به. لا شريحة للمجاملة.
الهوية: أربعة ألوان + خطان + نسيج واحد + كثافة واحدة.

قواعد المحتوى:
- استخدم فقط ما قدمه المستخدم من حقائق وأرقام وأسماء. ممنوع اختراع إحصاءات أو أسعار أو شهادات أو ضمانات.
- إن غابت الأرقام، لا تستخدم metrics أو chart أو table.
- عنوان الشريحة ≤ 9 كلمات. الفقرة ≤ 30 كلمة. النقطة ≤ 12 كلمة.
- لا تكرر الجملة نفسها بين شريحتين.
- بلا مبالغات: "الأفضل"، "لا تفوّت"، "جودة عالية".
- كل شريحة تحمل فكرة واحدة قابلة للاقتباس.

قواعد التصميم:
- لا تبدأ من قالب. اختر layout كل شريحة من محتواها.
- نوّع: لا تكرر layout نفسه أكثر من مرتين متتاليتين.
- غيّر الإيقاع: فاتح ثم غامق، هادئ ثم كثيف.
- الألوان: bg وink وaccent وaccent2. تباين قوي، بلا نيون.
- الخطوط من هذه القائمة فقط:
  ibm-plex-ar، amiri، cairo، tajawal، readex، noto-kufi، inter، space-grotesk، fraunces، dm-serif، jetbrains.
  للعربية اختر خطًا عربيًا.
- texture: none|dots|grid|rings|paper. density: airy|balanced|dense.
- لا تضع نصًا فوق نص.
- استخدم chart فقط إذا كانت هناك نسب أو أرقام حقيقية.
- استخدم media فقط إذا أرفق المستخدم صورة.
- لا تزد عن 4 بطاقات stats أو 4 نقاط.
- اجعل أول شريحة cover وآخر شريحة closing عادةً، إلا إذا كان المحتوى لا يحتاجهما.

${SCHEMA_AR}`;

const SCHEMA_EN = `
Return JSON only, with no text before or after it, in exactly this shape:
{
  "title": "Deck title",
  "theme": {
    "mood": "editorial|data|warm|bold|minimal|luxury|playful",
    "palette": { "bg": "#RRGGBB", "ink": "#RRGGBB", "accent": "#RRGGBB", "accent2": "#RRGGBB" },
    "fonts": { "display": "space-grotesk", "body": "inter" },
    "texture": "none|dots|grid|rings|paper",
    "density": "airy|balanced|dense"
  },
  "slides": [
    { "layout": "cover", "kicker": "...", "title": "...", "lead": "...", "meta": ["...", "..."] }
  ]
}

Fields per layout (use only what you need):
cover: kicker, title, lead, meta[]
statement: kicker, title, lead, quote
metrics: kicker, title, lead, hero{value,label}, stats[{value,label}], note
chart: kind:"bar"|"donut", kicker, title, lead, segments[{label,value,percent}], percent, label, stats[], callout, note
list: kind:"steps"|"timeline"|"checklist", kicker, title, lead, items[{title,text,label,tag}], quote, cta, note
table: kicker, title, lead, head[], rows[][], note
code: kicker, title, lead, items[{title,text}], code, quote
quote: kicker, text, by, context
chips: kicker, title, lead, chips[], stats[], note
media: kicker, title, lead, caption
closing: kicker, title, lead, points[], quote, cta
`;

const SYSTEM_EN = `You are an art director and social carousel writer. Turn any brief into 3–10 slides with a visual identity built for that brief — never a ready-made template.

Before writing, classify the content: product launch, lesson, data story, announcement, quote, how-to, comparison, event recap, job post, or something else.
Write in the brief's language. For English use clear, modern English.
Slide count: one idea per slide, 3–10. If the user names a count, follow it. Never pad.
Identity: four colours + two fonts + one texture + one density.

Content rules:
- Use only facts, numbers and names the user provided. Never invent statistics, prices, testimonials or guarantees.
- Without numbers, do not use metrics, chart or table.
- Slide title ≤ 9 words. Paragraph ≤ 30 words. Bullet ≤ 12 words.
- Never repeat the same sentence across slides.
- No clichés: "best", "don't miss", "high quality".
- Every slide carries one quotable idea.

Design rules:
- Do not start from a template. Choose each slide's layout from its content.
- Vary layouts: never repeat the same layout more than twice in a row.
- Vary rhythm: light then dark, calm then dense.
- Colours: bg, ink, accent, accent2. Strong contrast, no neon.
- Fonts only from:
  ibm-plex-ar, amiri, cairo, tajawal, readex, noto-kufi, inter, space-grotesk, fraunces, dm-serif, jetbrains.
  Use an Arabic font when the content is Arabic.
- texture: none|dots|grid|rings|paper. density: airy|balanced|dense.
- No text over text.
- Use chart only with real ratios or numbers.
- Use media only if the user attached a photo.
- Max 4 stat cards or 4 points.
- Usually open with cover and close with closing, unless the content does not need them.

${SCHEMA_EN}`;

const SYSTEM_PROMPTS = { ar: SYSTEM_AR, en: SYSTEM_EN };

function reply(lang, code, status) {
  const table = MESSAGES[lang] || MESSAGES.en;
  return new Response(JSON.stringify({ code, error: table[code] || table.invalid_request }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function normalizeLang(value) {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "ar";
}

function str(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function multiline(value, max) {
  return String(value == null ? "" : value).replace(/\r/g, "").trim().slice(0, max);
}

function cleanStats(stats) {
  if (!Array.isArray(stats)) return [];
  return stats.slice(0, 4).map((s) => ({
    value: str(s && s.value, 40),
    label: str(s && s.label, 60),
  })).filter((s) => s.value);
}

function cleanItems(items, max) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((it) => {
    if (typeof it === "string") {
      return { title: "", text: str(it, 160), hint: "", label: "", tag: "" };
    }
    return {
      title: str(it && it.title, 80),
      text: str(it && it.text, 160),
      hint: str(it && it.hint, 120),
      label: str(it && it.label, 24),
      tag: str(it && it.tag, 24),
    };
  }).filter((it) => it.title || it.text);
}

function cleanChips(chips) {
  if (!Array.isArray(chips)) return [];
  return chips.slice(0, 12).map((c) => (
    typeof c === "string" ? str(c, 40) : str(c && (c.label || c.text), 40)
  )).filter(Boolean);
}

function cleanSlide(input, lang, hasImage) {
  const s = input && typeof input === "object" ? input : {};
  let layout = LAYOUTS.has(s.layout) ? s.layout : "statement";

  const out = {
    layout,
    kicker: str(s.kicker, 80),
    title: multiline(s.title, 120),
    text: multiline(s.text, 240),
    lead: str(s.lead, 320),
    note: str(s.note, 240),
    quote: str(s.quote, 240),
    by: str(s.by, 80),
    context: str(s.context, 160),
    cta: str(s.cta, 80),
    callout: str(s.callout, 220),
  };

  if (layout === "cover") {
    out.meta = (Array.isArray(s.meta) ? s.meta : []).slice(0, 3).map((m) => str(m, 60)).filter(Boolean);
  }

  if (layout === "metrics") {
    if (s.hero && s.hero.value != null) out.hero = { value: str(s.hero.value, 40), label: str(s.hero.label, 80) };
    out.stats = cleanStats(s.stats);
    if (!out.hero && !out.stats.length) layout = "statement";
  }

  if (layout === "chart") {
    const kind = s.kind === "donut" || s.percent != null ? "donut" : "bar";
    out.kind = kind;
    if (kind === "donut") {
      out.percent = Math.max(0, Math.min(100, parseFloat(s.percent) || 0));
      out.label = str(s.label, 80);
      out.stats = cleanStats(s.stats);
      if (!s.percent) layout = "statement";
    } else {
      out.segments = (Array.isArray(s.segments) ? s.segments : []).slice(0, 4).map((x) => ({
        label: str(x && x.label, 60),
        value: str(x && x.value, 40),
        percent: Math.max(0, Math.min(100, parseFloat(x && x.percent) || 0)),
      })).filter((x) => x.label && x.percent > 0);
      if (!out.segments.length) layout = "statement";
    }
  }

  if (layout === "list") {
    out.kind = LIST_KINDS.has(s.kind) ? s.kind : "steps";
    out.items = cleanItems(s.items, out.kind === "timeline" ? 7 : 5);
    if (!out.items.length) layout = "statement";
  }

  if (layout === "table") {
    out.head = (Array.isArray(s.head) ? s.head : []).slice(0, 4).map((h) => str(h, 60)).filter(Boolean);
    out.rows = (Array.isArray(s.rows) ? s.rows : []).slice(0, 6).map((row) => (
      Array.isArray(row) ? row.slice(0, out.head.length).map((c) => str(c, 60)) : []
    )).filter((row) => row.length);
    if (!out.head.length || !out.rows.length) layout = "statement";
  }

  if (layout === "code") {
    out.code = multiline(s.code, 800);
    out.items = cleanItems(s.items, 3);
    if (!out.code) layout = "statement";
  }

  if (layout === "quote") {
    out.text = multiline(s.text || s.title, 240);
    if (!out.text) layout = "statement";
  }

  if (layout === "chips") {
    out.chips = cleanChips(s.chips);
    out.stats = cleanStats(s.stats);
    if (!out.chips.length) layout = "statement";
  }

  if (layout === "media" && !hasImage) layout = "statement";

  if (layout === "closing") {
    out.points = (Array.isArray(s.points) ? s.points : []).slice(0, 4).map((p) => (
      str(typeof p === "string" ? p : (p && (p.text || p.title)), 60)
    )).filter(Boolean);
  }

  out.layout = layout;
  return out;
}

function normalizeTheme(input, lang) {
  const t = input && typeof input === "object" ? input : {};
  const p = t.palette && typeof t.palette === "object" ? t.palette : {};
  const f = t.fonts && typeof t.fonts === "object" ? t.fonts : {};
  const palette = {};
  ["bg", "ink", "accent", "accent2"].forEach((k) => {
    if (HEX.test(String(p[k] || ""))) palette[k] = p[k];
  });
  const theme = {
    mood: str(t.mood, 24),
    palette,
    fonts: {
      display: str(f.display, 32) || (lang === "ar" ? "ibm-plex-ar" : "space-grotesk"),
      body: str(f.body, 32) || (lang === "ar" ? "ibm-plex-ar" : "inter"),
    },
    texture: ["none", "dots", "grid", "rings", "paper"].includes(t.texture) ? t.texture : "none",
    density: ["airy", "balanced", "dense"].includes(t.density) ? t.density : "balanced",
  };
  return theme;
}

export async function handleGenerate(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return reply("en", "invalid_request", 400);
  }

  const lang = normalizeLang(body.lang);
  const description = String(body.description || "").slice(0, 1400).trim();
  if (!description) return reply(lang, "empty_description", 400);
  if (!env.GROQ_API_KEY) return reply(lang, "no_key", 500);

  const handle = String(body.handle || "").slice(0, 30).trim();
  const hasImage = !!body.hasImage;
  const rawCount = parseInt(body.count, 10);
  const count = rawCount >= 3 && rawCount <= 10 ? rawCount : 0;

  let avoid = "";
  if (body.avoid) {
    avoid = typeof body.avoid === "string" ? body.avoid : JSON.stringify(body.avoid);
    avoid = avoid.slice(0, 700);
  }

  const userMessage = lang === "ar"
    ? [
        `طلب المستخدم: ${description}`,
        `لغة المحتوى المطلوبة: العربية الفصحى الحديثة.`,
        `اسم الحساب: ${handle || "غير محدد"}`,
        count ? `عدد الشرائح المطلوب: ${count}.` : `عدد الشرائح: اختر أنت بين 3 و10.`,
        hasImage ? `المستخدم أرفق صورة. يمكنك استخدام layout "media" مرة واحدة.` : `لا توجد صورة مرفقة؛ لا تستخدم layout "media".`,
        avoid ? `تجنّب هذا الاتجاه البصري من المحاولة السابقة: ${avoid}` : "",
      ].filter(Boolean).join("\n")
    : [
        `User brief: ${description}`,
        `Required content language: English.`,
        `Account handle: ${handle || "not set"}`,
        count ? `Requested slide count: ${count}.` : `Slide count: choose between 3 and 10.`,
        hasImage ? `The user attached a photo. You may use the "media" layout once.` : `No photo attached; do not use the "media" layout.`,
        avoid ? `Avoid this visual direction from the previous attempt: ${avoid}` : "",
      ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0.85,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[lang] },
          { role: "user", content: userMessage },
        ],
      }),
    });

    let data = null;
    try {
      data = await r.json();
    } catch (e) {
      return reply(lang, "upstream", 502);
    }

    if (!r.ok) {
      const text = data && data.error && data.error.message;
      return new Response(JSON.stringify({ code: "upstream_error", error: text || MESSAGES[lang].upstream }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    let parsed = null;
    try {
      const cleaned = String(text).replace(/```json|```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    } catch (e) {
      return reply(lang, "invalid_json", 502);
    }

    if (!parsed || !Array.isArray(parsed.slides)) return reply(lang, "incomplete", 502);
    const slides = parsed.slides
      .filter((s) => s && typeof s === "object")
      .slice(0, 10)
      .map((s) => cleanSlide(s, lang, hasImage));
    if (slides.length < 3) return reply(lang, "incomplete", 502);

    const theme = normalizeTheme(parsed.theme, lang);
    const spec = {
      language: lang,
      title: str(parsed.title, 120),
      theme,
      slides,
    };

    const rendered = renderDeck(spec, { handle, hasImage });

    return new Response(JSON.stringify({
      spec,
      html: rendered.html,
      meta: rendered.meta,
    }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return reply(lang, "network_error", 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate") {
      if (request.method !== "POST") {
        return reply(normalizeLang(url.searchParams.get("lang")), "method", 405);
      }
      return handleGenerate(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
