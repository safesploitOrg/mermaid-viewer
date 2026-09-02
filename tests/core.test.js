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
  isBlankSource,
  layoutLabel,
  mermaidTheme,
  normaliseLayout,
  normaliseTheme,
  validateMermaidVersion,
} from "../public/assets/js/core.js";

test("validates normal Mermaid semantic versions", () => {
  assert.equal(validateMermaidVersion("11.15.0"), "11.15.0");
  assert.equal(validateMermaidVersion(" 12.0.0-beta.1 "), "12.0.0-beta.1");
});

test("rejects unsafe or malformed Mermaid version strings", () => {
  assert.throws(() => validateMermaidVersion("latest"));
  assert.throws(() => validateMermaidVersion("11.15"));
  assert.throws(() => validateMermaidVersion("11.15.0/../../bad"));
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
