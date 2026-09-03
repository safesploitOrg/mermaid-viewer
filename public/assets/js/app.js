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

import {
  INTEGRITY_FAILED,
  INTEGRITY_UNVERIFIED,
  INTEGRITY_VERIFIED,
  LOAD_INTEGRITY_ERROR,
  LOAD_NETWORK_ERROR,
  approveVersion,
  buildUnverifiedMermaidUrls,
  canContinueUnverified,
  clearConsentForVersionChange,
  downloadAndVerify,
  downloadFirst,
  hasDigest,
  hasVersionConsent,
  integrityCoverage,
} from "./integrity.js";

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
const integrityStatus = document.getElementById("integrityStatus");
const zoomLabel = document.getElementById("zoomLabel");
const copyrightYear = document.getElementById("copyrightYear");
const integrityDialog = document.getElementById("integrityDialog");
const integrityDialogDescription = document.getElementById("integrityDialogDescription");
const integrityConsent = document.getElementById("integrityConsent");
const continueUnverified = document.getElementById("continueUnverified");
const cancelUnverified = document.getElementById("cancelUnverified");

const defaultExample = editor.value;

let frameHeight = 720;
let rendererReady = false;
let currentRendererVersion = null;
let currentRendererLayout = null;
let channel = "";
let scale = 1;
let panX = 24;
let panY = 24;
let liveTimer = null;
let renderTimeout = null;
let fitAfterRender = true;
let currentArtifacts = null;
let rendererArtifactsReady = false;
let consent = { approvedVersion: null };
let pendingUnverifiedVersion = null;
let rendererRequestId = 0;

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

function setIntegrityStatus(state, text) {
  integrityStatus.className = `integrity-status ${state}`;
  integrityStatus.textContent = text;
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
      "The sandboxed renderer did not respond after its executable artefacts were prepared.",
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

function localArtifactUrl(record) {
  return new URL(record.artifact, window.location.href).href;
}

async function loadTrustedArtifact(record, label) {
  try {
    return await downloadAndVerify(
      [localArtifactUrl(record)],
      record.digest,
    );
  } catch (error) {
    if (error.code === LOAD_INTEGRITY_ERROR) {
      throw new Error(
        `❌ Integrity verification failed\n\n${label} does not match the integrity value trusted by Mermaid Viewer.\n\nExecution has been blocked.`,
        { cause: error },
      );
    }

    const wrapped = new Error(
      `Unable to download ${label}. The trusted local artefact did not respond successfully.`,
      { cause: error },
    );
    wrapped.code = LOAD_NETWORK_ERROR;
    throw wrapped;
  }
}

async function prepareArtifacts(version, layout, coverage) {
  let mermaidArtifact;

  if (hasDigest(coverage.mermaid)) {
    mermaidArtifact = await loadTrustedArtifact(
      coverage.mermaid,
      `Mermaid ${version}`,
    );
  } else {
    try {
      mermaidArtifact = await downloadFirst(buildUnverifiedMermaidUrls(version));
    } catch (error) {
      const wrapped = new Error(
        `Unable to download Mermaid ${version}. Neither configured CDN responded successfully.`,
        { cause: error },
      );
      wrapped.code = LOAD_NETWORK_ERROR;
      throw wrapped;
    }
  }

  let layoutArtifact = null;
  if (!coverage.layout?.builtIn) {
    if (!coverage.layout?.artifact) {
      throw new Error(`No executable artefact is configured for layout ${layout}`);
    }

    layoutArtifact = hasDigest(coverage.layout)
      ? await loadTrustedArtifact(
        coverage.layout,
        `${coverage.layout.package} ${coverage.layout.version}`,
      )
      : await downloadFirst([localArtifactUrl(coverage.layout)]);
  }

  return {
    mermaid: mermaidArtifact,
    layout: layoutArtifact,
  };
}

function invalidateRenderer() {
  rendererRequestId += 1;
  rendererReady = false;
  currentRendererVersion = null;
  currentRendererLayout = null;
  currentArtifacts = null;
  rendererArtifactsReady = false;
  clearRenderTimeout();
  iframe.src = "about:blank";
}

function showUnverifiedWarning(version, coverage) {
  pendingUnverifiedVersion = version;
  integrityConsent.checked = false;
  continueUnverified.disabled = true;
  integrityDialogDescription.textContent = coverage.knownVersion
    ? `The selected rendering stack for Mermaid ${version} is missing trusted integrity metadata.`
    : `Mermaid Viewer does not have a trusted integrity record for Mermaid version ${version}.`;
  integrityDialog.hidden = false;
  setIntegrityStatus(INTEGRITY_UNVERIFIED, "⚠️ Integrity unverified");
  setStatus("Awaiting unverified-version consent", "waiting");
  setDiagnostics(`Integrity metadata missing · Mermaid ${version} · execution not started`);
}

function hideUnverifiedWarning() {
  integrityDialog.hidden = true;
  pendingUnverifiedVersion = null;
  integrityConsent.checked = false;
  continueUnverified.disabled = true;
}

async function createRenderer({ fitAfter = true } = {}) {
  let version;

  try {
    version = validateMermaidVersion(versionInput.value);
  } catch (error) {
    invalidateRenderer();
    hideUnverifiedWarning();
    showError(error.message);
    setStatus("Invalid Mermaid version", "error");
    setIntegrityStatus(INTEGRITY_UNVERIFIED, "⚠️ Invalid version");
    return;
  }

  versionInput.value = version;
  const layout = normaliseLayout(layoutSelect.value);
  const coverage = integrityCoverage(version, layout);

  if (!coverage.fullyCovered && !hasVersionConsent(consent, version)) {
    invalidateRenderer();
    showUnverifiedWarning(version, coverage);
    showOverlay("Unverified JavaScript will not be downloaded without explicit consent.");
    return;
  }

  hideUnverifiedWarning();
  const requestId = ++rendererRequestId;

  rendererReady = false;
  currentRendererVersion = version;
  currentRendererLayout = layout;
  currentArtifacts = null;
  rendererArtifactsReady = false;
  channel = createChannelId();
  frameHeight = 720;
  fitAfterRender = fitAfter;

  clearRenderTimeout();
  clearError();
  applyDimensions();

  showOverlay(`Preparing Mermaid ${version}…`);
  setStatus(`Preparing Mermaid ${version}…`, "waiting");
  setIntegrityStatus(
    coverage.fullyCovered ? "checking" : INTEGRITY_UNVERIFIED,
    coverage.fullyCovered ? "Checking integrity…" : "⚠️ Integrity unverified",
  );
  setDiagnostics(`Downloading executable stack · Mermaid ${version} · ${layoutLabel(layout)}`);

  try {
    const artifacts = await prepareArtifacts(version, layout, coverage);

    if (requestId !== rendererRequestId) {
      return;
    }

    currentArtifacts = artifacts;
    setIntegrityStatus(
      coverage.fullyCovered ? INTEGRITY_VERIFIED : INTEGRITY_UNVERIFIED,
      coverage.fullyCovered ? "✅ Integrity verified" : "⚠️ Integrity unverified",
    );
  } catch (error) {
    if (requestId !== rendererRequestId) {
      return;
    }

    rendererReady = false;
    currentRendererVersion = null;
    const integrityFailure = error.cause?.code === LOAD_INTEGRITY_ERROR;
    setIntegrityStatus(
      integrityFailure ? INTEGRITY_FAILED : INTEGRITY_UNVERIFIED,
      integrityFailure
        ? "❌ Integrity verification failed"
        : "⚠️ Download failed",
    );
    setStatus(
      integrityFailure ? "Execution blocked" : "Executable download failed",
      "error",
    );
    setDiagnostics(
      integrityFailure
        ? `Integrity mismatch · Mermaid ${version} · execution blocked`
        : `Network failure · Mermaid ${version}`,
    );
    showError(error.message);
    showOverlay(integrityFailure ? "Execution blocked by integrity policy." : error.message);
    return;
  }

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

  const layout = normaliseLayout(layoutSelect.value);

  if (version !== currentRendererVersion || layout !== currentRendererLayout) {
    createRenderer({ fitAfter });
    return;
  }

  if (!rendererReady || !iframe.contentWindow) {
    setStatus("Renderer still loading…", "waiting");
    return;
  }

  persistSettings();

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
      artifacts: rendererArtifactsReady ? null : currentArtifacts,
      unverifiedConsentVersion: hasVersionConsent(consent, version)
        ? version
        : null,
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

  if (message.type === "progress") {
    const phase = message.value?.phase || "Preparing renderer";
    setDiagnostics(`${phase} · sandboxed execution`);
    return;
  }

  if (message.type === "artifacts-ready") {
    rendererArtifactsReady = true;
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
    const integrity = message.value?.integrity === INTEGRITY_VERIFIED
      ? INTEGRITY_VERIFIED
      : INTEGRITY_UNVERIFIED;

    setIntegrityStatus(
      integrity,
      integrity === INTEGRITY_VERIFIED
        ? "✅ Integrity verified"
        : "⚠️ Integrity unverified",
    );

    setStatus(
      `Rendered · Mermaid ${message.version} · ${renderedLayoutName}`,
      "ready",
    );
    setDiagnostics(
      `Rendered · Mermaid ${message.version} · ${renderedLayoutName}${packageSuffix} · integrity ${integrity.toUpperCase()} · ${renderWidthPx()}px × ${frameHeight}px`,
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
    const code = message.value?.code || "renderer-error";
    const integrityFailure = code === LOAD_INTEGRITY_ERROR;
    showError(message.value?.message || "Unknown Mermaid rendering error");
    setStatus(
      integrityFailure
        ? "Execution blocked"
        : code === "layout-error"
          ? "Layout package failed"
          : code === "mermaid-load-error"
            ? "Mermaid runtime failed to load"
          : "Mermaid render failed",
      "error",
    );
    if (integrityFailure) {
      setIntegrityStatus(INTEGRITY_FAILED, "❌ Integrity verification failed");
    }
    setDiagnostics(
      `${integrityFailure ? "Integrity mismatch" : code} · Mermaid ${message.version}`,
    );
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

versionInput.addEventListener("input", () => {
  consent = clearConsentForVersionChange(consent, versionInput.value);
  invalidateRenderer();
  hideUnverifiedWarning();

  try {
    const version = validateMermaidVersion(versionInput.value);
    const coverage = integrityCoverage(version, normaliseLayout(layoutSelect.value));
    setIntegrityStatus(
      coverage.fullyCovered ? "checking" : INTEGRITY_UNVERIFIED,
      coverage.fullyCovered ? "Checking integrity…" : "⚠️ Integrity unverified",
    );
    setDiagnostics(`Version changed · Mermaid ${version} · execution stopped`);
  } catch {
    setIntegrityStatus(INTEGRITY_UNVERIFIED, "⚠️ Invalid version");
    setDiagnostics("Invalid Mermaid semantic version · execution stopped");
  }
});
versionInput.addEventListener("change", () => createRenderer({ fitAfter: true }));
themeSelect.addEventListener("change", () => sendRender({ fitAfter: true }));
layoutSelect.addEventListener("change", () => sendRender({ fitAfter: true }));

integrityConsent.addEventListener("change", () => {
  continueUnverified.disabled = !canContinueUnverified({
    checkboxChecked: integrityConsent.checked,
    requestedVersion: pendingUnverifiedVersion,
  });
});

cancelUnverified.addEventListener("click", () => {
  hideUnverifiedWarning();
  setStatus("Unverified execution cancelled", "waiting");
  setDiagnostics("Unverified executable was not downloaded");
  showOverlay("Unverified execution cancelled.");
});

continueUnverified.addEventListener("click", () => {
  if (!canContinueUnverified({
    checkboxChecked: integrityConsent.checked,
    requestedVersion: pendingUnverifiedVersion,
  })) {
    return;
  }

  const approvedVersion = pendingUnverifiedVersion;
  consent = approveVersion(consent, approvedVersion);
  hideUnverifiedWarning();
  createRenderer({ fitAfter: true });
});

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
