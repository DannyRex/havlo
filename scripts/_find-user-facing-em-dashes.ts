#!/usr/bin/env tsx
/* Strip code comments from .ts/.tsx files, then report any remaining
   em-dash occurrences. Those are user-facing (rendered as JSX text,
   string literals on user-visible props, page metadata, etc.) and
   safe to mass-replace. Comment-em-dashes stay.

   Run: npx tsx scripts/_find-user-facing-em-dashes.ts
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const FILE_RE = /\.(ts|tsx)$/;
const EM_DASH = "—";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (FILE_RE.test(entry)) out.push(full);
  }
  return out;
}

// Strip block and line comments while preserving newlines so line
// numbers in the report match the source file. State machine walks
// character-by-character; tracks whether we're inside a string so a
// block-comment opener inside a string literal isn't treated as a
// real comment. Naive on string-escape but good enough for finding
// text issues.
function stripComments(src: string): string {
  const out: string[] = [];
  let i = 0;
  const len = src.length;
  let inStr: '"' | "'" | "`" | null = null;
  while (i < len) {
    const c = src[i];
    const next = src[i + 1];
    if (inStr) {
      out.push(c);
      if (c === "\\" && i + 1 < len) {
        out.push(src[i + 1]);
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    /* Block comment */
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const block = src.slice(i, end === -1 ? len : end + 2);
      /* Preserve only newlines */
      out.push(block.replace(/[^\n]/g, " "));
      i = end === -1 ? len : end + 2;
      continue;
    }
    /* Line comment */
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i + 2);
      const line = src.slice(i, end === -1 ? len : end);
      out.push(line.replace(/[^\n]/g, " "));
      i = end === -1 ? len : end;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inStr = c;
    out.push(c);
    i++;
  }
  return out.join("");
}

const files = walk(ROOT);
let total = 0;
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const stripped = stripComments(raw);
  if (!stripped.includes(EM_DASH)) continue;
  const lines = stripped.split("\n");
  const rawLines = raw.split("\n");
  const hits: Array<{ ln: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(EM_DASH)) {
      hits.push({ ln: i + 1, text: rawLines[i].trim().slice(0, 100) });
    }
  }
  if (hits.length === 0) continue;
  console.log(`\n${relative(process.cwd(), file)}  (${hits.length} hits)`);
  for (const h of hits) console.log(`  ${h.ln.toString().padStart(5)}: ${h.text}`);
  total += hits.length;
}
console.log(`\n═══ Total user-facing em-dash lines: ${total} ═══`);
