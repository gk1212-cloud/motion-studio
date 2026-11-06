import { readFile } from "node:fs/promises";
import { ROOT, sleep, warn, num } from "./common.mjs";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
let cachedChain = null;

async function loadChain() {
  if (cachedChain) return cachedChain;
  const cfg = JSON.parse(await readFile(ROOT + "/models.json", "utf8"));
  const entries = [];
  if (process.env.HF_MODEL) {
    entries.push({
      provider: "override",
      model: process.env.HF_MODEL,
      baseUrl: process.env.HF_BASE_URL ?? DEFAULT_BASE,
      apiKeyEnv: process.env.HF_API_KEY ? "HF_API_KEY" : undefined,
      apiKey: process.env.HF_API_KEY,
    });
  }
  for (const item of cfg?.chain ?? []) entries.push({ ...item });

  const chain = [];
  for (const entry of entries) {
    const model = String(entry.model ?? "").trim();
    if (!model) continue;
    const baseUrl = String(entry.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    const apiKey = entry.apiKey ?? (entry.apiKeyEnv ? process.env[entry.apiKeyEnv] : process.env.HF_API_KEY);
    if (!apiKey) {
      warn(`skip ${model} (no key for ${entry.apiKeyEnv ?? "HF_API_KEY"})`);
      continue;
    }
    chain.push({ provider: entry.provider ?? "custom", model, baseUrl, apiKey, url: `${baseUrl}/chat/completions` });
  }
  if (!chain.length) throw new Error("No model credentials. Set GEMINI_API_KEY (free: https://aistudio.google.com/apikey)");
  cachedChain = chain;
  return chain;
}

function parseJsonLoose(raw) {
  let text = String(raw ?? "").trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function askJson({ system, user, temperature = 0.9, maxTokens = 4000, purpose = "call" }) {
  const chain = await loadChain();
  const failures = [];
  for (const entry of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(1500);
      try {
        const res = await fetch(entry.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${entry.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            model: entry.model,
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const raw = await res.text();
        if (!res.ok) {
          failures.push(`${entry.model}: ${res.status} ${raw.slice(0, 120)}`);
          if (res.status === 429 && attempt === 0) { await sleep(30_000); continue; }
          break;
        }
        const payload = JSON.parse(raw);
        const content = payload?.choices?.[0]?.message?.content;
        if (!content) { failures.push(`${entry.model}: empty`); break; }
        const json = parseJsonLoose(content);
        return { json, model: entry.model, provider: entry.provider };
      } catch (err) {
        failures.push(`${entry.model}: ${err.message}`);
        if (attempt === 0) continue;
        break;
      }
    }
  }
  throw new Error(`Every model failed.\n  ${failures.join("\n  ")}`);
}

export const getUsage = () => [];

