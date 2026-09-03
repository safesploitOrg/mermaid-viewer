import { validateMermaidVersion } from "./core.js";
import "./externals/mermaid-integrity.js";

export const INTEGRITY_VERIFIED = "verified";
export const INTEGRITY_UNVERIFIED = "unverified";
export const INTEGRITY_FAILED = "failed";
export const LOAD_NETWORK_ERROR = "network-error";
export const LOAD_INTEGRITY_ERROR = "integrity-error";

export const TRUSTED_INTEGRITY_MANIFEST =
  globalThis.MERMAID_VIEWER_INTEGRITY_MANIFEST;

export function trustedVersionRecord(
  version,
  manifest = TRUSTED_INTEGRITY_MANIFEST,
) {
  const validVersion = validateMermaidVersion(version);
  return manifest?.versions?.[validVersion] || null;
}

export function trustedLayoutRecord(
  layout,
  manifest = TRUSTED_INTEGRITY_MANIFEST,
) {
  return manifest?.layouts?.[layout] || null;
}

export function hasDigest(record) {
  return Boolean(
    record
      && typeof record.artifact === "string"
      && /^sha384-[A-Za-z0-9+/]{64}$/.test(record.digest),
  );
}

export function integrityCoverage(
  version,
  layout,
  manifest = TRUSTED_INTEGRITY_MANIFEST,
) {
  const mermaid = trustedVersionRecord(version, manifest);
  const layoutRecord = trustedLayoutRecord(layout, manifest);
  const mermaidCovered = hasDigest(mermaid);
  const layoutCovered = Boolean(
    layoutRecord?.builtIn ? mermaidCovered : hasDigest(layoutRecord),
  );

  return {
    knownVersion: Boolean(mermaid),
    fullyCovered: mermaidCovered && layoutCovered,
    mermaid,
    layout: layoutRecord,
    missing: [
      ...(!mermaidCovered ? ["mermaid"] : []),
      ...(!layoutCovered ? ["layout"] : []),
    ],
  };
}

export function buildUnverifiedMermaidUrls(version) {
  const validVersion = validateMermaidVersion(version);
  const encodedVersion = encodeURIComponent(validVersion);

  return [
    `https://cdn.jsdelivr.net/npm/mermaid@${encodedVersion}/dist/mermaid.min.js`,
    `https://unpkg.com/mermaid@${encodedVersion}/dist/mermaid.min.js`,
  ];
}

export async function calculateSha384(bytes, subtle = globalThis.crypto?.subtle) {
  if (!subtle) {
    throw new Error("Web Crypto is unavailable; integrity cannot be verified");
  }

  const digest = await subtle.digest("SHA-384", bytes);
  const base64 = bytesToBase64(new Uint8Array(digest));
  return `sha384-${base64}`;
}

export async function digestMatches(bytes, expectedDigest, subtle) {
  if (!/^sha384-[A-Za-z0-9+/]{64}$/.test(expectedDigest || "")) {
    return false;
  }

  return await calculateSha384(bytes, subtle) === expectedDigest;
}

export class ArtifactLoadError extends Error {
  constructor(message, code, cause = null) {
    super(message, { cause });
    this.name = "ArtifactLoadError";
    this.code = code;
  }
}

export async function downloadFirst(urls, fetchImplementation = globalThis.fetch) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetchImplementation(url, {
        cache: "no-cache",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        bytes: await response.arrayBuffer(),
        sourceUrl: url,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new ArtifactLoadError(
    "None of the configured sources responded successfully",
    LOAD_NETWORK_ERROR,
    lastError,
  );
}

export async function downloadAndVerify(
  urls,
  expectedDigest,
  { fetchImplementation = globalThis.fetch, subtle } = {},
) {
  const artifact = await downloadFirst(urls, fetchImplementation);

  if (!await digestMatches(artifact.bytes, expectedDigest, subtle)) {
    throw new ArtifactLoadError(
      "The downloaded executable does not match its trusted digest",
      LOAD_INTEGRITY_ERROR,
    );
  }

  return artifact;
}

export function overallIntegrityState(componentStates) {
  if (componentStates.includes(INTEGRITY_FAILED)) {
    return INTEGRITY_FAILED;
  }

  return componentStates.every((state) => state === INTEGRITY_VERIFIED)
    ? INTEGRITY_VERIFIED
    : INTEGRITY_UNVERIFIED;
}

export function approveVersion(consent, version) {
  return {
    ...consent,
    approvedVersion: validateMermaidVersion(version),
  };
}

export function hasVersionConsent(consent, version) {
  return consent?.approvedVersion === validateMermaidVersion(version);
}

export function clearConsentForVersionChange(consent, nextVersion) {
  let version;

  try {
    version = validateMermaidVersion(nextVersion);
  } catch {
    return { approvedVersion: null };
  }

  return consent?.approvedVersion === version
    ? consent
    : { approvedVersion: null };
}

export function parseRememberedVersionApprovals(serialized) {
  let values;

  try {
    values = JSON.parse(serialized || "[]");
  } catch {
    return [];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  const validVersions = [];
  for (const value of values) {
    try {
      validVersions.push(validateMermaidVersion(value));
    } catch {
      // Ignore malformed local data instead of granting consent for it.
    }
  }

  return [...new Set(validVersions)].sort();
}

export function rememberVersionApproval(approvedVersions, version) {
  const approvedVersion = validateMermaidVersion(version);
  const existingVersions = Array.isArray(approvedVersions) ? approvedVersions : [];
  return [...new Set([...existingVersions, approvedVersion])].sort();
}

export function hasRememberedVersionApproval(approvedVersions, version) {
  return Array.isArray(approvedVersions)
    && approvedVersions.includes(validateMermaidVersion(version));
}

export function canContinueUnverified({ checkboxChecked, requestedVersion }) {
  try {
    validateMermaidVersion(requestedVersion);
    return checkboxChecked === true;
  } catch {
    return false;
  }
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
