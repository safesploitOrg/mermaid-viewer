import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  INTEGRITY_FAILED,
  INTEGRITY_UNVERIFIED,
  INTEGRITY_VERIFIED,
  LOAD_INTEGRITY_ERROR,
  LOAD_NETWORK_ERROR,
  TRUSTED_INTEGRITY_MANIFEST,
  approveVersion,
  buildUnverifiedMermaidUrls,
  calculateSha384,
  canContinueUnverified,
  clearConsentForVersionChange,
  digestMatches,
  downloadAndVerify,
  downloadFirst,
  hasVersionConsent,
  integrityCoverage,
  overallIntegrityState,
  trustedVersionRecord,
} from "../public/assets/js/integrity.js";

test("recognised and unknown Mermaid versions are distinguished", () => {
  assert.equal(trustedVersionRecord("11.15.0")?.version, "11.15.0");
  assert.equal(trustedVersionRecord("11.17.2"), null);
  assert.equal(integrityCoverage("11.15.0", "elk").fullyCovered, true);
  assert.equal(integrityCoverage("11.17.2", "elk").fullyCovered, false);
});

test("unverified CDN URLs can only be built from strict semantic versions", () => {
  assert.deepEqual(buildUnverifiedMermaidUrls("12.0.0"), [
    "https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js",
    "https://unpkg.com/mermaid@12.0.0/dist/mermaid.min.js",
  ]);
  assert.match(
    buildUnverifiedMermaidUrls("12.0.0-rc.1+review.2")[0],
    /mermaid@12\.0\.0-rc\.1%2Breview\.2/,
  );
  assert.throws(() => buildUnverifiedMermaidUrls("latest"));
  assert.throws(() => buildUnverifiedMermaidUrls("11.15.0/x.js"));
  assert.throws(() => buildUnverifiedMermaidUrls("11.15.0?x=<script>"));
});

test("committed trusted artefacts match every repository digest", async () => {
  const records = [
    ...Object.values(TRUSTED_INTEGRITY_MANIFEST.versions),
    ...Object.values(TRUSTED_INTEGRITY_MANIFEST.layouts)
      .filter((record) => !record.builtIn),
  ];

  for (const record of records) {
    const path = new URL(`../public/${record.artifact.slice(2)}`, import.meta.url);
    const bytes = await readFile(path);
    assert.equal(await calculateSha384(bytes), record.digest);
    assert.equal(await digestMatches(bytes, record.digest), true);
  }
});

test("a recognised artefact with the wrong hash is blocked", async () => {
  const fetchImplementation = async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode("modified").buffer,
  });

  await assert.rejects(
    downloadAndVerify(
      ["https://example.invalid/mermaid.js"],
      "sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      { fetchImplementation },
    ),
    (error) => error.code === LOAD_INTEGRITY_ERROR,
  );
});

test("missing layout integrity makes the complete stack unverified", () => {
  const manifest = structuredClone(TRUSTED_INTEGRITY_MANIFEST);
  delete manifest.layouts.elk.digest;

  const coverage = integrityCoverage("11.15.0", "elk", manifest);
  assert.equal(coverage.knownVersion, true);
  assert.equal(coverage.fullyCovered, false);
  assert.deepEqual(coverage.missing, ["layout"]);
  assert.equal(
    overallIntegrityState([INTEGRITY_VERIFIED, INTEGRITY_UNVERIFIED]),
    INTEGRITY_UNVERIFIED,
  );
});

test("integrity failure always dominates overall state", () => {
  assert.equal(
    overallIntegrityState([INTEGRITY_VERIFIED, INTEGRITY_FAILED]),
    INTEGRITY_FAILED,
  );
});

test("unverified continuation requires the explicit checkbox", () => {
  assert.equal(canContinueUnverified({
    checkboxChecked: false,
    requestedVersion: "11.17.2",
  }), false);
  assert.equal(canContinueUnverified({
    checkboxChecked: true,
    requestedVersion: "11.17.2",
  }), true);
});

test("consent is scoped to one selected version and changing it clears consent", () => {
  const approved = approveVersion({ approvedVersion: null }, "11.17.2");
  assert.equal(hasVersionConsent(approved, "11.17.2"), true);
  assert.equal(hasVersionConsent(approved, "11.18.0"), false);
  assert.deepEqual(clearConsentForVersionChange(approved, "11.18.0"), {
    approvedVersion: null,
  });
});

test("network failures have a different error code from integrity failures", async () => {
  await assert.rejects(
    downloadFirst(
      ["https://one.invalid/a.js", "https://two.invalid/a.js"],
      async () => { throw new Error("offline"); },
    ),
    (error) => error.code === LOAD_NETWORK_ERROR,
  );
});
