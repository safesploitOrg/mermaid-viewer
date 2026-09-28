import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const INDEX_PATH = new URL("../public/index.html", import.meta.url);
const RENDERER_PATH = new URL("../public/renderer.html", import.meta.url);
const APP_JS_PATH = new URL("../public/assets/js/app.js", import.meta.url);
const CORE_JS_PATH = new URL("../public/assets/js/core.js", import.meta.url);
const RENDERER_JS_PATH = new URL("../public/assets/js/renderer.js", import.meta.url);
const GITHUB_ICON_PATH = new URL("../public/assets/images/github-mark.svg", import.meta.url);
const NOJEKYLL_PATH = new URL("../public/.nojekyll", import.meta.url);
const ARCHITECTURE_PATH = new URL("../ARCHITECTURE.md", import.meta.url);
const CHANGELOG_PATH = new URL("../CHANGELOG.md", import.meta.url);
const PACKAGE_PATH = new URL("../package.json", import.meta.url);
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

test("layout selector exposes all four layouts and Auto-detect defaults to ELK fallback", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  const appSource = await readFile(APP_JS_PATH, "utf8");
  const coreSource = await readFile(CORE_JS_PATH, "utf8");

  assert.match(html, /value="elk" selected/);
  assert.match(html, /value="tidy-tree"/);
  assert.match(html, /value="cose-bilkent"/);
  assert.match(html, /value="dagre"/);
  assert.match(html, /id="autoDetectLayout"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /id="layoutStatus"/);
  assert.match(html, /AUTO · no source layout · ELK fallback/);
  assert.match(appSource, /resolveLayoutForRender/);
  assert.match(appSource, /mermaid-viewer-layout-mode/);
  assert.match(coreSource, /layoutMode:\s*"auto"/);
});

test("manual layout selection is a forced preview and auto mode detects source frontmatter", async () => {
  const appSource = await readFile(APP_JS_PATH, "utf8");
  const coreSource = await readFile(CORE_JS_PATH, "utf8");

  assert.match(appSource, /layoutMode = "forced"/);
  assert.match(appSource, /layoutMode = "auto"/);
  assert.match(appSource, /mermaidSource: resolution\.mermaidSource/);
  assert.match(coreSource, /detectFrontmatterLayout/);
  assert.match(coreSource, /forceFrontmatterLayout/);
  assert.match(coreSource, /config\.flowchart\.defaultRenderer/);
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

test("trusted versions have a dropdown and unverified consent can be remembered", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  const appSource = await readFile(APP_JS_PATH, "utf8");

  assert.match(html, /id="versionPreset"/);
  assert.match(html, /value="11\.15\.0" selected>11\.15\.0 — default/);
  assert.match(html, /value="11\.17\.2">11\.17\.2 — latest verified/);
  assert.match(html, /value="custom">Other version/);
  assert.match(html, /id="integrityConsent" type="checkbox"/);
  assert.match(html, /id="rememberUnverified" type="checkbox"/);
  assert.match(html, /id="continueUnverified"[^>]*disabled/);
  assert.match(html, /Integrity could not be verified/);
  assert.match(appSource, /canContinueUnverified/);
  assert.match(appSource, /mermaid-viewer-unverified-approvals/);
});

test("public example remains the generic CI/CD security pipeline", async () => {
  const html = await readFile(INDEX_PATH, "utf8");

  assert.match(html, /subgraph CI\["🔵 Continuous Integration"\]/);
  assert.match(html, /subgraph CD\["🟢 Continuous Delivery"\]/);
  assert.match(html, /Dependency Scan/);
  assert.match(html, /Artifact Registry/);
  assert.match(html, /BUILD --> REGISTRY/);
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

test("release metadata and changelog identify version 1.3.0", async () => {
  const packageMetadata = JSON.parse(await readFile(PACKAGE_PATH, "utf8"));
  const changelog = await readFile(CHANGELOG_PATH, "utf8");

  assert.equal(packageMetadata.version, "1.3.0");
  assert.match(changelog, /## \[1\.3\.0\] - 2026-09-28/);
  assert.match(changelog, /## \[1\.2\.0\] - 2026-09-03/);
});

test("renderer page, icon, architecture and GitHub Pages marker exist", async () => {
  await access(RENDERER_PATH);
  await access(GITHUB_ICON_PATH);
  await access(ARCHITECTURE_PATH);
  await access(CHANGELOG_PATH);
  await access(INTEGRITY_PATH);
  await access(MANIFEST_PATH);
  await access(NOJEKYLL_PATH);
});
