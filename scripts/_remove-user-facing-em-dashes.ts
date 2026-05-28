#!/usr/bin/env tsx
// Replace em dashes with " - " (hyphen with spaces) ONLY in lines
// that are not code comments. Walks all .ts/.tsx files in src/,
// skips lines starting with /*, *, or //, then rewrites in place.
//
// Replacement rules:
//   " — "  → " - "    (spaced em-dash to spaced hyphen)
//   " —"   → " -"     (em-dash at end-of-word)
//   "— "   → "- "     (em-dash at start-of-word)
//   "—"    → "-"      (bare em-dash)
//
// Comments preserved verbatim so dev-facing prose keeps its
// typography while UI strings get the plain hyphen.
//
// IMPORTANT: this script is destructive. Diff before committing.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const FILE_RE = /\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (FILE_RE.test(entry)) out.push(full);
  }
  return out;
}

// A line is "in a comment" if its TRIMMED start is /, * (block
// comment continuation), or // (line comment). This is a heuristic
// — it misses block comments where the line doesn't begin with *
// but does begin with the comment text — but for the typical
// project style (commented blocks have * prefix on each line) it
// reliably preserves comment lines.
const COMMENT_LINE_RE = /^\s*(\*|\/\/|\/\*)/;

function replaceEmDashes(line: string): string {
  return line
    .replace(/ — /g, " - ")
    .replace(/ —/g,  " -")
    .replace(/— /g,  "- ")
    .replace(/—/g,   "-");
}

const files = walk(ROOT);
let totalLines = 0;
let totalFiles = 0;
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  if (!raw.includes("—")) continue;
  const lines = raw.split("\n");
  let touched = false;
  let touchedCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("—")) continue;
    if (COMMENT_LINE_RE.test(lines[i])) continue;
    const next = replaceEmDashes(lines[i]);
    if (next !== lines[i]) {
      lines[i] = next;
      touched = true;
      touchedCount++;
    }
  }
  if (touched) {
    writeFileSync(file, lines.join("\n"));
    console.log(`  ${relative(process.cwd(), file)}  (${touchedCount} lines)`);
    totalLines += touchedCount;
    totalFiles++;
  }
}
console.log(`\n${totalFiles} files updated, ${totalLines} lines changed.`);
