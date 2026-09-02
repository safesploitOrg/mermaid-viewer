import {
  DEFAULTS,
  calculateAnchoredZoom,
  calculateFit,
  browserYear,
  clampRenderWidth,
  clampScale,
  isBlankSource,
  layoutLabel,
  mermaidTheme,
  normaliseLayout,
  normaliseTheme,
  validateMermaidVersion,
} from "./core.js";

import {
  PARENT_MESSAGE_SOURCE,
  createChannelId,
  isExpectedFrameMessage,
} from "./protocol.js";

const LIVE_DELAY_MS = 350;
const RENDER_TIMEOUT_MS = 10000;
const MINIMUM_FRAME_HEIGHT = 240;

const editor = document.getElementById("editor");
const versionInput = document.getElementById("version");
const themeSelect = document.getElementById("theme");
const layoutSelect = document.getElementById("layout");
const widthInput = document.getElementById("renderWidth");
const liveToggle = document.getElementById("live");

const previewPane = document.getElementById("previewPane");
const viewport = document.getElementById("viewport");
const stage = document.getElementById("stage");
const iframe = document.getElementById("rendererFrame");
const overlay = document.getElementById("overlay");
const errorBox = document.getElementById("errorBox");
const diagnostics = document.getElementById("diagnostics");
const status = document.getElementById("status");
const zoomLabel = document.getElementById("zoomLabel");
const copyrightYear = document.getElementById("copyrightYear");

const defaultExample = editor.value;

let frameHeight = 720;
let rendererReady = false;
let currentRendererVersion = null;
let channel = "";
let scale = 1;
let panX = 24;
let panY = 24;
let liveTimer = null;
let renderTimeout = null;
let fitAfterRender = true;

let dragging = false;
let dragPointer = null;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;

function setStatus(text, state = "waiting") {
  status.textContent = text;
  status.className = `status ${state}`;
}

function setDiagnostics(text) {
  diagnostics.textContent = text;
}

function showOverlay(text) {
  overlay.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function showError(text) {
  errorBox.textContent = text;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

function renderWidthPx() {
  return clampRenderWidth(widthInput.value);
}

function applyDimensions() {
  const width = renderWidthPx();
  widthInput.value = String(width);
  stage.style.width = `${width}px`;
  stage.style.height = `${Math.max(MINIMUM_FRAME_HEIGHT, frameHeight)}px`;
}

function applyTransform() {
  stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function setZoom(newScale, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) {
  const next = calculateAnchoredZoom({
    currentScale: scale,
    newScale,
    panX,
    panY,
    anchorX,
    anchorY,
  });

  scale = next.scale;
  panX = next.panX;
  panY = next.panY;
  applyTransform();
}

function actualSize() {
  scale = 1;
  panX = 24;
  panY = 24;
  applyTransform();
}

function fit() {
  const next = calculateFit({
    viewportWidth: viewport.clientWidth,
    viewportHeight: viewport.clientHeight,
    contentWidth: renderWidthPx(),
    contentHeight: Math.max(MINIMUM_FRAME_HEIGHT, frameHeight),
  });

  scale = next.scale;
  panX = next.panX;
  panY = next.panY;
  applyTransform();
}

function clearRenderTimeout() {
  if (renderTimeout !== null) {
    window.clearTimeout(renderTimeout);
    renderTimeout = null;
  }
}

function startRenderTimeout() {
  clearRenderTimeout();

  renderTimeout = window.setTimeout(() => {
    setStatus("Renderer timed out", "error");
    showOverlay(
      "The sandboxed renderer did not respond. Check browser access to cdn.jsdelivr.net or unpkg.com.",
    );
    setDiagnostics("Timeout waiting for sandboxed renderer");
  }, RENDER_TIMEOUT_MS);
}

function persistSettings() {
  localStorage.setItem("mermaid-viewer-source", editor.value);
  localStorage.setItem("mermaid-viewer-version", validateMermaidVersion(versionInput.value));
  localStorage.setItem("mermaid-viewer-theme", normaliseTheme(themeSelect.value));
  localStorage.setItem("mermaid-viewer-layout", normaliseLayout(layoutSelect.value));
  localStorage.setItem("mermaid-viewer-width", String(renderWidthPx()));
}

function createRenderer({ fitAfter = true } = {}) {
  let version;

  try {
    version = validateMermaidVersion(versionInput.value);
  } catch (error) {
    showError(error.message);
    setStatus("Invalid Mermaid version", "error");
    return;
  }

  rendererReady = false;
  currentRendererVersion = version;
  channel = createChannelId();
  frameHeight = 720;
  fitAfterRender = fitAfter;

  clearRenderTimeout();
  clearError();
  applyDimensions();

  showOverlay(`Loading Mermaid ${version}…`);
  setStatus(`Loading Mermaid ${version}…`, "waiting");
  setDiagnostics(`Creating sandbox · Mermaid ${version}`);

  const url = new URL("./renderer.html", window.location.href);
  url.searchParams.set("channel", channel);
  url.searchParams.set("version", version);
  iframe.src = url.href;
}

function clearPreview({ notifyRenderer = true } = {}) {
  clearRenderTimeout();
  hideOverlay();
  clearError();
  frameHeight = MINIMUM_FRAME_HEIGHT;
  applyDimensions();

  setStatus("Nothing to render", "ready");
  setDiagnostics("Blank input · preview cleared");

  if (notifyRenderer && rendererReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      {
        source: PARENT_MESSAGE_SOURCE,
        channel,
        type: "clear",
      },
      "*",
    );
  }
}

function sendRender({ fitAfter = false } = {}) {
  fitAfterRender = fitAfter;
  clearError();

  if (isBlankSource(editor.value)) {
    clearPreview();
    return;
  }

  let version;

  try {
    version = validateMermaidVersion(versionInput.value);
  } catch (error) {
    showError(error.message);
    setStatus("Invalid Mermaid version", "error");
    return;
  }

  if (version !== currentRendererVersion) {
    createRenderer({ fitAfter });
    return;
  }

  if (!rendererReady || !iframe.contentWindow) {
    setStatus("Renderer still loading…", "waiting");
    return;
  }

  persistSettings();

  const layout = normaliseLayout(layoutSelect.value);
  const theme = mermaidTheme(themeSelect.value);

  const layoutName = layoutLabel(layout);

  showOverlay(`Rendering with Mermaid ${version} · ${layoutName}…`);
  setStatus(`Rendering Mermaid ${version} · ${layoutName}…`, "waiting");
  setDiagnostics(
    `Sent source to sandbox · Mermaid ${version} · ${layoutName} · ${renderWidthPx()}px`,
  );

  iframe.contentWindow.postMessage(
    {
      source: PARENT_MESSAGE_SOURCE,
      channel,
      type: "render",
      mermaidSource: editor.value,
      theme,
      layout,
    },
    "*",
  );

  startRenderTimeout();
}

function scheduleRender() {
  if (isBlankSource(editor.value)) {
    clearPreview();
    return;
  }

  if (!liveToggle.checked) {
    return;
  }

  window.clearTimeout(liveTimer);
  liveTimer = window.setTimeout(() => {
    sendRender({ fitAfter: false });
  }, LIVE_DELAY_MS);
}

window.addEventListener("message", (event) => {
  if (!isExpectedFrameMessage({
    eventSource: event.source,
    expectedWindow: iframe.contentWindow,
    data: event.data,
    channel,
  })) {
    return;
  }

  const message = event.data;

  if (message.version !== currentRendererVersion) {
    return;
  }

  if (message.type === "ready") {
    rendererReady = true;
    setDiagnostics(`Sandbox ready · Mermaid ${message.version}`);
    sendRender({ fitAfter: true });
    return;
  }

  if (message.type === "cleared") {
    clearPreview({ notifyRenderer: false });
    return;
  }

  if (message.type === "rendered") {
    clearRenderTimeout();

    const height = Number(message.value?.height);
    if (Number.isFinite(height) && height > 0) {
      frameHeight = Math.ceil(height);
      applyDimensions();
    }

    hideOverlay();

    const renderedLayout = normaliseLayout(message.value?.layout);
    const renderedLayoutName = layoutLabel(renderedLayout);
    const layoutPackage = message.value?.layoutPackage;
    const packageSuffix = layoutPackage ? ` · ${layoutPackage}` : "";

    setStatus(
      `Rendered · Mermaid ${message.version} · ${renderedLayoutName}`,
      "ready",
    );
    setDiagnostics(
      `Rendered · Mermaid ${message.version} · ${renderedLayoutName}${packageSuffix} · ${renderWidthPx()}px × ${frameHeight}px`,
    );

    if (fitAfterRender) {
      fitAfterRender = false;
      window.requestAnimationFrame(fit);
    }

    return;
  }

  if (message.type === "error") {
    clearRenderTimeout();
    hideOverlay();
    showError(message.value?.message || "Unknown Mermaid rendering error");
    setStatus("Mermaid render failed", "error");
    setDiagnostics(`Renderer error · Mermaid ${message.version}`);
  }
});

editor.addEventListener("input", scheduleRender);

editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
    scheduleRender();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    sendRender({ fitAfter: true });
  }
});

versionInput.addEventListener("change", () => createRenderer({ fitAfter: true }));
themeSelect.addEventListener("change", () => sendRender({ fitAfter: true }));
layoutSelect.addEventListener("change", () => sendRender({ fitAfter: true }));

widthInput.addEventListener("change", () => {
  applyDimensions();
  sendRender({ fitAfter: true });
});

document.getElementById("render").addEventListener("click", () => sendRender({ fitAfter: true }));

document.getElementById("resetExample").addEventListener("click", () => {
  editor.value = defaultExample;
  sendRender({ fitAfter: true });
});

document.getElementById("plus").addEventListener("click", () => {
  setZoom(scale * DEFAULTS.zoomFactor);
});

document.getElementById("minus").addEventListener("click", () => {
  setZoom(scale / DEFAULTS.zoomFactor);
});

document.getElementById("actual").addEventListener("click", actualSize);
document.getElementById("fit").addEventListener("click", fit);

document.getElementById("fullscreen").addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await previewPane.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }

  window.setTimeout(fit, 100);
});

viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const nextScale = clampScale(scale * Math.exp(-event.deltaY * 0.0015));

    setZoom(nextScale, anchorX, anchorY);
  },
  { passive: false },
);

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  dragging = true;
  dragPointer = event.pointerId;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragOriginX = panX;
  dragOriginY = panY;

  viewport.classList.add("dragging");
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", (event) => {
  if (!dragging || event.pointerId !== dragPointer) {
    return;
  }

  panX = dragOriginX + event.clientX - dragStartX;
  panY = dragOriginY + event.clientY - dragStartY;
  applyTransform();
});

function stopDragging(event) {
  if (!dragging || event.pointerId !== dragPointer) {
    return;
  }

  dragging = false;
  dragPointer = null;
  viewport.classList.remove("dragging");

  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }
}

viewport.addEventListener("pointerup", stopDragging);
viewport.addEventListener("pointercancel", stopDragging);
viewport.addEventListener("dblclick", fit);

window.addEventListener("resize", () => window.requestAnimationFrame(fit));
document.addEventListener("fullscreenchange", () => window.setTimeout(fit, 100));

function setFooterYear() {
  copyrightYear.textContent = String(browserYear());
}

function restoreSettings() {
  const savedSource = localStorage.getItem("mermaid-viewer-source");
  const savedVersion = localStorage.getItem("mermaid-viewer-version");
  const savedTheme = localStorage.getItem("mermaid-viewer-theme");
  const savedLayout = localStorage.getItem("mermaid-viewer-layout");
  const savedWidth = localStorage.getItem("mermaid-viewer-width");

  if (savedSource !== null) {
    editor.value = savedSource;
  }

  try {
    if (savedVersion) {
      versionInput.value = validateMermaidVersion(savedVersion);
    }
  } catch {
    versionInput.value = DEFAULTS.mermaidVersion;
  }

  themeSelect.value = normaliseTheme(savedTheme || DEFAULTS.theme);
  layoutSelect.value = normaliseLayout(savedLayout || DEFAULTS.layout);
  widthInput.value = String(clampRenderWidth(savedWidth || DEFAULTS.renderWidth));
}

setFooterYear();
restoreSettings();
applyDimensions();
actualSize();
createRenderer({ fitAfter: true });
