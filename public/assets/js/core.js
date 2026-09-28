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

export const LAYOUT_MODES = Object.freeze([
  "auto",
  "forced",
]);

export const DEFAULTS = Object.freeze({
  mermaidVersion: "11.15.0",
  layout: "elk",
  layoutMode: "auto",
  theme: "light",
  renderWidth: 1216,
  minimumRenderWidth: 480,
  maximumRenderWidth: 3000,
  minimumScale: 0.08,
  maximumScale: 6,
  zoomFactor: 1.18,
});

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const FRONTMATTER_PATTERN = /^(\uFEFF?[ \t]*---[ \t]*\r?\n)([\s\S]*?)(\r?\n[ \t]*---[ \t]*)(\r?\n|$)/u;

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

export function normaliseLayoutMode(value) {
  return value === "forced" ? "forced" : "auto";
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

function splitFrontmatter(source) {
  const text = String(source ?? "");
  const match = text.match(FRONTMATTER_PATTERN);

  if (!match) {
    return null;
  }

  return {
    opening: match[1],
    body: match[2],
    closing: `${match[3]}${match[4]}`,
    rest: text.slice(match[0].length),
  };
}

function indentation(line) {
  let width = 0;

  for (const character of line) {
    if (character === " ") {
      width += 1;
    } else if (character === "\t") {
      width += 2;
    } else {
      break;
    }
  }

  return width;
}

function parseYamlScalar(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    return end >= 1 ? trimmed.slice(1, end) : trimmed.slice(1);
  }

  if (trimmed.startsWith("'")) {
    const end = trimmed.indexOf("'", 1);
    return end >= 1 ? trimmed.slice(1, end) : trimmed.slice(1);
  }

  return trimmed.split(/\s+#/u, 1)[0].trim();
}

function directChildIndent(lines, parentIndex, parentIndent) {
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = indentation(line);
    if (indent <= parentIndent) {
      return null;
    }

    return indent;
  }

  return null;
}

function layoutDetectionResult(raw, sourcePath) {
  const normalised = String(raw ?? "").trim().toLowerCase();

  if (SUPPORTED_LAYOUTS.includes(normalised)) {
    return {
      status: "detected",
      layout: normalised,
      raw: normalised,
      source: sourcePath,
    };
  }

  if (
    sourcePath === "config.flowchart.defaultRenderer"
    && (normalised === "dagre-wrapper" || normalised === "dagre")
  ) {
    return {
      status: "detected",
      layout: "dagre",
      raw: normalised,
      source: sourcePath,
    };
  }

  if (sourcePath === "config.flowchart.defaultRenderer" && normalised === "elk") {
    return {
      status: "detected",
      layout: "elk",
      raw: normalised,
      source: sourcePath,
    };
  }

  return {
    status: "unsupported",
    layout: null,
    raw: normalised || String(raw ?? ""),
    source: sourcePath,
  };
}

export function detectFrontmatterLayout(source) {
  const frontmatter = splitFrontmatter(source);

  if (!frontmatter) {
    return {
      status: "missing",
      layout: null,
      raw: null,
      source: null,
    };
  }

  const body = frontmatter.body;

  const inlineConfig = body.match(/^\s*config\s*:\s*\{([^}\n]*)\}\s*(?:#.*)?$/imu);
  if (inlineConfig) {
    const layout = inlineConfig[1].match(
      /(?:^|,)\s*layout\s*:\s*("[^"]*"|'[^']*'|[^,}#]+)/iu,
    );

    if (layout) {
      return layoutDetectionResult(
        parseYamlScalar(layout[1]),
        "config.layout",
      );
    }
  }

  const lines = body.split(/\r?\n/u);
  let configIndex = -1;
  let configIndent = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)config\s*:\s*(?:#.*)?$/iu);
    if (match) {
      configIndex = index;
      configIndent = indentation(lines[index]);
      break;
    }
  }

  if (configIndex < 0) {
    return {
      status: "missing",
      layout: null,
      raw: null,
      source: null,
    };
  }

  const configChildIndent = directChildIndent(lines, configIndex, configIndent);
  if (configChildIndent === null) {
    return {
      status: "missing",
      layout: null,
      raw: null,
      source: null,
    };
  }

  let flowchartIndex = -1;

  for (let index = configIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = indentation(line);
    if (indent <= configIndent) {
      break;
    }

    if (indent !== configChildIndent) {
      continue;
    }

    const layoutMatch = line.match(/^\s*layout\s*:\s*(.+?)\s*$/iu);
    if (layoutMatch) {
      return layoutDetectionResult(
        parseYamlScalar(layoutMatch[1]),
        "config.layout",
      );
    }

    if (/^\s*flowchart\s*:\s*(?:#.*)?$/iu.test(line)) {
      flowchartIndex = index;
    }
  }

  if (flowchartIndex >= 0) {
    const flowchartIndent = indentation(lines[flowchartIndex]);
    const flowchartChildIndent = directChildIndent(lines, flowchartIndex, flowchartIndent);

    if (flowchartChildIndent !== null) {
      for (let index = flowchartIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const indent = indentation(line);
        if (indent <= flowchartIndent) {
          break;
        }

        if (indent !== flowchartChildIndent) {
          continue;
        }

        const rendererMatch = line.match(/^\s*defaultRenderer\s*:\s*(.+?)\s*$/iu);
        if (rendererMatch) {
          return layoutDetectionResult(
            parseYamlScalar(rendererMatch[1]),
            "config.flowchart.defaultRenderer",
          );
        }
      }
    }
  }

  return {
    status: "missing",
    layout: null,
    raw: null,
    source: null,
  };
}

function replaceInlineConfigLayout(body, layout) {
  const pattern = /^(\s*config\s*:\s*\{)([^}\n]*)(\}\s*(?:#.*)?)$/imu;
  const match = body.match(pattern);

  if (!match) {
    return null;
  }

  let mapping = match[2];
  const layoutPattern = /((?:^|,)\s*layout\s*:\s*)("[^"]*"|'[^']*'|[^,}#]+)/iu;

  if (layoutPattern.test(mapping)) {
    mapping = mapping.replace(layoutPattern, `$1${layout}`);
  } else {
    const separator = mapping.trim().length === 0 ? "" : ", ";
    mapping = `${mapping.trimEnd()}${separator}layout: ${layout}`;
  }

  return body.replace(pattern, `$1${mapping}$3`);
}

export function forceFrontmatterLayout(source, requestedLayout) {
  const layout = String(requestedLayout ?? "");

  if (!SUPPORTED_LAYOUTS.includes(layout)) {
    throw new Error(`Unsupported Mermaid layout: ${layout || "(empty)"}`);
  }

  const text = String(source ?? "");
  const frontmatter = splitFrontmatter(text);

  if (!frontmatter) {
    return [
      "---",
      "config:",
      `  layout: ${layout}`,
      "---",
      text,
    ].join("\n");
  }

  const inlineReplacement = replaceInlineConfigLayout(frontmatter.body, layout);
  if (inlineReplacement !== null) {
    return `${frontmatter.opening}${inlineReplacement}${frontmatter.closing}${frontmatter.rest}`;
  }

  const newline = frontmatter.body.includes("\r\n") ? "\r\n" : "\n";
  const lines = frontmatter.body.split(/\r?\n/u);
  let configIndex = -1;
  let configIndent = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*config\s*:\s*(?:#.*)?$/iu.test(lines[index])) {
      configIndex = index;
      configIndent = indentation(lines[index]);
      break;
    }
  }

  if (configIndex < 0) {
    if (lines.length === 1 && lines[0] === "") {
      lines.length = 0;
    }

    if (lines.length > 0 && lines.at(-1).trim() !== "") {
      lines.push("");
    }

    lines.push("config:");
    lines.push(`  layout: ${layout}`);
  } else {
    const childIndent = directChildIndent(lines, configIndex, configIndent) ?? (configIndent + 2);
    let replaced = false;

    for (let index = configIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const indent = indentation(line);
      if (indent <= configIndent) {
        break;
      }

      if (indent !== childIndent) {
        continue;
      }

      if (/^\s*layout\s*:/iu.test(line)) {
        const comment = line.match(/\s+#.*$/u)?.[0] ?? "";
        lines[index] = `${" ".repeat(childIndent)}layout: ${layout}${comment}`;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      lines.splice(
        configIndex + 1,
        0,
        `${" ".repeat(childIndent)}layout: ${layout}`,
      );
    }
  }

  return `${frontmatter.opening}${lines.join(newline)}${frontmatter.closing}${frontmatter.rest}`;
}

export function resolveLayoutForRender({
  source,
  mode = DEFAULTS.layoutMode,
  selectedLayout = DEFAULTS.layout,
}) {
  const layoutMode = normaliseLayoutMode(mode);
  const detection = detectFrontmatterLayout(source);

  if (layoutMode === "auto") {
    if (detection.status === "unsupported") {
      return {
        mode: layoutMode,
        layout: null,
        detection,
        mermaidSource: String(source ?? ""),
      };
    }

    return {
      mode: layoutMode,
      layout: detection.layout ?? DEFAULTS.layout,
      detection,
      mermaidSource: String(source ?? ""),
    };
  }

  const layout = normaliseLayout(selectedLayout);

  return {
    mode: layoutMode,
    layout,
    detection,
    mermaidSource: forceFrontmatterLayout(source, layout),
  };
}
