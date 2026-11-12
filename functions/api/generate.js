// functions/api/generate.js
// نقطة توافق لـ Cloudflare Pages: تستخدم نفس منطق العامل الجديد في src/worker.js.
// المشروع الأساسي يُنشر عبر wrangler.jsonc، لكن هذا الملف يمنع بقاء نسخة قديمة
// إذا نُشر المشروع كـ Pages Functions.

import { handleGenerate } from "../../src/worker.js";

export async function onRequestPost({ request, env }) {
  return handleGenerate(request, env);
}

export async function onRequest() {
  return new Response(JSON.stringify({ code: "method", error: "This endpoint only accepts POST." }), {
    status: 405,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
