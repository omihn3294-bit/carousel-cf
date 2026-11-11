// src/worker.js
// Cloudflare Worker: يخدم الصفحة من مجلد public، ويشغّل /api/generate بمفتاح مخفي.

const LAYOUT_NAMES = ["editorial", "panel", "minimal", "corners", "ripple", "band", "grid", "rounded"];
const SHAPE_NAMES = ["rounded", "arch", "circle", "plain"];
const FONT_KEYS = ["a", "b", "c"];
const RHYTHMS = ["alternate", "alternate", "uniform"];

/* عائلات ألوان مقترحة، تُسحب عشوائيًا لكسر التكرار */
const HUES = {
  ar: ["أخضر زمردي عميق", "كحلي ليلي", "عنابي داكن", "رملي دافئ", "فحمي مع مريمية", "أزرق فولاذي", "بني ترابي", "أزرق سماوي هادئ", "بنفسجي داكن", "أخضر غابي مع ذهبي", "وردي باهت مع بني", "أبيض ناصع مع نحاسي"],
  en: ["deep emerald", "midnight navy", "dark burgundy", "warm sand", "charcoal with sage", "steel blue", "earthy brown", "calm sky blue", "deep violet", "forest green with gold", "blush pink with brown", "crisp white with copper"],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function pick(list, avoid) {
  const pool = list.filter((v) => v !== avoid);
  const src = pool.length ? pool : list;
  return src[Math.floor(Math.random() * src.length)];
}

/* قواعد التصميم */
const DESIGN_RULES = `
قواعد التصميم: صمّم هوية بصرية احترافية تناسب هذا المنتج بالذات، ولا تكرر تصميمًا نمطيًا.
- palette: ثلاثة ألوان بصيغة #RRGGBB.
  bg: لون الخلفية الأساسي للشريحتين الأولى والأخيرة.
  alt: لون الخلفية البديل للشريحتين الوسطيتين، ويجب أن يختلف في الدرجة عن bg (فاتح مقابل غامق).
  accent: لون تمييز منسجم يعبّر عن المنتج (ذهبي، نحاسي، مريمي، وردي...).
  اختر ألوانًا احترافية متناسقة تناسب مجال المنتج: العطور والمجوهرات ألوان داكنة مع لمسة معدنية، منتجات الأطفال ألوان مرحة صافية، التقنية ألوان باردة هادئة، القهوة والمطاعم ألوان ترابية دافئة، العناية والتجميل ألوان ناعمة. تجنب ألوان النيون. والكود يضبط التباين تلقائيًا.
- layout: واحد فقط من:
  editorial: إطار رفيع ونص جانبي (أنيق ومجلاتي)
  panel: لوحة جانبية برقم الشريحة (رسمي ومرتب)
  minimal: بسيط في الوسط (نقي وحديث)
  corners: زوايا مزخرفة ونص في الوسط (كلاسيكي فاخر)
  ripple: حلقات متداخلة فوق النص (هادئ ودافئ)
  band: شريط ملوّن على الحافة (عصري)
  grid: شبكة خطوط دقيقة (تقني)
  rounded: دوائر ناعمة وقوائم بكبسولات (مرح وودود)
- font: "a" عصري، "b" كلاسيكي أنيق، "c" هندسي.
- rhythm: "alternate" تتناوب الخلفيتان بين الشرائح، أو "uniform" خلفية واحدة.
- imageShape: "rounded" أو "arch" أو "circle" أو "plain".
- imagePosition: "top" أو "bottom".
- في رسالة المستخدم قيم مقترحة لهذه المرة (تخطيط وخط وشكل صورة وتناوب وعائلة ألوان). التزم بها إلا إذا كانت غير مناسبة إطلاقًا للمنتج.
`;

const SCHEMA = `
ارجع JSON فقط، بدون أي كلام قبله أو بعده، وبهذا الشكل:
{
  "palette": { "bg": "#RRGGBB", "alt": "#RRGGBB", "accent": "#RRGGBB" },
  "layout": "minimal",
  "font": "a",
  "rhythm": "alternate",
  "imageShape": "rounded",
  "imagePosition": "top",
  "slides": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;

const DESIGN_RULES_EN = `
Design rules: build a professional visual identity that fits this specific product. Never fall back to a generic look.
- palette: three colors as #RRGGBB.
  bg: main background for slides 1 and 4.
  alt: alternate background for slides 2 and 3; it must differ in tone from bg (light vs dark).
  accent: a highlight color that suits the product (gold, copper, sage, blush...).
  Choose refined, harmonious colors for the product's field: perfume and jewelry = dark tones with a metallic touch; kids' products = clear cheerful colors; tech = calm cool colors; coffee and food = warm earthy colors; beauty and care = soft tones. No neon. The code fixes contrast automatically.
- layout: pick exactly one:
  editorial: thin frame, side text (elegant, magazine-like)
  panel: side panel with the slide number (formal, tidy)
  minimal: clean and centered (pure, modern)
  corners: ornamental corners, centered text (classic luxury)
  ripple: concentric rings above the text (calm, warm)
  band: colored edge band (modern)
  grid: fine grid lines (technical)
  rounded: soft circles and pill-shaped lists (playful, friendly)
- font: "a" modern, "b" classic elegant, "c" geometric.
- rhythm: "alternate" (the two backgrounds alternate across slides) or "uniform" (one background).
- imageShape: "rounded", "arch", "circle" or "plain".
- imagePosition: "top" or "bottom".
- The user message includes suggested values for this run (layout, font, image shape, rhythm, color family). Follow them unless they truly do not fit the product.
`;

const SCHEMA_EN = `
Return JSON only, with no text before or after it, in exactly this shape:
{
  "palette": { "bg": "#RRGGBB", "alt": "#RRGGBB", "accent": "#RRGGBB" },
  "layout": "minimal",
  "font": "a",
  "rhythm": "alternate",
  "imageShape": "rounded",
  "imagePosition": "top",
  "slides": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;

const SYSTEM_PROMPT_AR = `أنت كاتب محتوى إعلاني محترف ومصمم منشورات متعددة الشرائح (Carousel) لمنصات التواصل الاجتماعي.
جمهورك عام: متحدثون بالعربية في أي بلد، ولا تفترض بلدًا أو عملة أو مناسبة محلية إلا إذا ذكرها المستخدم صراحةً.

اللغة: العربية الفصحى الحديثة، سهلة وواضحة وقريبة من لغة الإعلان الاحترافي. ممنوع استخدام اللهجة العامية أو المفردات الإقليمية.

قواعد الكتابة:
- ابدأ من فائدة حقيقية يشعر بها المشتري، ولا تكتب عبارات مبتذلة مثل "أفضل منتج" أو "جودة عالية" أو "لا تفوّت الفرصة".
- استخدم المعلومات التي كتبها المستخدم فقط. يُمنع اختراع أرقام أو مواصفات أو أسعار أو ضمانات أو عروض.
- إذا كانت المعلومات قليلة، اقتصر على الفوائد الواضحة لهذا النوع من المنتجات دون تفاصيل مخترعة.
- الجمل قصيرة ومباشرة، بلا حشو ولا تكرار.

الشرائح الأربع:
الشريحة 1 (الخطاف): عنوان من 3 إلى 5 كلمات، سؤال يلمس مشكلة أو وعد واضح يوقف التمرير. النص تحته جملة واحدة لا تتجاوز 10 كلمات.
الشريحة 2 (المشكلة والحل): عنوان قصير. النص جملتان: الأولى موقف يعيشه العميل، والثانية كيف يحل المنتج هذا الموقف.
الشريحة 3 (الفوائد): عنوان قصير. النص ثلاث فوائد، كل فائدة في سطر منفصل (افصل بينها بـ \\n) ولا تتجاوز 6 كلمات، وتبدأ بفعل أو بنتيجة يلمسها العميل لا بمواصفة جافة.
الشريحة 4 (الدعوة للإجراء): عنوان فعل واضح مثل "اطلبه اليوم". النص جملة واحدة تذكر السعر أو العرض فقط إذا ذكرهما المستخدم، وتنتهي بطريقة الطلب (مثل: راسلنا على واتساب). لا تصنع إلحاحًا وهميًا.
${DESIGN_RULES}${SCHEMA}`;

const SYSTEM_PROMPT_EN = `You are a professional social media copywriter and carousel designer.
Your audience is global: English speakers anywhere. Never assume a country, currency, holiday or local reference unless the user provides one.

Language: clear, modern English. Short sentences, confident tone, no filler.

Writing rules:
- Lead with a real benefit the buyer feels. Ban clichés like "best product", "high quality", "don't miss out".
- Use only the information the user gave you. Never invent numbers, specs, prices, guarantees or offers.
- If details are thin, stay with the obvious benefits of this product category. No invented specifics.
- Keep every sentence tight. No repetition.

The four slides:
Slide 1 (hook): a 3–5 word title — a question that touches a real problem or a clear promise that stops the scroll. One supporting line under 10 words.
Slide 2 (problem & solution): short title. Two sentences: a moment the customer lives through, then how the product resolves it.
Slide 3 (benefits): short title. Three benefits, each on its own line (separate with \\n), max 6 words each, starting with an action or an outcome the customer gets — not a dry spec.
Slide 4 (call to action): a clear verb title like "Order today". One line that mentions price or offer only if the user provided it, and ends with how to order (e.g. "Message us on WhatsApp"). Never fake urgency.

${DESIGN_RULES_EN}${SCHEMA_EN}`;

const SYSTEM_PROMPTS = { ar: SYSTEM_PROMPT_AR, en: SYSTEM_PROMPT_EN };

const MESSAGES = {
  ar: {
    no_key: "خدمة الذكاء الاصطناعي غير مهيأة على الخادم. أضف المفتاح ثم أعد المحاولة.",
    invalid_request: "تعذّر قراءة الطلب، أعد المحاولة.",
    empty_description: "اكتب وصف المنتج أولًا.",
    method: "يجب أن يكون الطلب POST.",
    upstream: "خدمة الذكاء الاصطناعي مشغولة الآن، جرّب بعد قليل.",
    invalid_json: "جاء الرد غير مكتمل، أعد الإنشاء.",
    incomplete: "جاء الرد ناقصًا، أعد الإنشاء.",
    network_error: "تعذّر الاتصال بالخدمة، جرّب بعد قليل.",
  },
  en: {
    no_key: "The AI service is not configured on the server yet.",
    invalid_request: "The request could not be read. Please try again.",
    empty_description: "Please describe your product first.",
    method: "This endpoint only accepts POST.",
    upstream: "The AI service is busy right now. Try again in a moment.",
    invalid_json: "The response came back incomplete. Generate again.",
    incomplete: "The response was incomplete. Generate again.",
    network_error: "Could not reach the service. Try again shortly.",
  },
};

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

async function handleGenerate(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return reply("en", "invalid_request", 400);
  }

  const lang = normalizeLang(body.lang);
  const description = String(body.description || "").slice(0, 1000).trim();

  if (!description) return reply(lang, "empty_description", 400);
  if (!env.GROQ_API_KEY) return reply(lang, "no_key", 500);

  const avoid = body.avoid && typeof body.avoid === "object" ? body.avoid : {};
  const layout = pick(LAYOUT_NAMES, avoid.layout);
  const font = pick(FONT_KEYS, avoid.font);
  const shape = pick(SHAPE_NAMES, avoid.shape);
  const rhythm = RHYTHMS[Math.floor(Math.random() * RHYTHMS.length)];
  const hue = HUES[lang][Math.floor(Math.random() * HUES[lang].length)];

  const userMessage = lang === "ar"
    ? `طلب المستخدم (فيه المنتج وتفاصيله وربما السعر أو العرض أو الأسلوب): ${description}\n` +
      `لغة المحتوى المطلوبة: العربية الفصحى الحديثة.\n` +
      `التصميم المقترح لهذه المرة: التخطيط ${layout}، الخط ${font}، شكل الصورة ${shape}، التناوب ${rhythm}، وعائلة الألوان المفضلة: ${hue}.`
    : `User request (product, details, and possibly price, offer or tone): ${description}\n` +
      `Required content language: English.\n` +
      `Suggested design for this run: layout ${layout}, font ${font}, image shape ${shape}, rhythm ${rhythm}, preferred color family: ${hue}.`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        // لو تغيّر اسم الموديل، عدّله من إعدادات Cloudflare (GROQ_MODEL) بدون تعديل الكود
        model: env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0.8,
        max_tokens: 2000,
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
    let parsed;
    try {
      parsed = JSON.parse(String(text).replace(/```json|```/g, "").trim());
    } catch (e) {
      return reply(lang, "invalid_json", 502);
    }

    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length < 4) {
      return reply(lang, "incomplete", 502);
    }

    // نعيد حقولًا منظّمة فقط، حتى لا يعتمد الواجه على شكل رد غير متوقع
    const pal = parsed.palette && typeof parsed.palette === "object" ? parsed.palette : {};
    const palette = {};
    ["bg", "alt", "accent"].forEach((k) => { if (HEX.test(String(pal[k] || ""))) palette[k] = pal[k]; });

    const payload = {
      palette: palette.bg ? palette : null,
      layout: LAYOUT_NAMES.includes(parsed.layout) ? parsed.layout : layout,
      font: FONT_KEYS.includes(parsed.font) ? parsed.font : font,
      rhythm: parsed.rhythm === "uniform" ? "uniform" : "alternate",
      imageShape: SHAPE_NAMES.includes(parsed.imageShape) ? parsed.imageShape : shape,
      imagePosition: parsed.imagePosition === "bottom" ? "bottom" : "top",
      lang,
      slides: parsed.slides.slice(0, 4).map((s) => ({
        title: String((s && s.title) || "").slice(0, 120),
        body: String((s && s.body) || "").slice(0, 400),
      })),
    };

    return new Response(JSON.stringify(payload), {
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
        return reply(normalizeLang(url.searchParams.get("lang")), "invalid_request", 405);
      }
      return handleGenerate(request, env);
    }

    // أي عنوان آخر: قدّم ملفات الصفحة من مجلد public
    return env.ASSETS.fetch(request);
  },
};
