export const SUPPORTED_LAYOUTS = Object.freeze([
  "elk",
  "tidy-tree",
  "cose-bilkent",
  "dagre",
]);

export const LAYOUT_LABELS = Object.freeze({
  elk: "ELK",
  "tidy-tree": "Tidy Tree",
  "cose-bilkent": "Cose Bilkent",
  dagre: "Dagre",
});

export const DEFAULTS = Object.freeze({
  mermaidVersion: "11.15.0",
  layout: "elk",
  theme: "light",
  renderWidth: 1216,
  minimumRenderWidth: 480,
  maximumRenderWidth: 3000,
  minimumScale: 0.08,
  maximumScale: 6,
  zoomFactor: 1.18,
});

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function validateMermaidVersion(value) {
  const version = String(value ?? "").trim();

  if (!VERSION_PATTERN.test(version)) {
    throw new Error("Enter a Mermaid version such as 11.15.0");
  }

  return version;
}

export function isBlankSource(source) {
  return String(source ?? "").trim().length === 0;
}

export function normaliseLayout(value) {
  const layout = String(value ?? "");
  return SUPPORTED_LAYOUTS.includes(layout) ? layout : DEFAULTS.layout;
}

export function layoutLabel(value) {
  return LAYOUT_LABELS[normaliseLayout(value)];
}

export function normaliseTheme(value) {
  return value === "dark" ? "dark" : "light";
}

export function mermaidTheme(value) {
  return normaliseTheme(value) === "dark" ? "dark" : "default";
}

export function browserYear(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("browserYear expects a valid Date");
  }

  return date.getFullYear();
}

export function clampRenderWidth(value) {
  const parsed = Number.parseInt(value, 10);
  const width = Number.isFinite(parsed) ? parsed : DEFAULTS.renderWidth;

  return Math.max(
    DEFAULTS.minimumRenderWidth,
    Math.min(DEFAULTS.maximumRenderWidth, width),
  );
}

export function clampScale(value) {
  const parsed = Number(value);
  const scale = Number.isFinite(parsed) ? parsed : 1;

  return Math.max(
    DEFAULTS.minimumScale,
    Math.min(DEFAULTS.maximumScale, scale),
  );
}

export function calculateAnchoredZoom({
  currentScale,
  newScale,
  panX,
  panY,
  anchorX,
  anchorY,
}) {
  const safeCurrentScale = clampScale(currentScale);
  const safeNewScale = clampScale(newScale);

  const diagramX = (anchorX - panX) / safeCurrentScale;
  const diagramY = (anchorY - panY) / safeCurrentScale;

  return {
    scale: safeNewScale,
    panX: anchorX - diagramX * safeNewScale,
    panY: anchorY - diagramY * safeNewScale,
  };
}

export function calculateFit({
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight,
  padding = 52,
}) {
  const availableWidth = Math.max(1, viewportWidth - padding);
  const availableHeight = Math.max(1, viewportHeight - padding);
  const safeContentWidth = Math.max(1, contentWidth);
  const safeContentHeight = Math.max(1, contentHeight);

  const scale = clampScale(
    Math.min(
      availableWidth / safeContentWidth,
      availableHeight / safeContentHeight,
    ),
  );

  return {
    scale,
    panX: (viewportWidth - safeContentWidth * scale) / 2,
    panY: (viewportHeight - safeContentHeight * scale) / 2,
  };
}
