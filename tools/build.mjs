#!/usr/bin/env node
import { readJson, writeText, parseArgs, fail, log } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const STORYBOARD = args.storyboard ?? "film/storyboard.json";
const sb = await readJson(STORYBOARD);
if (!sb?.chapters?.length) fail("No chapters.");

const W = 1920, H = 1080;
const ACCENT = "#ff3366";
const ACCENT2 = "#ffcc00";

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function splitWords(text) {
  return String(text ?? "").split(/\s+/).filter(Boolean);
}

function kineticText(text, baseDelay, size, weight, color, align) {
  const words = splitWords(text);
  return words.map((w, i) => {
    const d = baseDelay + i * 0.08;
    return `<span style="display:inline-block;opacity:0;transform:translateY(40px) rotateX(15deg);filter:blur(4px);" class="kw" data-delay="${d}">${esc(w)}</span>`;
  }).join(" ");
}

function sceneHtml(scene, start, dur, idx) {
  const t = scene.type;

  if (t === "chapter") {
    const titleWords = splitWords(scene.title ?? "Chapter");
    const titleSpans = titleWords.map((w, i) =>
      `<span style="display:inline-block;opacity:0;transform:translateY(60px);" class="kw" data-delay="${0.4 + i * 0.12}">${esc(w)}</span>`).join(" ");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 180px;background:linear-gradient(160deg,#050505 0%,#0f0f1a 50%,#050505 100%);overflow:hidden;">
  <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle at 20% 50%,${ACCENT}15 0%,transparent 60%);"></div>
  <div style="font-size:20px;letter-spacing:8px;color:${ACCENT};opacity:0;transform:translateX(-40px);" class="kw" data-delay="0">${esc(scene.kicker ?? "PART")}</div>
  <div style="font-size:160px;font-weight:900;margin-top:12px;line-height:0.95;letter-spacing:-4px;">${titleSpans}</div>
  <div style="width:0px;height:3px;background:${ACCENT};margin-top:40px;" class="kw-bar" data-delay="0.9" data-width="120"></div>
  <div style="font-size:24px;margin-top:30px;opacity:0;color:rgba(255,255,255,0.5);" class="kw" data-delay="1.1">${esc(scene.title ?? "")}</div>
</div>`;
  }

  if (t === "statement") {
    const lines = String(scene.text ?? "").split("\n");
    const accent = scene.accent ? `color:${ACCENT};` : "";
    const allWords = lines.flatMap((l, li) => splitWords(l).map((w, wi) => ({ word: w, line: li, wi })));
    let delay = 0.15;
    const spans = lines.map((l, li) => {
      const ws = splitWords(l).map((w) => {
        const d = delay; delay += 0.07;
        return `<span style="display:inline-block;opacity:0;transform:translateY(30px);" class="kw" data-delay="${d}">${esc(w)}</span>`;
      }).join(" ");
      return `<div style="opacity:1;line-height:1.1;">${ws}</div>`;
    }).join("");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 200px;background:#080808;">
  <div style="font-size:96px;font-weight:800;line-height:1.05;letter-spacing:-2px;${accent}">${spans}</div>
</div>`;
  }

  if (t === "stat") {
    const val = esc(String(scene.value ?? 0));
    const suf = esc(scene.suffix ?? "");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#080808;overflow:hidden;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,${ACCENT}10 0%,transparent 70%);"></div>
  <div style="font-size:280px;font-weight:900;color:${ACCENT};line-height:1;opacity:0;transform:scale(0.5);" class="kw" data-delay="0">${val}${suf}</div>
  <div style="font-size:40px;margin-top:24px;max-width:900px;text-align:center;opacity:0;transform:translateY(20px);" class="kw" data-delay="0.5">${esc(scene.label ?? "")}</div>
  ${scene.bar != null ? `<div style="width:500px;height:8px;background:rgba(255,255,255,0.08);margin-top:40px;border-radius:4px;overflow:hidden;"><div style="width:0%;height:100%;background:linear-gradient(90deg,${ACCENT},${ACCENT2});border-radius:4px;" class="anim-bar2" data-pct="${Math.round((scene.bar ?? 0.5) * 100)}" data-delay="0.8"></div></div>` : ""}
</div>`;
  }

  if (t === "list") {
    const items = (scene.items ?? []).map((it, i) => {
      const d = 0.3 + i * 0.18;
      return `<li style="margin:18px 0;opacity:0;transform:translateX(-50px);" class="kw" data-delay="${d}">${esc(it)}</li>`;
    }).join("");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 260px;background:#080808;">
  <div style="font-size:24px;letter-spacing:6px;color:${ACCENT};margin-bottom:36px;opacity:0;transform:translateY(-20px);" class="kw" data-delay="0">${esc(scene.kicker ?? "")}</div>
  <ul style="list-style:none;padding:0;font-size:52px;font-weight:500;line-height:1.3;">${items}</ul>
</div>`;
  }

  if (t === "quote") {
    const qWords = splitWords(scene.quote ?? "").map((w, i) => {
      const d = 0.2 + i * 0.06;
      return `<span style="display:inline-block;opacity:0;transform:translateY(20px);" class="kw" data-delay="${d}">${esc(w)}</span>`;
    }).join(" ");
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 260px;text-align:center;background:linear-gradient(180deg,#080808 0%,#111118 100%);">
  <div style="font-size:52px;font-style:italic;line-height:1.35;max-width:1400px;">${qWords}</div>
  <div style="font-size:28px;margin-top:50px;color:${ACCENT};opacity:0;transform:translateY(20px);" class="kw" data-delay="1.2">— ${esc(scene.attribution ?? "")}</div>
</div>`;
  }

  if (t === "outro") {
    return `<div class="clip" data-start="${start}" data-duration="${dur}" data-track-index="0"
  style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(160deg,#050505 0%,#0f0f1a 100%);overflow:hidden;">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,${ACCENT}12 0%,transparent 60%);"></div>
  <div style="font-size:80px;font-weight:800;opacity:0;transform:translateY(30px);" class="kw" data-delay="0">${esc(scene.text ?? "")}</div>
  <div style="font-size:32px;margin-top:24px;opacity:0;color:rgba(255,255,255,0.5);" class="kw" data-delay="0.4">${esc(scene.sub ?? "")}</div>
  <div style="width:0px;height:3px;background:${ACCENT};margin-top:40px;" class="kw-bar" data-delay="0.7" data-width="200"></div>
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
  body { background: #050505; color: #f5f5f5; font-family: 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; overflow: hidden; -webkit-font-smoothing: antialiased; }
  .clip { position: absolute; inset: 0; }
  .kw { will-change: transform, opacity, filter; }
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
  document.querySelectorAll('.kw').forEach((el) => {
    const d = parseFloat(el.dataset.delay || 0);
    const from = { opacity: 0, y: 30, filter: "blur(4px)" };
    if (el.classList.contains('anim-bar') || el.classList.contains('kw-bar')) {
      gsap.set(el, { scaleX: 0, transformOrigin: "left center" });
      tl.to(el, { scaleX: 1, duration: 0.8, ease: "power3.out" }, d);
    } else if (el.classList.contains('anim-bar2')) {
      const pct = el.dataset.pct || 0;
      gsap.set(el, { width: "0%" });
      tl.to(el, { width: pct + "%", duration: 1.2, ease: "power2.out" }, d);
    } else {
      gsap.set(el, from);
      tl.to(el, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, d);
    }
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
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#050505;}</style>
</head>
<body>
${mounts}
</body>
</html>`;
await writeText("index.html", indexHtml);

log(`\n  ${sb.chapters.length} chapter(s)  ${total.toFixed(1)}s film\n`);
