import { askJson } from "./lib/llm.mjs";

export const SCENE_TYPES = ["chapter", "statement", "stat", "list", "quote", "outro"];

const BANNED = ["in this video", "let's dive", "game changer", "delve into", "mind-blowing"];

export function localGate(sb) {
  const issues = [];
  const chapters = sb.chapters ?? [];
  if (!chapters.length) issues.push("No chapters.");
  let total = 0;
  for (const c of chapters) {
    for (const s of c.scenes ?? []) {
      const d = Number(s.duration);
      if (!Number.isFinite(d) || d < 2.6 || d > 15) issues.push(`${c.id}/${s.type}: bad duration ${s.duration}`);
      else total += d;
      if (s.say) {
        const w = String(s.say).trim().split(/\s+/).length;
        if (w > 60) issues.push(`${c.id}/${s.type}: narration too long (${w} words)`);
      }
    }
  }
  const flat = JSON.stringify(sb).toLowerCase();
  for (const p of BANNED) if (flat.includes(p)) issues.push(`Remove "${p}".`);
  return { ok: issues.length === 0, issues, total };
}

export async function judge({ topic, angle, storyboard }) {
  const { json } = await askJson({
    system: `You are a commissioning editor. Score this storyboard 1-10 on: hook, clarity, originality, specificity, pacing, payoff. Also set overall (1-10), a "why" (one sentence on why it's different), and "flags": {obvious_take, generic_advice, fabricated_stat, repeated_angle} (true only if present). Return JSON only.`,
    user: `Topic: ${topic}\nAngle: ${angle.angle}\nClaim: ${angle.claim}\n\nStoryboard:\n${JSON.stringify(storyboard, null, 1)}`,
    temperature: 0.3,
    maxTokens: 1500,
    purpose: "judge",
  });
  return json;
}

export async function revise({ topic, angle, storyboard, notes }) {
  const { json } = await askJson({
    system: `You are an editor. Rewrite the storyboard fixing the issues. Keep the same JSON shape. Output STRICT JSON only.`,
    user: `Topic: ${topic}\nAngle: ${angle.angle}\nIssues: ${JSON.stringify(notes)}\n\nCurrent storyboard:\n${JSON.stringify(storyboard, null, 1)}`,
    temperature: 0.7,
    maxTokens: 6000,
    purpose: "revise",
  });
  return json;
}
