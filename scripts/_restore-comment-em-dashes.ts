#!/usr/bin/env tsx
// Revert overly-broad em-dash replacement. The previous script
// replaced em dashes in user-facing strings AND in block-comment
// continuation lines (which don't start with the * prefix the
// heuristic looked for). This script:
//
//   1. Reads each .ts/.tsx file in src/
//   2. Uses a proper character-by-character state machine to track
//      whether each position is inside a comment (block or line)
//      AND outside any string literal
//   3. Compares against git HEAD: where a hyphen replaced an em dash
//      AND the position is inside a comment, restore the em dash
//   4. Where the change is in user-facing code (strings, JSX text,
//      props) the hyphen stays
//
// Idempotent: if there's nothing to revert, file isn't written.

import { execSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync, readdirSync } from "node:fs";
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

// Build a boolean[] of length === src.length. true at position k means
// "this character is inside a comment OR inside a regex literal".
// Walks character-by-character: tracks inString + inComment + inRegex
// state. Quotes inside comments do NOT start a string mode (an
// earlier version had this bug, which caused trailing-comment false
// positives in restoreFile).
function commentPositions(src: string): boolean[] {
  const out = new Array<boolean>(src.length).fill(false);
  let i = 0;
  const len = src.length;
  let inStr: '"' | "'" | "`" | null = null;
  let inRegex = false;
  // Track previous non-whitespace char to decide if a `/` starts a
  // regex literal (after operators, brackets, returns) vs division.
  let lastNonWs = "";
  while (i < len) {
    const c = src[i];
    const next = src[i + 1];
    if (inStr) {
      if (c === "\\" && i + 1 < len) { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (inRegex) {
      // Regex literal: mark every position. Skip escaped chars.
      // Char class [...] in regex: bracket characters are still
      // text-of-the-regex so we mark them all.
      out[i] = true;
      if (c === "\\" && i + 1 < len) {
        out[i + 1] = true;
        i += 2;
        continue;
      }
      if (c === "/") inRegex = false;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      let end = src.indexOf("*/", i + 2);
      if (end === -1) end = len - 2;
      for (let k = i; k < end + 2 && k < len; k++) out[k] = true;
      i = end + 2;
      continue;
    }
    if (c === "/" && next === "/") {
      let end = src.indexOf("\n", i + 2);
      if (end === -1) end = len;
      for (let k = i; k < end; k++) out[k] = true;
      i = end;
      continue;
    }
    // Regex literal detection: a `/` opens a regex iff the previous
    // non-whitespace token is one that can precede a regex. Otherwise
    // it's a division. Conservative heuristic - covers the common
    // patterns we have (assignments, returns, .replace() args).
    if (c === "/" && /[=(,!&|?:;{[\n]/.test(lastNonWs || "\n")) {
      out[i] = true;
      inRegex = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inStr = c;
    if (!/\s/.test(c)) lastNonWs = c;
    i++;
  }
  return out;
}

// Reverse my earlier transform: for each line that differs from
// HEAD, check whether EVERY em-dash position in HEAD's version of
// that line falls inside a comment. If so, the previous script's
// changes on that line were all comment-internal -> restore the
// HEAD version verbatim. If any em-dash was outside a comment,
// the line had user-facing content that legitimately changed -> keep.
function restoreFile(file: string): boolean {
  const cur = readFileSync(file, "utf8");
  let head: string;
  try {
    head = execSync(`git show HEAD:${relative(process.cwd(), file)}`, { encoding: "utf8" });
  } catch {
    return false;
  }
  if (!head.includes("—")) return false;
  const curLines = cur.split("\n");
  const headLines = head.split("\n");
  if (curLines.length !== headLines.length) return false;

  // Comment-position mask on HEAD's content. We look up each em-dash
  // location in HEAD and ask "was that em-dash inside a comment?"
  const headMask = commentPositions(head);

  // HEAD line start positions
  const headLineStarts: number[] = [0];
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "\n") headLineStarts.push(i + 1);
  }

  let touched = false;
  for (let i = 0; i < curLines.length; i++) {
    if (curLines[i] === headLines[i]) continue;
    const headLine = headLines[i];
    if (!headLine.includes("—")) continue; // no em-dashes were here to restore

    // Find every em-dash position in HEAD's line and check the mask.
    // If ALL em-dashes are inside comments, the diff is comment-only
    // and we restore. If ANY em-dash is outside a comment, the line
    // had user-facing content -> keep the cur version.
    const lineStart = headLineStarts[i];
    let allInComment = true;
    for (let c = 0; c < headLine.length; c++) {
      if (headLine[c] !== "—") continue;
      const absolutePos = lineStart + c;
      if (!headMask[absolutePos]) { allInComment = false; break; }
    }
    if (!allInComment) continue;

    curLines[i] = headLine;
    touched = true;
  }
  if (touched) {
    writeFileSync(file, curLines.join("\n"));
    return true;
  }
  return false;
}

const files = walk(ROOT);
let restored = 0;
for (const file of files) {
  if (restoreFile(file)) {
    console.log(`  ${relative(process.cwd(), file)}`);
    restored++;
  }
}
console.log(`\n${restored} files restored to HEAD on comment-only lines.`);
