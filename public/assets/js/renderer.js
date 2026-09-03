(() => {
  "use strict";

  const PARENT_MESSAGE_SOURCE = "mermaid-viewer-parent";
  const FRAME_MESSAGE_SOURCE = "mermaid-viewer-renderer";
  const DEFAULT_VERSION = "11.15.0";
  const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  const INTEGRITY_VERIFIED = "verified";
  const INTEGRITY_UNVERIFIED = "unverified";
  const INTEGRITY_FAILED = "failed";
  const SUPPORTED_LAYOUTS = new Set([
    "elk",
    "tidy-tree",
    "cose-bilkent",
    "dagre",
  ]);

  const params = new URLSearchParams(window.location.search);
  const channel = params.get("channel") || "";
  const requestedVersion = params.get("version") || DEFAULT_VERSION;
  const version = VERSION_PATTERN.test(requestedVersion)
    ? requestedVersion
    : DEFAULT_VERSION;

  const integrityManifest = globalThis.MERMAID_VIEWER_INTEGRITY_MANIFEST;

  const diagram = document.getElementById("diagram");

  let mermaid = null;
  let mermaidIntegrity = null;
  const registeredExternalLayouts = new Set();
  const layoutIntegrity = new Map();

  function post(type, value = null) {
    window.parent.postMessage(
      {
        source: FRAME_MESSAGE_SOURCE,
        channel,
        type,
        version,
        value,
      },
      "*",
    );
  }

  function integrityError(message) {
    const error = new Error(message);
    error.code = "integrity-error";
    return error;
  }

  function rendererError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function hasDigest(record) {
    return Boolean(
      record
        && typeof record.artifact === "string"
        && /^sha384-[A-Za-z0-9+/]{64}$/.test(record.digest),
    );
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  async function matchesDigest(bytes, expectedDigest) {
    const digest = await crypto.subtle.digest("SHA-384", bytes);
    return `sha384-${bytesToBase64(new Uint8Array(digest))}` === expectedDigest;
  }

  async function executeBytes(bytes, label) {
    if (!(bytes instanceof ArrayBuffer)) {
      throw new Error(`Missing executable bytes for ${label}`);
    }

    const blobUrl = URL.createObjectURL(
      new Blob([bytes], { type: "text/javascript" }),
    );

    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.nonce = "bWVybWFpZC12aWV3ZXItcmVuZGVyZXI=";
        script.src = blobUrl;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Unable to execute ${label}`));
        document.head.append(script);
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  async function executeVerifiedArtifact(artifact, record, label) {
    if (!(artifact?.bytes instanceof ArrayBuffer)) {
      throw rendererError(`Missing executable bytes for ${label}`, "artifact-error");
    }

    if (!record?.digest || !await matchesDigest(artifact.bytes, record.digest)) {
      throw integrityError(
        `${label} does not match the integrity value trusted by Mermaid Viewer. Execution has been blocked.`,
      );
    }

    await executeBytes(artifact.bytes, label);
  }

  async function loadMermaid(artifact, unverifiedConsentVersion) {
    if (mermaid) {
      return mermaid;
    }

    const record = integrityManifest?.versions?.[version];

    try {
      if (hasDigest(record)) {
        post("progress", { phase: `Verifying Mermaid ${version}` });
        await executeVerifiedArtifact(artifact, record, `Mermaid ${version}`);
        mermaidIntegrity = INTEGRITY_VERIFIED;
      } else {
        if (unverifiedConsentVersion !== version) {
          throw integrityError(
            `Mermaid ${version} has no trusted integrity record and was not approved for unverified execution.`,
          );
        }

        post("progress", { phase: `Executing unverified Mermaid ${version}` });
        await executeBytes(artifact?.bytes, `unverified Mermaid ${version}`);
        mermaidIntegrity = INTEGRITY_UNVERIFIED;
      }
    } catch (error) {
      if (error.code !== "integrity-error") {
        error.code = "mermaid-load-error";
      }
      throw error;
    }

    mermaid = globalThis.mermaid;
    if (!mermaid?.initialize || !mermaid?.render) {
      throw rendererError(
        `Mermaid ${version} did not expose the expected browser API`,
        "mermaid-load-error",
      );
    }
    return mermaid;
  }

  async function ensureExternalLayoutRegistered(
    layout,
    artifact,
    unverifiedConsentVersion,
  ) {
    const definition = integrityManifest?.layouts?.[layout];

    if (definition?.builtIn || registeredExternalLayouts.has(layout)) {
      return;
    }

    if (!hasDigest(definition)) {
      if (unverifiedConsentVersion !== version) {
        throw integrityError(
          `Layout ${layout} has no trusted integrity record and was not approved for unverified execution.`,
        );
      }

      await executeBytes(artifact?.bytes, `unverified layout ${layout}`);
      layoutIntegrity.set(layout, INTEGRITY_UNVERIFIED);
    } else {
      const displayName = `${definition.package} ${definition.version}`;
      post("progress", { phase: `Verifying ${displayName}` });
      try {
        await executeVerifiedArtifact(artifact, definition, displayName);
      } catch (error) {
        if (error.code !== "integrity-error") {
          error.code = "layout-error";
        }
        throw error;
      }

      layoutIntegrity.set(layout, INTEGRITY_VERIFIED);
    }

    const displayName = `${definition.package} ${definition.version}`;
    const loaders = globalThis.mermaidViewerLayouts?.[layout];

    if (!loaders) {
      throw rendererError(
        `${displayName} did not expose the expected layout API`,
        "layout-error",
      );
    }

    mermaid.registerLayoutLoaders(loaders);
    registeredExternalLayouts.add(layout);
  }

  function normaliseLayout(value) {
    return SUPPORTED_LAYOUTS.has(value) ? value : "elk";
  }

  function diagramType(source) {
    const withoutFrontmatter = source.replace(/^\s*---[\s\S]*?---\s*/u, "");
    const firstContentLine = withoutFrontmatter
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("%%"));

    return firstContentLine?.split(/\s/u, 1)[0]?.toLowerCase() || "";
  }

  function assertLayoutCompatibility(source, layout) {
    const type = diagramType(source);

    if (
      (layout === "tidy-tree" || layout === "cose-bilkent")
      && (type === "flowchart" || type === "graph")
    ) {
      const displayName = layout === "tidy-tree" ? "Tidy Tree" : "Cose Bilkent";
      throw rendererError(
        `${displayName} cannot lay out flowchart diagrams in Mermaid ${version}. Use ELK or Dagre for this source, or change the diagram to mindmap syntax.`,
        "layout-error",
      );
    }
  }

  function layoutPackage(layout) {
    const definition = integrityManifest?.layouts?.[layout];
    return definition?.package
      ? `${definition.package} ${definition.version}`
      : null;
  }

  function overallIntegrity(layout) {
    const definition = integrityManifest?.layouts?.[layout];
    const selectedLayoutIntegrity = definition?.builtIn
      ? mermaidIntegrity
      : layoutIntegrity.get(layout);

    return mermaidIntegrity === INTEGRITY_VERIFIED
      && selectedLayoutIntegrity === INTEGRITY_VERIFIED
      ? INTEGRITY_VERIFIED
      : INTEGRITY_UNVERIFIED;
  }

  function measureHeight() {
    const svg = diagram.querySelector("svg");

    if (!svg) {
      return 1;
    }

    const rect = svg.getBoundingClientRect();
    return Math.max(1, Math.ceil(rect.bottom));
  }

  function clearDiagram() {
    diagram.innerHTML = "";
    post("cleared", { height: 1 });
  }

  function createMermaidConfig({ layout, theme }) {
    const config = {
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      layout,
      logLevel: "fatal",
      suppressErrorRendering: true,
    };

    // Mermaid v11 supports top-level `layout`. Retain the older flowchart
    // renderer hint only for ELK/Dagre, where it improves compatibility with
    // v11 renderers. Tidy Tree and Cose Bilkent use the layout API directly.
    if (layout === "elk") {
      config.flowchart = {
        defaultRenderer: "elk",
      };
    } else if (layout === "dagre") {
      config.flowchart = {
        defaultRenderer: "dagre-wrapper",
      };
    }

    return config;
  }

  async function renderDiagram(message) {
    const source = String(message.mermaidSource ?? "");

    if (source.trim().length === 0) {
      clearDiagram();
      return;
    }

    try {
      const layout = normaliseLayout(message.layout);
      const theme = message.theme === "dark" ? "dark" : "default";

      assertLayoutCompatibility(source, layout);

      await loadMermaid(
        message.artifacts?.mermaid,
        message.unverifiedConsentVersion,
      );
      await ensureExternalLayoutRegistered(
        layout,
        message.artifacts?.layout,
        message.unverifiedConsentVersion,
      );
      post("artifacts-ready", { integrity: overallIntegrity(layout) });
      post("progress", { phase: `Rendering with Mermaid ${version}` });

      mermaid.initialize(
        createMermaidConfig({
          layout,
          theme,
        }),
      );

      const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(renderId, source);
      post("progress", { phase: `Mermaid ${version} render complete` });

      diagram.innerHTML = result.svg;
      result.bindFunctions?.(diagram);

      let reported = false;
      const reportRendered = () => {
        if (reported) {
          return;
        }

        reported = true;
        post("rendered", {
          height: measureHeight(),
          layout,
          layoutPackage: layoutPackage(layout),
          integrity: overallIntegrity(layout),
        });
      };

      requestAnimationFrame(() => requestAnimationFrame(reportRendered));
      window.setTimeout(reportRendered, 100);
    } catch (error) {
      post("error", {
        message: error?.message || String(error),
        code: error?.code || "renderer-error",
        integrity: error?.code === "integrity-error"
          ? INTEGRITY_FAILED
          : overallIntegrity(normaliseLayout(message.layout)),
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) {
      return;
    }

    const message = event.data;

    if (
      !message
      || typeof message !== "object"
      || message.source !== PARENT_MESSAGE_SOURCE
      || message.channel !== channel
    ) {
      return;
    }

    if (message.type === "clear") {
      clearDiagram();
      return;
    }

    if (message.type === "render") {
      renderDiagram(message);
    }
  });

  post("ready");
})();
