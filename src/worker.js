// src/worker.js
// Cloudflare Worker: يخدم الصفحة من مجلد public، ويشغّل /api/generate بمفتاح مخفي.

const LAYOUT_NAMES = ["frame", "editorial", "band", "circle", "card", "numeral", "header", "diagonal"];

/* قواعد التصميم مشتركة بين اللغتين */
const DESIGN_RULES = `
قواعد التصميم: ابتكر تصميمًا يناسب هذا المنتج بالذات.
- palette: لونان فقط بصيغة #RRGGBB. bg لون الخلفية (فاتح مثل كريمي أو رملي أو وردي ناعم أو أخضر باهت، أو غامق مثل كحلي أو أخضر غابي أو عنابي أو فحمي). accent لون التمييز المنسجم مع الخلفية والمعبّر عن روح المنتج. اختر ألوانًا هادئة ومريحة للعين، وممنوع الفاقعة. والكود يضبط التباين تلقائيًا.
- layout: شكل التصميم الهندسي، اختر واحدًا فقط:
  frame: إطار رفيع ونص في الوسط (كلاسيكي هادئ)
  editorial: نص جانبي مع خط عمودي (أنيق ومجلاتي)
  band: شريط ملوّن على الحافة ونص في الوسط (بسيط عصري)
  circle: دائرة ناعمة خلف النص (ودود وحيوي)
  card: بطاقة داخل إطار ملوّن عريض (حديث وجريء)
  numeral: رقم الشريحة كبير باهت ونص جانبي في الأسفل (جريء)
  header: شريط علوي ملوّن ونص في الوسط (رسمي ومرتب)
  diagonal: شريط مائل ناعم ونص جانبي (شبابي وحركي)
- يوجد في رسالة المستخدم تخطيط مقترح لهذه المرة، التزم به إلا إذا كان غير مناسب إطلاقًا للمنتج.
- imagePosition: "top" أو "bottom" فقط.
`;

const SCHEMA = `
ارجع JSON فقط، بدون أي كلام قبله أو بعده، وبهذا الشكل:
{
  "palette": { "bg": "#RRGGBB", "accent": "#RRGGBB" },
  "layout": "frame",
  "imagePosition": "top" أو "bottom",
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

Design rules: invent a look that fits this product.
- palette: exactly two colors as #RRGGBB. bg is the background — light (cream, sand, soft pink, pale green) or dark (navy, forest, maroon, charcoal). accent is the highlight color that matches the background and the product's mood. Calm, easy on the eyes, never neon. The code fixes contrast automatically.
- layout: pick exactly one:
  frame: thin frame, centered text (quiet classic)
  editorial: side text with a vertical rule (magazine-like)
  band: colored edge band, centered text (clean modern)
  circle: soft circle behind the text (friendly)
  card: content inside a thick colored border (bold modern)
  numeral: oversized faded slide number, side text at the bottom (bold)
  header: colored top bar, centered text (formal, tidy)
  diagonal: soft diagonal band, side text (youthful)
- The user message includes a suggested layout for this run; follow it unless it truly does not fit the product.
- imagePosition: "top" or "bottom" only.

Return JSON only, with no text before or after it, in exactly this shape:
{
  "palette": { "bg": "#RRGGBB", "accent": "#RRGGBB" },
  "layout": "frame",
  "imagePosition": "top",
  "slides": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;

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

  const layout = LAYOUT_NAMES[Math.floor(Math.random() * LAYOUT_NAMES.length)];

  const userMessage = lang === "ar"
    ? `طلب المستخدم (فيه المنتج وتفاصيله وربما السعر أو العرض أو الأسلوب): ${description}\n` +
      `لغة المحتوى المطلوبة: العربية الفصحى الحديثة.\n` +
      `التخطيط المقترح لهذه المرة: ${layout}`
    : `User request (product, details, and possibly price, offer or tone): ${description}\n` +
      `Required content language: English.\n` +
      `Suggested layout for this run: ${layout}`;

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
    const payload = {
      palette: parsed.palette && typeof parsed.palette === "object" ? parsed.palette : null,
      layout: LAYOUT_NAMES.includes(parsed.layout) ? parsed.layout : layout,
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
