#!/usr/bin/env node
/**
 * build.mjs — storyboard.json -> compositions/*.html + index.html
 */
import { readJson, writeText, parseArgs, fail, log } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const STORYBOARD = args.storyboard ?? "film/storyboard.json";

const sb = await readJson(STORYBOARD);
if (!sb?.chapters?.length) fail("No chapters in storyboard.");

const W = 1920, H = 1080;

function sceneHtml(scene, start, dur) {
  const t = scene.type;
  if (t === "chapter") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;">
  <div style="font-size:28px;letter-spacing:4px;opacity:0.6;">${scene.kicker ?? "PART"}</div>
  <div style="font-size:120px;font-weight:700;margin-top:20px;">${scene.title ?? "Chapter"}</div>
</div>`;
  }
  if (t === "statement") {
    const lines = String(scene.text ?? "").split("\n").map((l) => `<div>${l}</div>`).join("");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;font-size:72px;font-weight:600;text-align:center;">
  ${lines}
</div>`;
  }
  if (t === "stat") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;">
  <div style="font-size:200px;font-weight:700;">${scene.value ?? 0}${scene.suffix ?? ""}</div>
  <div style="font-size:32px;margin-top:20px;opacity:0.7;">${scene.label ?? ""}</div>
</div>`;
  }
  if (t === "list") {
    const items = (scene.items ?? []).map((it) => `<li style="margin:10px 0;">${it}</li>`).join("");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 200px;font-size:48px;">
  <div style="font-size:28px;letter-spacing:3px;opacity:0.6;margin-bottom:20px;">${scene.kicker ?? ""}</div>
  <ul style="list-style:none;padding:0;">${items}</ul>
</div>`;
  }
  if (t === "quote") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 240px;text-align:center;">
  <div style="font-size:48px;font-style:italic;">"${scene.quote ?? ""}"</div>
  <div style="font-size:28px;margin-top:30px;opacity:0.6;">${scene.attribution ?? ""}</div>
</div>`;
  }
  if (t === "outro") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
  <div style="font-size:80px;font-weight:700;">${scene.text ?? ""}</div>
  <div style="font-size:32px;margin-top:20px;opacity:0.6;">${scene.sub ?? ""}</div>
</div>`;
  }
  return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0" style="position:absolute;inset:0;display:flex;justify-content:center;align-items:center;font-size:48px;">${scene.text ?? ""}</div>`;
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
<title>${chapter.title ?? "Chapter"}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #f5f5f5; font-family: 'Helvetica Neue', Arial, sans-serif; overflow: hidden; }
  .clip { position: absolute; }
</style>
</head>
<body>
<div data-composition-id="${chapter.id}" data-width="${W}" data-height="${H}" data-start="0" data-duration="${dur}" data-fps="30" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;">
${scenes.join("\n")}
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  window.__timelines["${chapter.id}"] = gsap.timeline({ paused: true });
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

// index.html shell
const mounts = sb.chapters.map((ch) => `<div data-composition-src="compositions/${ch.id}.html" data-composition-id="${ch.id}"></div>`).join("\n");
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${sb.meta?.title ?? "Film"}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a0a;}</style>
</head>
<body>
${mounts}
<script src="https://cdn.jsdelivr.net/npm/hyperframes-runtime@latest/dist/index.js"></script>
</body>
</html>`;
await writeText("index.html", indexHtml);

log(`\n  ${sb.chapters.length} chapter(s)  ${total.toFixed(1)}s film\n`);
