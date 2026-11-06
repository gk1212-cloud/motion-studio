import { readJson, writeJson, parseArgs, fail, log, warn, num } from "./lib/common.mjs";
import { askJson } from "./lib/llm.mjs";
import { localGate, judge, revise } from "./critique.mjs";

const args = parseArgs(process.argv.slice(2));
const OUT = args.out ?? "film/storyboard.json";
const minScore = num(args.minScore, num(process.env.HF_MIN_SCORE, 6));

const topics = await readJson("content/topics.json", { channel: { name: "explainer", tone: "calm", audience: "curious adults" }, queue: [], used: [] });
const memory = (await readJson("content/published.json", { videos: [] })).videos ?? [];
const topic = args.topic || process.env.HF_TOPIC || topics.queue?.[0] || "Why focus feels harder than it used to";

log(`\n  topic: ${topic}\n`);

// 1. Angles
const angleRes = await askJson({
  system: `State the obvious take on this topic, then propose 6 alternative angles that NOBODY has said before. Each must have a specific, concrete mechanism (not vague claims). Reject any angle that sounds like a listicle, a self-help tip, or "the truth is". Pick the least obvious defensible one. Return JSON: { "obvious_take": "...", "candidates": [ { "angle": "...", "claim": "...", "why": "...", "plausibility": 8, "obviousness": 2 } ] }`,
  user: `Topic: ${topic}\nAlready used: ${memory.map(v => v.title).join(", ") || "none"}`,
  temperature: 1,
  maxTokens: 2000,
  purpose: "angles",
});

const candidates = angleRes.json?.candidates ?? [];
const angle = candidates.sort((a, b) => (b.plausibility - b.obviousness) - (a.plausibility - a.obviousness))[0] ?? { angle: "default", claim: "default", why: "" };
log(`  angle: ${angle.angle}`);
log(`  claim: ${angle.claim}\n`);

// 2. Storyboard
const storyRes = await askJson({
  system: `Output STRICT JSON only. No prose, no fences.

Shape (copy this exactly):
{ "meta": { "slug": "kebab-case", "title": "under 60 chars", "description": "2 sentences", "tags": ["tag1"], "categoryId": "27", "privacyStatus": "private" }, "chapters": [ { "id": "ch-01", "title": "short title", "scenes": [ { "type": "chapter", "number": 1, "kicker": "PART ONE", "title": "Title", "duration": 4, "say": "narration sentence here" } ] } ], "shorts": [] }

Rules:
- 3 chapters, each ~90 seconds, 4-6 scenes per chapter
- Scene types: chapter, statement, stat, list, quote, outro, character
- Every scene: type, duration (3-12), say (6-20 words narration)
- First scene of each chapter is type "chapter"
- One outro in last chapter only
- character type: text + mood ("talk","point","wave")
- No invented stats. Use statement instead of stat when unsure.
- No generic advice. Be specific and concrete.`,
  user: `Topic: ${topic}\nAngle: ${angle.angle}\nClaim: ${angle.claim}\nTarget: 4.5 minutes, 3 chapters.`,
  temperature: 0.9,
  maxTokens: 6000,
  purpose: "storyboard",
});
let storyboard = storyRes.json;
// Some models return a flat array of scenes or wrap in "storyboard" — normalize
if (Array.isArray(storyboard)) {
  storyboard = { meta: { slug: "film", title: topic, description: "", tags: [], categoryId: "27", privacyStatus: "private" }, chapters: [{ id: "ch-01", title: "Chapter 1", scenes: storyboard }], shorts: [] };
}
if (storyboard?.storyboard) storyboard = storyboard.storyboard;
if (storyboard?.film) storyboard = storyboard.film;
if (!storyboard?.chapters?.length) { fail("No storyboard produced."); }

// 3. Gate + revise
let passed = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  const lg = localGate(storyboard);
  if (!lg.ok) {
    log(`  pass ${attempt}/3: local gate issues: ${lg.issues.join("; ")}`);
    const revised = await revise({ topic, angle, storyboard, notes: lg.issues });
    if (revised?.chapters?.length) storyboard = revised;
    continue;
  }
  const v = await judge({ topic, angle, storyboard });
  const flags = v.flags ?? {};
  const hardBlock = flags.obvious_take || flags.repeated_angle;
  const scores = v.scores ?? {};
  const numeric = Object.values(scores).filter((n) => Number.isFinite(Number(n))).map(Number);
  const score = Number.isFinite(Number(v.overall)) && Number(v.overall) > 0
    ? Number(v.overall)
    : numeric.length ? Math.round(numeric.reduce((a, b) => a + b, 0) / numeric.length) : 0;
  log(`  pass ${attempt}/3: editor ${score}/10 (hook ${v.scores?.hook}, clarity ${v.scores?.clarity}, originality ${v.scores?.originality})`);
  if (!hardBlock && score >= minScore) { passed = true; break; }
  log(`    blocked: ${hardBlock ? Object.keys(flags).filter(k => flags[k]).join(", ") : "score " + score + " < " + minScore}`);
  if (attempt < 3) {
    const notes = [v.why, ...(v.fixes ?? [])];
    const revised = await revise({ topic, angle, storyboard, notes });
    if (revised?.chapters?.length) storyboard = revised;
  }
}

if (!passed) {
  await writeJson("film/rejected.json", storyboard);
  fail("Blocked after 3 attempts. Nothing rendered.");
}

storyboard.meta = storyboard.meta ?? {};
storyboard.meta.gate = { passed: true, overall: 7 };
await writeJson(OUT, storyboard);
log(`\n  PASS — wrote ${OUT}\n`);
