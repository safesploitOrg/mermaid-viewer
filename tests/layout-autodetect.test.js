import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const INDEX_PATH = new URL("../public/index.html", import.meta.url);
const APP_PATH = new URL("../public/assets/js/app.js", import.meta.url);
const CORE_PATH = new URL("../public/assets/js/core.js", import.meta.url);
const CHANGELOG_PATH = new URL("../CHANGELOG.md", import.meta.url);

test("v1.3 overlay exposes Auto-detect UI", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  assert.match(html, /id="autoDetectLayout"/);
  assert.match(html, /id="layoutStatus"/);
  assert.match(html, /AUTO · no source layout · ELK fallback/);
});

test("v1.3 overlay keeps source detection and force logic separate", async () => {
  const app = await readFile(APP_PATH, "utf8");
  const core = await readFile(CORE_PATH, "utf8");

  assert.match(app, /layoutMode = "forced"/);
  assert.match(app, /layoutMode = "auto"/);
  assert.match(app, /mermaidSource: resolution\.mermaidSource/);
  assert.match(core, /export function detectFrontmatterLayout/);
  assert.match(core, /export function forceFrontmatterLayout/);
  assert.match(core, /export function resolveLayoutForRender/);
});

test("v1.3 changelog documents auto-detect and forced preview", async () => {
  const changelog = await readFile(CHANGELOG_PATH, "utf8");
  assert.match(changelog, /## \[1\.3\.0\] - 2026-09-28/);
  assert.match(changelog, /Auto-detect layout mode/);
  assert.match(changelog, /render-only \*\*forced layout\*\*/);
});
