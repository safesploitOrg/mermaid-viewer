import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULTS,
  SUPPORTED_LAYOUTS,
  browserYear,
  calculateAnchoredZoom,
  calculateFit,
  clampRenderWidth,
  clampScale,
  detectFrontmatterLayout,
  forceFrontmatterLayout,
  isBlankSource,
  layoutLabel,
  mermaidTheme,
  normaliseLayout,
  normaliseLayoutMode,
  normaliseTheme,
  resolveLayoutForRender,
  validateMermaidVersion,
} from "../public/assets/js/core.js";

test("validates normal Mermaid semantic versions", () => {
  assert.equal(validateMermaidVersion("11.15.0"), "11.15.0");
  assert.equal(validateMermaidVersion(" 12.0.0-beta.1 "), "12.0.0-beta.1");
  assert.equal(validateMermaidVersion("12.0.0-rc.1+review.2"), "12.0.0-rc.1+review.2");
});

test("rejects unsafe or malformed Mermaid version strings", () => {
  assert.throws(() => validateMermaidVersion("latest"));
  assert.throws(() => validateMermaidVersion("11.15"));
  assert.throws(() => validateMermaidVersion("11.15.0/../../bad"));
  assert.throws(() => validateMermaidVersion("011.15.0"));
  assert.throws(() => validateMermaidVersion("11.15.0-01"));
  assert.throws(() => validateMermaidVersion(""));
});

test("detects blank source before calling Mermaid", () => {
  assert.equal(isBlankSource(""), true);
  assert.equal(isBlankSource("  \n\t "), true);
  assert.equal(isBlankSource("flowchart LR\nA --> B"), false);
});

test("supports all Mermaid layouts listed by the viewer", () => {
  assert.deepEqual(SUPPORTED_LAYOUTS, [
    "elk",
    "tidy-tree",
    "cose-bilkent",
    "dagre",
  ]);

  assert.equal(normaliseLayout("elk"), "elk");
  assert.equal(normaliseLayout("tidy-tree"), "tidy-tree");
  assert.equal(normaliseLayout("cose-bilkent"), "cose-bilkent");
  assert.equal(normaliseLayout("dagre"), "dagre");
  assert.equal(normaliseLayout("something-else"), DEFAULTS.layout);

  assert.equal(layoutLabel("elk"), "ELK");
  assert.equal(layoutLabel("tidy-tree"), "Tidy Tree");
  assert.equal(layoutLabel("cose-bilkent"), "Cose Bilkent");
  assert.equal(layoutLabel("dagre"), "Dagre");
});

test("normalises layout modes with auto as the safe default", () => {
  assert.equal(DEFAULTS.layoutMode, "auto");
  assert.equal(normaliseLayoutMode("auto"), "auto");
  assert.equal(normaliseLayoutMode("forced"), "forced");
  assert.equal(normaliseLayoutMode("invalid"), "auto");
});

test("normalises themes", () => {
  assert.equal(normaliseTheme("light"), "light");
  assert.equal(normaliseTheme("dark"), "dark");
  assert.equal(normaliseTheme("something-else"), "light");
  assert.equal(mermaidTheme("light"), "default");
  assert.equal(mermaidTheme("dark"), "dark");
});

test("uses the browser-local year from a Date object", () => {
  const date = new Date(2032, 5, 15, 12, 0, 0);
  assert.equal(browserYear(date), 2032);
  assert.throws(() => browserYear(new Date("invalid")), TypeError);
});

test("clamps render width to supported bounds", () => {
  assert.equal(clampRenderWidth(1216), 1216);
  assert.equal(clampRenderWidth(100), DEFAULTS.minimumRenderWidth);
  assert.equal(clampRenderWidth(9999), DEFAULTS.maximumRenderWidth);
  assert.equal(clampRenderWidth("invalid"), DEFAULTS.renderWidth);
});

test("clamps viewer scale", () => {
  assert.equal(clampScale(1), 1);
  assert.equal(clampScale(0.001), DEFAULTS.minimumScale);
  assert.equal(clampScale(100), DEFAULTS.maximumScale);
});

test("fit calculation centres content within the viewport", () => {
  const result = calculateFit({
    viewportWidth: 1200,
    viewportHeight: 800,
    contentWidth: 1000,
    contentHeight: 500,
    padding: 0,
  });

  assert.equal(result.scale, 1.2);
  assert.equal(result.panX, 0);
  assert.equal(result.panY, 100);
});

test("anchored zoom keeps the cursor over the same diagram coordinate", () => {
  const result = calculateAnchoredZoom({
    currentScale: 1,
    newScale: 2,
    panX: 0,
    panY: 0,
    anchorX: 100,
    anchorY: 50,
  });

  assert.equal(result.scale, 2);
  assert.equal(result.panX, -100);
  assert.equal(result.panY, -50);
});

test("auto-detect reads config.layout from Mermaid YAML frontmatter", () => {
  for (const layout of SUPPORTED_LAYOUTS) {
    const source = `---\nconfig:\n  layout: ${layout}\n---\nflowchart LR\nA --> B`;
    assert.deepEqual(detectFrontmatterLayout(source), {
      status: "detected",
      layout,
      raw: layout,
      source: "config.layout",
    });
  }
});

test("auto-detect accepts quoted layout values and ignores comments", () => {
  const source = `---\nconfig:\n  theme: neutral\n  layout: "dagre" # GitHub target\n---\nflowchart LR\nA --> B`;
  const detected = detectFrontmatterLayout(source);

  assert.equal(detected.status, "detected");
  assert.equal(detected.layout, "dagre");
});

test("auto-detect supports inline config mappings", () => {
  const source = `---\nconfig: { theme: neutral, layout: elk }\n---\nflowchart LR\nA --> B`;
  const detected = detectFrontmatterLayout(source);

  assert.equal(detected.status, "detected");
  assert.equal(detected.layout, "elk");
});

test("auto-detect understands legacy flowchart.defaultRenderer hints", () => {
  const dagre = `---\nconfig:\n  flowchart:\n    defaultRenderer: dagre-wrapper\n---\nflowchart LR\nA --> B`;
  const elk = `---\nconfig:\n  flowchart:\n    defaultRenderer: elk\n---\nflowchart LR\nA --> B`;

  assert.equal(detectFrontmatterLayout(dagre).layout, "dagre");
  assert.equal(detectFrontmatterLayout(elk).layout, "elk");
});

test("auto-detect reports missing and unsupported layout directives", () => {
  assert.equal(
    detectFrontmatterLayout("flowchart LR\nA --> B").status,
    "missing",
  );

  const unsupported = detectFrontmatterLayout(
    `---\nconfig:\n  layout: future-layout\n---\nflowchart LR\nA --> B`,
  );

  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.layout, null);
  assert.equal(unsupported.raw, "future-layout");
});

test("forced layout adds frontmatter only to the render copy", () => {
  const source = "flowchart LR\nA --> B";
  const forced = forceFrontmatterLayout(source, "dagre");

  assert.match(forced, /^---\nconfig:\n  layout: dagre\n---\n/);
  assert.match(forced, /flowchart LR\nA --> B$/);
  assert.equal(source, "flowchart LR\nA --> B");
});

test("forced layout replaces an existing config.layout and preserves other frontmatter", () => {
  const source = `---\ntitle: Example\nconfig:\n  theme: neutral\n  layout: dagre # keep comment\n---\nflowchart LR\nA --> B`;
  const forced = forceFrontmatterLayout(source, "elk");

  assert.match(forced, /title: Example/);
  assert.match(forced, /theme: neutral/);
  assert.match(forced, /layout: elk # keep comment/);
  assert.doesNotMatch(forced, /layout: dagre/);
});

test("forced layout updates inline config mappings", () => {
  const source = `---\nconfig: { theme: neutral, layout: dagre }\n---\nflowchart LR\nA --> B`;
  const forced = forceFrontmatterLayout(source, "elk");

  assert.match(forced, /config: \{ theme: neutral, layout: elk\s*\}/);
});

test("resolveLayoutForRender auto-detects source layout and falls back to ELK when absent", () => {
  const detected = resolveLayoutForRender({
    source: `---\nconfig:\n  layout: dagre\n---\nflowchart LR\nA --> B`,
    mode: "auto",
    selectedLayout: "elk",
  });
  assert.equal(detected.layout, "dagre");
  assert.equal(detected.mermaidSource.includes("layout: dagre"), true);

  const fallback = resolveLayoutForRender({
    source: "flowchart LR\nA --> B",
    mode: "auto",
    selectedLayout: "dagre",
  });
  assert.equal(fallback.layout, "elk");
});

test("resolveLayoutForRender manual mode forces the selected layout without changing editor source", () => {
  const source = `---\nconfig:\n  layout: dagre\n---\nflowchart LR\nA --> B`;
  const resolved = resolveLayoutForRender({
    source,
    mode: "forced",
    selectedLayout: "elk",
  });

  assert.equal(resolved.layout, "elk");
  assert.match(resolved.mermaidSource, /layout: elk/);
  assert.match(source, /layout: dagre/);
});
