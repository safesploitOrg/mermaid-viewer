(() => {
  "use strict";

  const PARENT_MESSAGE_SOURCE = "mermaid-viewer-parent";
  const FRAME_MESSAGE_SOURCE = "mermaid-viewer-renderer";
  const DEFAULT_VERSION = "11.15.0";
  const ELK_VERSION = "0.2.1";
  const TIDY_TREE_VERSION = "0.2.2";
  const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
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

  const mermaidUrls = [
    `https://cdn.jsdelivr.net/npm/mermaid@${version}/dist/mermaid.esm.min.mjs`,
    `https://unpkg.com/mermaid@${version}/dist/mermaid.esm.min.mjs`,
  ];

  const externalLayoutPackages = {
    elk: {
      displayName: `@mermaid-js/layout-elk ${ELK_VERSION}`,
      urls: [
        `https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@${ELK_VERSION}/dist/mermaid-layout-elk.esm.min.mjs`,
        `https://unpkg.com/@mermaid-js/layout-elk@${ELK_VERSION}/dist/mermaid-layout-elk.esm.min.mjs`,
      ],
    },
    "tidy-tree": {
      displayName: `@mermaid-js/layout-tidy-tree ${TIDY_TREE_VERSION}`,
      urls: [
        `https://cdn.jsdelivr.net/npm/@mermaid-js/layout-tidy-tree@${TIDY_TREE_VERSION}/dist/mermaid-layout-tidy-tree.esm.min.mjs`,
        `https://unpkg.com/@mermaid-js/layout-tidy-tree@${TIDY_TREE_VERSION}/dist/mermaid-layout-tidy-tree.esm.min.mjs`,
      ],
    },
  };

  const diagram = document.getElementById("diagram");

  let mermaid = null;
  const registeredExternalLayouts = new Set();

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

  async function importFirst(urls, errorMessage) {
    let lastError = null;

    for (const url of urls) {
      try {
        return await import(url);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(errorMessage);
  }

  async function loadMermaid() {
    if (mermaid) {
      return mermaid;
    }

    const module = await importFirst(
      mermaidUrls,
      `Unable to load Mermaid ${version}`,
    );

    mermaid = module.default;
    return mermaid;
  }

  async function ensureExternalLayoutRegistered(layout) {
    const definition = externalLayoutPackages[layout];

    if (!definition || registeredExternalLayouts.has(layout)) {
      return;
    }

    const module = await importFirst(
      definition.urls,
      `Unable to load ${definition.displayName}`,
    );

    mermaid.registerLayoutLoaders(module.default);
    registeredExternalLayouts.add(layout);
  }

  function normaliseLayout(value) {
    return SUPPORTED_LAYOUTS.has(value) ? value : "elk";
  }

  function layoutPackage(layout) {
    return externalLayoutPackages[layout]?.displayName || null;
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
      await loadMermaid();

      const layout = normaliseLayout(message.layout);
      const theme = message.theme === "dark" ? "dark" : "default";

      await ensureExternalLayoutRegistered(layout);

      mermaid.initialize(
        createMermaidConfig({
          layout,
          theme,
        }),
      );

      const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(renderId, source);

      diagram.innerHTML = result.svg;
      result.bindFunctions?.(diagram);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          post("rendered", {
            height: measureHeight(),
            layout,
            layoutPackage: layoutPackage(layout),
          });
        });
      });
    } catch (error) {
      post("error", {
        message: error?.message || String(error),
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
