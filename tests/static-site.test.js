import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const INDEX_PATH = new URL("../public/index.html", import.meta.url);
const RENDERER_PATH = new URL("../public/renderer.html", import.meta.url);
const APP_JS_PATH = new URL("../public/assets/js/app.js", import.meta.url);
const RENDERER_JS_PATH = new URL("../public/assets/js/renderer.js", import.meta.url);
const GITHUB_ICON_PATH = new URL("../public/assets/images/github-mark.svg", import.meta.url);
const NOJEKYLL_PATH = new URL("../public/.nojekyll", import.meta.url);
const ARCHITECTURE_PATH = new URL("../ARCHITECTURE.md", import.meta.url);
const INTEGRITY_PATH = new URL("../public/assets/js/integrity.js", import.meta.url);
const MANIFEST_PATH = new URL(
  "../public/assets/js/externals/mermaid-integrity.js",
  import.meta.url,
);

test("GitHub Pages entrypoint references split CSS and JavaScript assets", async () => {
  const html = await readFile(INDEX_PATH, "utf8");

  assert.match(html, /\.\/assets\/css\/app\.css/);
  assert.match(html, /\.\/assets\/js\/app\.js/);
});

test("layout selector exposes all four supported layouts with ELK as default", async () => {
  const html = await readFile(INDEX_PATH, "utf8");

  assert.match(html, /value="elk" selected/);
  assert.match(html, /value="tidy-tree"/);
  assert.match(html, /value="cose-bilkent"/);
  assert.match(html, /value="dagre"/);
});

test("renderer iframe remains sandboxed without same-origin privileges", async () => {
  const html = await readFile(INDEX_PATH, "utf8");

  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /sandbox="[^"]*allow-same-origin/);
});

test("renderer keeps strict Mermaid security and layout loaders", async () => {
  const source = await readFile(RENDERER_JS_PATH, "utf8");
  const manifest = await readFile(MANIFEST_PATH, "utf8");

  assert.match(source, /securityLevel:\s*"strict"/);
  assert.match(source, /executeVerifiedArtifact/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-384"/);
  assert.match(manifest, /@mermaid-js\/layout-elk/);
  assert.match(manifest, /@mermaid-js\/layout-tidy-tree/);
  assert.match(source, /"cose-bilkent"/);
  assert.match(source, /"dagre"/);
  assert.match(source, /registerLayoutLoaders/);
});

test("CSP permits only explicit download origins and never unsafe eval", async () => {
  const indexHtml = await readFile(INDEX_PATH, "utf8");
  const rendererHtml = await readFile(RENDERER_PATH, "utf8");

  assert.match(indexHtml, /connect-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/unpkg\.com/);
  assert.doesNotMatch(indexHtml, /unsafe-eval/);
  assert.doesNotMatch(rendererHtml, /unsafe-eval/);
  assert.doesNotMatch(rendererHtml, /script-src[^;]*unsafe-inline/);
  assert.match(rendererHtml, /style-src 'unsafe-inline'/);
  assert.match(rendererHtml, /script-src 'nonce-[^']+' 'strict-dynamic' blob:/);
});

test("renderer suppresses misleading Mermaid error SVGs and explains incompatible flowcharts", async () => {
  const source = await readFile(RENDERER_JS_PATH, "utf8");

  assert.match(source, /suppressErrorRendering:\s*true/);
  assert.match(source, /cannot lay out flowchart diagrams/);
});

test("unverified warning requires checkbox consent in the static UI", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  const appSource = await readFile(APP_JS_PATH, "utf8");

  assert.match(html, /id="integrityConsent" type="checkbox"/);
  assert.match(html, /id="continueUnverified"[^>]*disabled/);
  assert.match(html, /Integrity could not be verified/);
  assert.match(appSource, /canContinueUnverified/);
});

test("public example is the generic CI/security demo", async () => {
  const html = await readFile(INDEX_PATH, "utf8");

  assert.match(html, /CI \/ Security Pipeline/);
  assert.match(html, /Dependency Scan/);
  assert.match(html, /Artifact Registry/);
});

test("footer uses a browser-derived year and links to the public repository", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  const appSource = await readFile(APP_JS_PATH, "utf8");

  assert.match(html, /id="copyrightYear"/);
  assert.match(html, /Mermaid Viewer/);
  assert.match(html, /https:\/\/github\.com\/safesploitOrg\/mermaid-viewer/);
  assert.match(html, /\.\/assets\/images\/github-mark\.svg/);
  assert.match(appSource, /browserYear\(\)/);
});

test("renderer page, icon, architecture and GitHub Pages marker exist", async () => {
  await access(RENDERER_PATH);
  await access(GITHUB_ICON_PATH);
  await access(ARCHITECTURE_PATH);
  await access(INTEGRITY_PATH);
  await access(MANIFEST_PATH);
  await access(NOJEKYLL_PATH);
});
