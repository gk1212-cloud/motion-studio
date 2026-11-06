#!/usr/bin/env node
import { readJson, parseArgs, fail, log, exists, p, hyperframes, ffmpeg } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const STORYBOARD = args.storyboard ?? "film/storyboard.json";
const QUALITY = args.quality ?? process.env.HF_QUALITY ?? "draft";
const sb = await readJson(STORYBOARD);
if (!sb?.chapters?.length) fail("No chapters.");

const chapters = sb.chapters;
const only = args.only;
const list = only ? chapters.filter((c) => c.id === only) : chapters;

log(`  rendering ${list.length} chapter(s) at ${QUALITY}\n`);

for (const ch of list) {
  const out = `renders/chapters/${ch.id}.mp4`;
  if (exists(out) && !args.force) {
    log(`  ${ch.id}: exists, skipping`);
    continue;
  }
  await hyperframes(["render", ".", "-c", `compositions/${ch.id}.html`, "-o", out, "-q", QUALITY], { quiet: false });
  log(`  ${ch.id}: done`);
}

if (!only) {
  const concatFile = "renders/chapters/concat.txt";
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(p("renders/chapters"), { recursive: true });
  await writeFile(p(concatFile), chapters.map((c) => `file '${c.id}.mp4'`).join("\n"));
  await ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", p(concatFile), "-c", "copy", p("renders/film.mp4")]);
  log(`\n  film ready: renders/film.mp4\n`);
}
