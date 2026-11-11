// src/worker.js
// Cloudflare Worker: يخدم الصفحة من مجلد public، ويشغّل /api/generate بمفتاح مخفي.

const SYSTEM_PROMPT = `أنت كاتب إعلانات محترف لمنشورات إنستغرام لأصحاب المشاريع الصغيرة في سلطنة عمان ودول الخليج.
المطلوب: منشور تقليب (Carousel) من 4 شرائح. اللغة عربية بسيطة قريبة من لغة الناس اليومية في الخليج، وليست فصحى متكلفة.

قواعد الكتابة:
- ابدأ من فائدة حقيقية يحسها المشتري، ولا تكتب عبارات عامة مثل "أفضل منتج" أو "جودة عالية" أو "لا تفوّت الفرصة".
- استخدم فقط المعلومات التي كتبها المستخدم. ممنوع اختراع أرقام أو مواصفات أو أسعار أو ضمانات.
- إذا كانت المعلومات قليلة، استنتج فقط الفوائد الواضحة للنوع نفسه من المنتجات.
- الجمل قصيرة ومباشرة، بدون حشو.

الشريحة 1 (الخطاف): العنوان من 3 إلى 5 كلمات، سؤال يلمس مشكلة أو وعد واضح يوقف المتصفح. النص تحته جملة واحدة لا تتجاوز 10 كلمات.
الشريحة 2 (المشكلة والحل): العنوان قصير. النص جملتان: الأولى موقف يعيشه الزبون، والثانية كيف يحله المنتج.
الشريحة 3 (الفوائد): العنوان قصير. النص 3 فوائد، كل فائدة في سطر منفصل (افصل بينها بـ \\n) ولا تتجاوز 6 كلمات، وتبدأ بفعل أو بنتيجة يحصل عليها الزبون، وليست مجرد مواصفة.
الشريحة 4 (الدعوة للشراء): العنوان فعل واضح مثل "اطلبه الآن". النص جملة تذكر العرض أو السعر إذا كتبهما المستخدم فقط، وتنتهي بطريقة الطلب (مثل: راسلنا على واتساب). لا تضف إحساساً بالاستعجال إلا إذا كان هناك عرض مذكور.

قواعد التصميم: ابتكر تصميماً يناسب هذا المنتج بالذات.
- palette: لونان فقط بصيغة #RRGGBB. bg لون الخلفية (فاتح مثل كريمي أو رملي أو وردي ناعم أو أخضر باهت، أو غامق مثل كحلي أو أخضر غابي أو عنابي أو فحمي). accent لون التمييز المنسجم مع الخلفية والمعبّر عن روح المنتج. اختر ألواناً هادئة ومريحة للعين، وممنوع الفاقعة. والكود يضبط التباين تلقائياً.
- layout: شكل التصميم الهندسي، اختر واحداً فقط:
  frame: إطار رفيع ونص في الوسط (كلاسيكي هادئ)
  editorial: نص جانبي مع خط عمودي (أنيق ومجلاتي)
  band: شريط ملوّن على الحافة ونص في الوسط (بسيط عصري)
  circle: دائرة ناعمة خلف النص (ودود وحيوي)
  card: بطاقة داخل إطار ملوّن عريض (حديث وجريء)
  numeral: رقم الشريحة كبير باهت ونص جانبي في الأسفل (جريء)
  header: شريط علوي ملوّن ونص في الوسط (رسمي ومرتب)
  diagonal: شريط مائل ناعم ونص جانبي (شبابي وحركي)
- يوجد في رسالة المستخدم تخطيط مقترح لهذه المرة، التزم به إلا إذا كان غير مناسب إطلاقاً للمنتج.

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

const LAYOUT_NAMES = ["frame", "editorial", "band", "circle", "card", "numeral", "header", "diagonal"];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleGenerate(request, env) {
  const key = env.GROQ_API_KEY;
  if (!key) {
    return json({ error: "المفتاح GROQ_API_KEY غير موجود في إعدادات Cloudflare" }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "الطلب غير صالح" }, 400);
  }

  const description = String(body.description || "").slice(0, 1000).trim();
  if (!description) {
    return json({ error: "اكتب وصف المنشور أولاً" }, 400);
  }

  const userMessage =
    `طلب المستخدم (فيه المنتج وتفاصيله وربما السعر أو العرض أو الأسلوب): ${description}\n` +
    `التخطيط المقترح لهذه المرة: ${LAYOUT_NAMES[Math.floor(Math.random() * LAYOUT_NAMES.length)]}`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        // لو الموديل تغيّر اسمه، غيّره من إعدادات Cloudflare (GROQ_MODEL) بدون تعديل الكود
        model: env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return json({ error: (data && data.error && data.error.message) || "خطأ من Groq" }, 502);
    }

    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      return json({ error: "رد الذكاء الاصطناعي غير مرتب، جرّب مرة ثانية" }, 502);
    }
    if (!Array.isArray(parsed.slides) || parsed.slides.length < 4) {
      return json({ error: "الرد ناقص، جرّب مرة ثانية" }, 502);
    }
    return json(parsed);
  } catch (err) {
    return json({ error: "تعذّر الاتصال بالخدمة، جرّب بعد قليل" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate") {
      if (request.method !== "POST") {
        return json({ error: "يجب أن يكون الطلب POST" }, 405);
      }
      return handleGenerate(request, env);
    }
    // أي عنوان آخر: قدّم ملفات الصفحة من مجلد public
    return env.ASSETS.fetch(request);
  },
};
