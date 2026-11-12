/* public/app.js — واجهة استوديو الشرائح: توليد، عرض، وتصدير PNG. */

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

const ICON_DOWNLOAD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>';

const FONT_FAMILY = {
  "ibm-plex-ar": "IBM Plex Sans Arabic",
  "amiri": "Amiri",
  "cairo": "Cairo",
  "tajawal": "Tajawal",
  "readex": "Readex Pro",
  "noto-kufi": "Noto Kufi Arabic",
  "inter": "Inter",
  "space-grotesk": "Space Grotesk",
  "fraunces": "Fraunces",
  "dm-serif": "DM Serif Display",
  "jetbrains": "JetBrains Mono",
};

const I18N = {
  ar: {
    title: "استوديو الشرائح — أي فكرة، إلى شرائح مصممة",
    metaDesc: "حوّل أي فكرة أو درس أو بيانات أو منتج إلى شرائح مصممة بالذكاء الاصطناعي، بعدد متغيّر وهوية لكل طلب.",
    brand: "استوديو الشرائح",
    langGroup: "اختيار اللغة",
    themeToDark: "التبديل إلى الوضع الليلي",
    themeToLight: "التبديل إلى الوضع النهاري",
    heroTitle: "ماذا تريد أن تصمّم اليوم؟",
    heroLead: "صف فكرة، درسًا، تحليل بيانات، منتجًا، أو اقتباسًا. المحرك يختار عدد الشرائح والهوية والتكوين — لا قالب جاهز.",
    descLabel: "وصف الفكرة",
    descPlaceholder: "مثال: دليل من 5 شرائح لطلاب الجامعة عن تنظيم الوقت، بأسلوب هادئ وعملي…",
    handlePlaceholder: "حسابك (اختياري)",
    countLabel: "عدد الشرائح",
    auto: "تلقائي",
    attach: "أرفق صورة",
    removePhoto: "إزالة الصورة",
    generate: "أنشئ الشرائح",
    generating: "أقرأ الطلب، أختار الهوية، وأبني الشرائح…",
    redesigning: "أبني اتجاهًا بصريًا مختلفًا…",
    exporting: "أصدّر الصورة…",
    hint: "3–10 شرائح. اكتب عددًا إن أردت، أو اترك العدد للمحرك.",
    hintTouch: "3–10 شرائح. اترك العدد للمحرك أو اذكره في الوصف.",
    resultsTitle: "شرائحك جاهزة",
    resultsSub: "عدد متغيّر، هوية لكل طلب، وتكوين مختلف لكل شريحة.",
    downloadAll: "تحميل الكل",
    restyle: "تصميم آخر",
    downloadSlide: "تحميل",
    noteSwitch: "هذه الشرائح كُتبت بلغة أخرى. لإنشاء نسخة بلغتك، اختر اللغة ثم أعد الإنشاء.",
    imageReady: "الصورة جاهزة — أعد الإنشاء لتظهر داخل الشرائح.",
    footer: "لا تُخزَّن أوصافك ولا صورك. تبقى الصورة على جهازك ولا تُرسل إلى الخادم.",
    errors: {
      empty: "اكتب وصف الفكرة أولًا.",
      empty_description: "اكتب وصف الفكرة أولًا.",
      no_key: "خدمة الذكاء الاصطناعي غير مهيأة على الخادم. أضف المفتاح ثم أعد المحاولة.",
      invalid_request: "تعذّر قراءة الطلب، أعد المحاولة.",
      upstream: "خدمة الذكاء الاصطناعي مشغولة الآن، جرّب بعد قليل.",
      upstream_error: "خدمة الذكاء الاصطناعي مشغولة الآن، جرّب بعد قليل.",
      invalid_json: "جاء الرد غير مكتمل، أعد الإنشاء.",
      incomplete: "جاء الرد ناقصًا، أعد الإنشاء.",
      network_error: "تعذّر الاتصال، تحقق من الشبكة ثم أعد المحاولة.",
      export: "تعذّر تصدير الصورة. انتظر تحميل الخطوط ثم حاول مرة أخرى.",
      generic: "حدث خطأ غير متوقع، جرّب مرة أخرى.",
    },
    examples: [
      { label: "درس مصوّر", text: "دليل من 5 شرائح لطلاب الثانوية عن الاستعداد للاختبارات في سبعة أيام. أريد أسلوبًا هادئًا وعمليًا، بخط عربي كلاسيكي." },
      { label: "تحليل بيانات", text: "تحليل من 6 شرائح لملكية الشركات في سوق مسقط: 541 ورقة مالية، 353 شركة، 116 جهة حكومية، 72 مستثمرًا فردًا. أريد أسلوبًا تحريريًا فاخرًا." },
      { label: "إعلان منتج", text: "عطر عود فاخر يدوم 12 ساعة، مناسب للهدايا، سعره 39 دولارًا مع توصيل مجاني. أريد أسلوبًا فخمًا." },
      { label: "اقتباس", text: "ثلاث شرائح عن الانضباط: أقوال قصيرة، مساحة بيضاء، وأسلوب طباعي حاد." },
    ],
  },
  en: {
    title: "Slide Studio — any idea, designed into slides",
    metaDesc: "Turn any idea, lesson, dataset, product or quote into designed slides with a variable count and a fresh identity for every brief.",
    brand: "Slide Studio",
    langGroup: "Choose language",
    themeToDark: "Switch to dark mode",
    themeToLight: "Switch to light mode",
    heroTitle: "What should we design today?",
    heroLead: "Describe an idea, a lesson, a data story, a product, or a quote. The engine chooses the slide count, identity and composition — no template.",
    descLabel: "Idea description",
    descPlaceholder: "Example: a 5-slide guide for university students on managing their time, calm and practical…",
    handlePlaceholder: "Your handle (optional)",
    countLabel: "Slides",
    auto: "Auto",
    attach: "Add photo",
    removePhoto: "Remove photo",
    generate: "Create slides",
    generating: "Reading the brief, choosing the identity, building the slides…",
    redesigning: "Building a different visual direction…",
    exporting: "Exporting the image…",
    hint: "3–10 slides. Name a count if you like, or let the engine decide.",
    hintTouch: "3–10 slides. Let the engine decide, or mention a count in the brief.",
    resultsTitle: "Your slides are ready",
    resultsSub: "A variable count, a fresh identity per brief, and a different composition for each slide.",
    downloadAll: "Download all",
    restyle: "New design",
    downloadSlide: "Download",
    noteSwitch: "These slides were written in another language. Pick your language and generate again for a localised version.",
    imageReady: "Photo ready — generate again to include it in the slides.",
    footer: "Your descriptions and images are never stored. Your photo stays on your device and is never uploaded.",
    errors: {
      empty: "Please describe your idea first.",
      empty_description: "Please describe your idea first.",
      no_key: "The AI service is not configured on the server yet.",
      invalid_request: "The request could not be read. Please try again.",
      upstream: "The AI service is busy right now. Try again in a moment.",
      upstream_error: "The AI service is busy right now. Try again in a moment.",
      invalid_json: "The response came back incomplete. Generate again.",
      incomplete: "The response was incomplete. Generate again.",
      network_error: "Connection failed. Check your network and try again.",
      export: "Could not export the image. Wait for fonts to load and try again.",
      generic: "Something went wrong. Please try again.",
    },
    examples: [
      { label: "Study guide", text: "A 5-slide study guide for high-school students on preparing for exams in seven days. Calm, practical, classic Arabic type." },
      { label: "Data story", text: "A 6-slide analysis of company ownership in the Muscat stock market: 541 securities, 353 companies, 116 government entities, 72 individuals. Editorial and premium." },
      { label: "Product launch", text: "A premium oud fragrance that lasts 12 hours, a gift, $39 with free shipping. Luxurious feel." },
      { label: "Quote deck", text: "Three slides on discipline: short lines, white space, sharp typography." },
    ],
  },
};

const state = {
  lang: root.lang === "en" ? "en" : "ar",
  theme: root.dataset.theme === "light" ? "light" : "dark",
  img: null,
  last: null,
  busy: false,
};

const els = {
  desc: $("desc"), counter: $("counter"), chips: $("chips"),
  photo: $("photo"), composer: $("composer"), thumb: $("thumb"), fileName: $("fileName"),
  attachRow: $("attachRow"), removePhoto: $("removePhoto"), handle: $("handle"), count: $("count"),
  go: $("go"), msg: $("msg"), results: $("results"), slides: $("slides"),
  note: $("resultNote"), all: $("all"), restyle: $("restyle"), themeBtn: $("themeBtn"),
};

const dict = () => I18N[state.lang];

function savePrefs() {
  try {
    localStorage.setItem("carousel-prefs", JSON.stringify({
      lang: state.lang,
      theme: state.theme,
      handle: (els.handle.value || "").trim(),
    }));
  } catch (e) {}
}

/* --------------------------------- language -------------------------------- */
function applyLang(lang, opts) {
  state.lang = lang;
  const d = I18N[lang];
  root.lang = lang;
  root.dir = lang === "en" ? "ltr" : "rtl";
  document.title = d.title;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", d.metaDesc);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = d[el.dataset.i18n];
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", d[el.dataset.i18nPh] || "");
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", d[el.dataset.i18nAria] || "");
  });

  const hint = document.querySelector(".hint");
  if (hint) hint.textContent = isTouch ? d.hintTouch : d.hint;

  els.go.title = d.generate;
  els.removePhoto.title = d.removePhoto;
  if (els.count && els.count.options.length) els.count.options[0].textContent = d.auto;

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });

  buildChips();
  updateCounter();
  updateThemeLabel();
  if (state.last) {
    els.note.hidden = state.last.lang === state.lang;
    els.note.textContent = d.noteSwitch;
  }
  if (!opts || opts.save !== false) savePrefs();
}

function buildChips() {
  const d = dict();
  els.chips.innerHTML = "";
  d.examples.forEach((ex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = ex.label;
    btn.addEventListener("click", () => {
      els.desc.value = ex.text;
      updateCounter();
      autosize();
      els.desc.focus();
    });
    els.chips.appendChild(btn);
  });
}

/* --------------------------------- theme ---------------------------------- */
function applyTheme(theme, opts) {
  state.theme = theme;
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#090a12" : "#f5f6fd");
  updateThemeLabel();
  if (!opts || opts.save !== false) savePrefs();
}

function updateThemeLabel() {
  const d = dict();
  const toDark = state.theme === "light";
  els.themeBtn.setAttribute("aria-pressed", String(!toDark));
  els.themeBtn.setAttribute("aria-label", toDark ? d.themeToDark : d.themeToLight);
  els.themeBtn.title = toDark ? d.themeToDark : d.themeToLight;
}

/* -------------------------------- composer -------------------------------- */
function updateCounter() {
  const n = els.desc.value.length;
  els.counter.textContent = n ? n + " / 1400" : "";
  els.counter.classList.toggle("near", n > 1250);
}

function autosize() {
  els.desc.style.height = "auto";
  els.desc.style.height = Math.min(els.desc.scrollHeight, 240) + "px";
}

els.desc.addEventListener("input", () => { updateCounter(); autosize(); });

function setStatus(text, isErr, busy) {
  els.msg.textContent = text || "";
  els.msg.className = "status" + (isErr ? " err" : "") + (busy ? " busy" : "");
}

function setFile(file) {
  if (!file) {
    state.img = null;
    els.photo.value = "";
    els.attachRow.hidden = true;
    els.thumb.removeAttribute("src");
    els.fileName.textContent = "";
    if (state.last) renderResults();
    return;
  }
  if (!file.type.startsWith("image/")) { setStatus(dict().errors.generic, true); return; }
  const img = new Image();
  img.onload = () => {
    state.img = img;
    els.thumb.src = img.src;
    els.fileName.textContent = file.name;
    els.attachRow.hidden = false;
    if (state.last) {
      setStatus(dict().imageReady, false);
    }
  };
  img.onerror = () => setStatus(dict().errors.generic, true);
  img.src = URL.createObjectURL(file);
}

els.photo.addEventListener("change", (e) => setFile(e.target.files && e.target.files[0]));
els.removePhoto.addEventListener("click", () => setFile(null));
els.handle.addEventListener("change", savePrefs);

["dragenter", "dragover"].forEach((evt) => {
  els.composer.addEventListener(evt, (e) => { e.preventDefault(); els.composer.classList.add("is-drag"); });
});
["dragleave", "dragend"].forEach((evt) => {
  els.composer.addEventListener(evt, () => els.composer.classList.remove("is-drag"));
});
els.composer.addEventListener("drop", (e) => {
  e.preventDefault();
  els.composer.classList.remove("is-drag");
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) setFile(file);
});

/* --------------------------------- fonts ---------------------------------- */
async function ensureFonts(keys) {
  if (!document.fonts || !document.fonts.load) return;
  const families = [...new Set((keys || []).map((k) => FONT_FAMILY[k]).filter(Boolean))];
  try {
    await Promise.all(families.flatMap((f) => [
      document.fonts.load('700 80px "' + f + '"'),
      document.fonts.load('400 40px "' + f + '"'),
    ]));
    await document.fonts.ready;
  } catch (e) {}
}

/* --------------------------------- render --------------------------------- */
function renderResults() {
  if (!state.last) return;
  const d = dict();
  const { html, meta } = state.last;

  els.slides.innerHTML = "";
  html.forEach((slideHtml, i) => {
    const card = document.createElement("article");
    card.className = "slide-card";

    const head = document.createElement("div");
    head.className = "slide-head";
    const idx = document.createElement("span");
    idx.className = "slide-index";
    idx.textContent = String(i + 1).padStart(2, "0");
    const role = document.createElement("span");
    role.className = "slide-role";
    role.textContent = (meta.roles && meta.roles[i]) || "";
    head.append(idx, role);

    const shell = document.createElement("div");
    shell.className = "slide-shell";
    const scale = document.createElement("div");
    scale.className = "slide-scale";
    scale.innerHTML = slideHtml;
    shell.appendChild(scale);

    const foot = document.createElement("div");
    foot.className = "slide-foot";
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "btn-ghost";
    dl.innerHTML = ICON_DOWNLOAD;
    const label = document.createElement("span");
    label.textContent = d.downloadSlide;
    dl.appendChild(label);
    dl.addEventListener("click", () => downloadSlide(scale.querySelector(".slide"), i));
    foot.appendChild(dl);

    card.append(head, shell, foot);
    els.slides.appendChild(card);
  });

  els.results.classList.add("show");
  els.note.hidden = state.last.lang === state.lang;
  els.note.textContent = d.noteSwitch;

  fillMedia();
  requestAnimationFrame(fitSlides);
}

function fillMedia() {
  const has = !!state.img;
  document.querySelectorAll(".slide .media-slot").forEach((slot) => {
    slot.innerHTML = "";
    if (!has) return;
    const img = document.createElement("img");
    img.src = state.img.src;
    img.alt = "";
    slot.appendChild(img);
  });

  if (!has) {
    document.querySelectorAll(".cover-media").forEach((el) => el.remove());
    document.querySelectorAll(".cover-main.has-media").forEach((el) => el.classList.remove("has-media"));
    document.querySelectorAll(".media-shot").forEach((el) => el.remove());
  }
}

function fitSlides() {
  document.querySelectorAll(".slide-shell").forEach((shell) => {
    const scale = shell.querySelector(".slide-scale");
    if (!scale) return;
    const w = shell.clientWidth;
    if (w > 0) scale.style.transform = "scale(" + (w / 1080) + ")";
  });
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitSlides, 80);
});

/* --------------------------------- export --------------------------------- */
async function downloadSlide(slideEl, i) {
  if (!slideEl) return false;
  const d = dict();
  if (!window.htmlToImage || typeof window.htmlToImage.toPng !== "function") {
    setStatus(d.errors.export, true);
    return false;
  }
  try {
    setStatus(d.exporting, false, true);
    await ensureFonts(state.last && state.last.meta ? state.last.meta.fonts : []);
    const bg = getComputedStyle(slideEl).backgroundColor;
    const url = await window.htmlToImage.toPng(slideEl, {
      width: 1080,
      height: 1350,
      canvasWidth: 1080,
      canvasHeight: 1350,
      pixelRatio: 1,
      backgroundColor: bg,
      cacheBust: true,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "carousel-" + String(i + 1).padStart(2, "0") + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("");
    return true;
  } catch (e) {
    setStatus(d.errors.export, true);
    return false;
  }
}

els.all.addEventListener("click", async () => {
  const slides = [...document.querySelectorAll(".slide-card .slide")];
  if (!slides.length) return;
  els.all.disabled = true;
  for (let i = 0; i < slides.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await downloadSlide(slides[i], i);
    if (!ok) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 450));
  }
  els.all.disabled = false;
});

/* --------------------------------- generate -------------------------------- */
async function runGenerate(description, opts) {
  if (state.busy) return;
  const options = opts || {};
  const d = dict();
  state.busy = true;
  els.go.disabled = true;
  els.go.classList.add("is-loading");
  els.restyle.disabled = true;
  setStatus(options.restyle ? d.redesigning : d.generating, false, true);

  try {
    const payload = {
      description,
      lang: options.lang || state.lang,
      handle: (els.handle.value || "").trim(),
      hasImage: !!state.img,
      avoid: options.avoid || "",
    };
    if (els.count.value !== "auto") payload.count = Number(els.count.value);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try { data = await res.json(); } catch (e) {}

    if (!res.ok) {
      const code = data && data.code;
      setStatus((code && d.errors[code]) || (data && data.error) || d.errors.generic, true);
      return;
    }
    if (!data || !Array.isArray(data.html) || !data.html.length || !data.meta) {
      setStatus(d.errors.incomplete, true);
      return;
    }

    state.last = {
      html: data.html,
      meta: data.meta,
      spec: data.spec || null,
      lang: data.meta.lang || payload.lang,
      description,
      handle: payload.handle,
    };

    await ensureFonts(data.meta.fonts);
    renderResults();
    setStatus("");
    if (!options.restyle) els.results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    setStatus(d.errors.network_error, true);
  } finally {
    state.busy = false;
    els.go.disabled = false;
    els.go.classList.remove("is-loading");
    els.restyle.disabled = false;
  }
}

els.go.addEventListener("click", () => {
  const description = els.desc.value.trim();
  if (!description) {
    setStatus(dict().errors.empty, true);
    els.desc.focus();
    return;
  }
  runGenerate(description);
});

els.desc.addEventListener("keydown", (e) => {
  if (e.isComposing) return;
  const submit = e.key === "Enter" && (e.ctrlKey || e.metaKey || (!e.shiftKey && !isTouch));
  if (submit) { e.preventDefault(); els.go.click(); }
});

els.restyle.addEventListener("click", () => {
  if (!state.last || state.busy) return;
  let avoid = "";
  const spec = state.last.spec;
  if (spec && spec.theme) {
    avoid = JSON.stringify({
      palette: spec.theme.palette,
      fonts: spec.theme.fonts,
      layouts: (spec.slides || []).map((s) => s.layout),
    }).slice(0, 700);
  }
  runGenerate(state.last.description, { avoid, lang: state.last.lang, restyle: true });
});

/* ---------------------------------- boot ---------------------------------- */
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.lang !== state.lang) applyLang(btn.dataset.lang);
  });
});

els.themeBtn.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

try {
  const saved = JSON.parse(localStorage.getItem("carousel-prefs") || "{}");
  if (saved.handle) els.handle.value = saved.handle;
} catch (e) {}

applyLang(state.lang, { save: false });
applyTheme(state.theme, { save: false });
autosize();

document.fonts.ready.then(() => requestAnimationFrame(fitSlides));
