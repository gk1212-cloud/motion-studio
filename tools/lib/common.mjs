import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const HF_VERSION = "0.8.226";

export const p = (...parts) => path.join(ROOT, ...parts);

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(p(file), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== null) return fallback;
    throw new Error(`Cannot read ${file}: ${err.message}`);
  }
}

export async function writeText(file, text) {
  const full = p(file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, text, "utf8");
}

export async function writeJson(file, value) {
  await writeText(file, JSON.stringify(value, null, 2) + "\n");
}

export const exists = (file) => existsSync(p(file));

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) {
        args[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args[k] = argv[i + 1];
        i++;
      } else {
        args[k] = true;
      }
    }
  }
  return args;
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function log(...a) { console.log(...a); }
export function warn(...a) { console.warn("  !", ...a); }
export function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function argvFor(args) {
  return Array.isArray(args) ? args : [args];
}

const NEEDS_SHELL = process.platform === "win32";

export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argvFor(args), {
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env, ...opts.env },
      stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: NEEDS_SHELL,
    });
    let stderr = "";
    if (opts.quiet) {
      child.stdout?.on("data", () => {});
      child.stderr?.on("data", (d) => (stderr += d));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

export async function hyperframes(args, opts = {}) {
  return run("npx", ["--yes", `hyperframes@${HF_VERSION}`, ...argvFor(args)], opts);
}

export async function ffmpeg(args, opts = {}) {
  return run("ffmpeg", argvFor(args), opts);
}

export async function probeDuration(file) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", p(file)], { shell: NEEDS_SHELL });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
    child.on("error", () => resolve(null));
  });
}

export function fmtTime(s) { return s.toFixed(2) + "s"; }
