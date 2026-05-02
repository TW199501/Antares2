#!/usr/bin/env node
/**
 * 4th layer of LF enforcement: fail fast if any tracked file has CRLF.
 * Layer 1: .gitattributes (commit-time normalization)
 * Layer 2: .editorconfig (editor hint)
 * Layer 3: .vscode/settings.json files.eol = "\n" (VS Code default)
 * Layer 4: this script (CI-callable assertion).
 *
 * Run via `pnpm check:eol`. Skips binary files via .gitattributes hints.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const out = execSync("git ls-files -z", { encoding: "buffer" });
const files = out.toString("utf8").split("\0").filter(Boolean);

const skipExt = /\.(png|jpg|jpeg|gif|ico|icns|webp|woff2?|ttf|otf|eot|mp4|mp3|wav|pdf|zip|tar|gz|7z|exe|dll|node)$/i;

const offenders = [];
for (const f of files) {
  if (skipExt.test(f)) continue;
  let buf;
  try { buf = fs.readFileSync(f); } catch { continue; }
  if (buf.length === 0) continue;
  // Skip files that look binary (contain a NUL in the first 8 KB).
  const slice = buf.subarray(0, 8192);
  if (slice.includes(0x00)) continue;
  if (buf.includes(0x0d)) offenders.push(f);
}

if (offenders.length > 0) {
  console.error("✗ CRLF / CR found in " + offenders.length + " tracked file(s):");
  for (const f of offenders) console.error("  " + f);
  console.error("\nRun `dos2unix <file>` or set git config core.autocrlf=input + recheckout to fix.");
  process.exit(1);
}
console.log("✓ All " + files.length + " tracked text files are LF.");
