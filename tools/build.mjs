#!/usr/bin/env node
import { readJson, writeText, parseArgs, fail, log } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const STORYBOARD = args.storyboard ?? "film/storyboard.json";
const sb = await readJson(STORYBOARD);
if (!sb?.chapters?.length) fail("No chapters.");

const W = 1920, H = 1080;

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function sceneHtml(scene, start, dur, idx) {
  const t = scene.type;
  const delay = 0.3;
  if (t === "chapter") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 200px;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);">
  <div style="font-size:24px;letter-spacing:6px;color:#6c63ff;opacity:0;transform:translateY(20px);" class="anim" data-delay="0">${esc(scene.kicker ?? "PART")}</div>
  <div style="font-size:140px;font-weight:800;margin-top:16px;line-height:1;opacity:0;transform:translateY(30px);" class="anim" data-delay="0.2">${esc(scene.title ?? "Chapter")}</div>
  <div style="width:80px;height:4px;background:#6c63ff;margin-top:30px;opacity:0;transform:scaleX(0);transform-origin:left;" class="anim-bar" data-delay="0.5"></div>
</div>`;
  }
  if (t === "statement") {
    const lines = String(scene.text ?? "").split("\n").map((l, i) =>
      `<div style="opacity:0;transform:translateY(24px);" class="anim" data-delay="${0.1 + i * 0.15}">${esc(l)}</div>`).join("");
    const accent = scene.accent ? "color:#6c63ff;" : "";
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 240px;background:#0a0a0a;">
  <div style="font-size:84px;font-weight:700;line-height:1.15;${accent}">${lines}</div>
</div>`;
  }
  if (t === "stat") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0a0a0a;">
  <div style="font-size:220px;font-weight:800;color:#6c63ff;opacity:0;transform:scale(0.8);" class="anim" data-delay="0">${esc(String(scene.value ?? 0))}${esc(scene.suffix ?? "")}</div>
  <div style="font-size:36px;margin-top:20px;opacity:0.7;max-width:800px;text-align:center;" class="anim" data-delay="0.3">${esc(scene.label ?? "")}</div>
  ${scene.bar != null ? `<div style="width:400px;height:6px;background:#222;margin-top:30px;border-radius:3px;overflow:hidden;"><div style="width:0%;height:100%;background:#6c63ff;" class="anim-bar2" data-pct="${Math.round((scene.bar ?? 0.5) * 100)}" data-delay="0.5"></div></div>` : ""}
</div>`;
  }
  if (t === "list") {
    const items = (scene.items ?? []).map((it, i) =>
      `<li style="margin:16px 0;opacity:0;transform:translateX(-30px);" class="anim" data-delay="${0.2 + i * 0.15}">${esc(it)}</li>`).join("");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 240px;background:#0a0a0a;">
  <div style="font-size:28px;letter-spacing:4px;color:#6c63ff;margin-bottom:30px;opacity:0;" class="anim" data-delay="0">${esc(scene.kicker ?? "")}</div>
  <ul style="list-style:none;padding:0;font-size:48px;font-weight:500;">${items}</ul>
</div>`;
  }
  if (t === "quote") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 280px;text-align:center;background:#0a0a0a;">
  <div style="font-size:44px;font-style:italic;line-height:1.4;opacity:0;" class="anim" data-delay="0">"${esc(scene.quote ?? "")}"</div>
  <div style="font-size:28px;margin-top:40px;opacity:0;color:#6c63ff;" class="anim" data-delay="0.4">— ${esc(scene.attribution ?? "")}</div>
</div>`;
  }
  if (t === "outro") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);">
  <div style="font-size:72px;font-weight:700;opacity:0;transform:translateY(20px);" class="anim" data-delay="0">${esc(scene.text ?? "")}</div>
  <div style="font-size:32px;margin-top:20px;opacity:0;color:#6c63ff;" class="anim" data-delay="0.3">${esc(scene.sub ?? "")}</div>
</div>`;
  }
  return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;justify-content:center;align-items:center;font-size:48px;">${esc(scene.text ?? "")}</div>`;
}

function buildComposition(chapter) {
  let cursor = 0;
  const scenes = [];
  for (const s of chapter.scenes ?? []) {
    const dur = Number(s.duration) || 5;
    scenes.push(sceneHtml(s, cursor, dur));
    cursor += dur;
  }
  const dur = cursor;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(chapter.title ?? "Chapter")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #f5f5f5; font-family: 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; overflow: hidden; }
  .clip { position: absolute; inset: 0; }
</style>
</head>
<body>
<div data-composition-id="${chapter.id}" data-width="${W}" data-height="${H}" data-start="0" data-duration="${dur}" data-fps="30" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;">
${scenes.join("\n")}
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  document.querySelectorAll('.anim').forEach((el) => {
    const d = parseFloat(el.dataset.delay || 0);
    gsap.set(el, { opacity: 0, y: 24 });
    tl.to(el, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, d);
  });
  document.querySelectorAll('.anim-bar').forEach((el) => {
    const d = parseFloat(el.dataset.delay || 0);
    gsap.set(el, { scaleX: 0 });
    tl.to(el, { scaleX: 1, duration: 0.8, ease: "power2.out" }, d);
  });
  document.querySelectorAll('.anim-bar2').forEach((el) => {
    const d = parseFloat(el.dataset.delay || 0);
    const pct = el.dataset.pct || 0;
    gsap.set(el, { width: "0%" });
    tl.to(el, { width: pct + "%", duration: 1, ease: "power2.out" }, d);
  });
  window.__timelines["${chapter.id}"] = tl;
</script>
</body>
</html>`;
}

let total = 0;
for (const ch of sb.chapters) {
  const html = buildComposition(ch);
  await writeText(`compositions/${ch.id}.html`, html);
  const d = (ch.scenes ?? []).reduce((a, s) => a + (Number(s.duration) || 0), 0);
  total += d;
  log(`  ${ch.id}: ${d.toFixed(1)}s`);
}

const mounts = sb.chapters.map((ch) => `<div data-composition-src="compositions/${ch.id}.html" data-composition-id="${ch.id}"></div>`).join("\n");
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${esc(sb.meta?.title ?? "Film")}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a0a;}</style>
</head>
<body>
${mounts}
</body>
</html>`;
await writeText("index.html", indexHtml);

log(`\n  ${sb.chapters.length} chapter(s)  ${total.toFixed(1)}s film\n`);
