#!/usr/bin/env tsx
/* Find em dashes in USER-VISIBLE strings only - JSX text, string
   literals, template literals - and skip code comments.
   Walks each TS/TSX source via the TypeScript compiler API so we
   can distinguish JSX text from block comments. */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import * as ts from "typescript";

const APPLY = process.argv.includes("--apply");

interface Hit {
  file:    string;
  line:    number;
  text:    string;
  before:  string;
  after:   string;
  kind:    "JsxText" | "StringLiteral" | "TemplateLiteral";
}

function pickReplacement(text: string): string {
  /* Replacement strategy: " — " → " - " preserves the visual pause,
     reads cleanly, and matches our brand-voice rule (no em dashes).
     Edge cases (start/end of string, no spaces) collapse to a hyphen
     with appropriate spacing. */
  return text
    .replace(/ — /g, " - ")
    .replace(/—/g, "-");
}

function visit(node: ts.Node, sourceFile: ts.SourceFile, hits: Hit[]) {
  if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const text = node.getText(sourceFile);
    if (text.includes("—")) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const replaced = pickReplacement(text);
      hits.push({
        file:   sourceFile.fileName,
        line:   line + 1,
        text:   text.length > 80 ? text.slice(0, 77) + "..." : text,
        before: text,
        after:  replaced,
        kind:   ts.isJsxText(node) ? "JsxText" : ts.isStringLiteral(node) ? "StringLiteral" : "TemplateLiteral",
      });
    }
  } else if (ts.isTemplateExpression(node)) {
    /* For template strings with substitutions, we need to look at
       each TemplateHead / TemplateMiddle / TemplateTail. */
    const head = node.head;
    if (head.text.includes("—")) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(head.getStart(sourceFile));
      hits.push({
        file:   sourceFile.fileName,
        line:   line + 1,
        text:   head.text.slice(0, 80),
        before: head.text,
        after:  pickReplacement(head.text),
        kind:   "TemplateLiteral",
      });
    }
    for (const span of node.templateSpans) {
      const literal = span.literal;
      if (literal.text.includes("—")) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(literal.getStart(sourceFile));
        hits.push({
          file:   sourceFile.fileName,
          line:   line + 1,
          text:   literal.text.slice(0, 80),
          before: literal.text,
          after:  pickReplacement(literal.text),
          kind:   "TemplateLiteral",
        });
      }
    }
  }
  ts.forEachChild(node, (c) => visit(c, sourceFile, hits));
}

function main() {
  const files = execSync(
    "find src -type f \\( -name '*.tsx' -o -name '*.ts' \\) -not -path '*/node_modules/*'",
    { cwd: process.cwd(), encoding: "utf-8" },
  ).trim().split("\n").filter(Boolean);

  const allHits: Hit[] = [];
  let filesWithHits = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    if (!content.includes("—")) continue;
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hits: Hit[] = [];
    visit(sourceFile, sourceFile, hits);
    if (hits.length > 0) {
      filesWithHits++;
      allHits.push(...hits);
      if (APPLY) {
        /* Apply replacements by string substitution. The hits[].before
           is the EXACT TS-extracted text, so a literal replace works. */
        let next = content;
        const seen = new Set<string>();
        for (const h of hits) {
          if (seen.has(h.before)) continue;
          seen.add(h.before);
          next = next.split(h.before).join(h.after);
        }
        writeFileSync(file, next, "utf-8");
      }
    }
  }

  console.log(`Files with user-visible em dashes: ${filesWithHits}`);
  console.log(`Total hits: ${allHits.length}\n`);
  for (const h of allHits.slice(0, 30)) {
    console.log(`  ${h.file}:${h.line} [${h.kind}]  ${h.text}`);
  }
  if (allHits.length > 30) {
    console.log(`  ... and ${allHits.length - 30} more`);
  }
  if (!APPLY) {
    console.log(`\n→ Dry run. Re-run with --apply to make changes.`);
  } else {
    console.log(`\n✓ Applied replacements in ${filesWithHits} files.`);
  }
}

main();
