# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability before a fix is available.
Use GitHub's private vulnerability reporting feature for the repository where available.

## Browser security model

The editor and viewer UI run in the parent page. Mermaid rendering runs inside a sandboxed iframe with `allow-scripts` only; it is deliberately not granted `allow-same-origin`.

Mermaid is initialised with `securityLevel: "strict"`.

Parent/renderer `postMessage` traffic is scoped with a random per-renderer channel ID and accepted only from the expected iframe window.

## Executable integrity model

The repository contains single-file browser bundles and SHA-384 digests for Mermaid `11.15.0` and `11.17.2`, `@mermaid-js/layout-elk` `0.2.1`, and `@mermaid-js/layout-tidy-tree` `0.2.2`. Dagre and Cose Bilkent are included in each Mermaid bundle. A rendering session is labelled **verified** only after Mermaid and every external package required by the selected layout match the repository-controlled digests.

The parent page fetches and checks the bytes with Web Crypto. It then passes those bytes into the sandbox, where the renderer checks the digest again before executing a Blob-backed classic script. A known digest mismatch is a hard failure and cannot be bypassed.

Unknown but syntactically valid Mermaid versions remain available for compatibility testing. They are not downloaded until the user checks the warning acknowledgement and continues. That consent applies only to the exact selected version. The user may optionally remember that approval in browser `localStorage`, which prevents the dialog from returning for that version after refresh; clearing the site's browser data revokes it. Remembered approval never changes the visible **unverified** state. jsDelivr is tried first and unpkg is the network fallback.

Integrity checking protects against an artefact that differs from the bytes approved in this repository, including CDN or transit modification. It does not protect against:

- compromise that changes both this repository's manifest and its bundles;
- malicious or vulnerable code already present in an approved upstream release;
- browser/runtime compromise; or
- risks inherent in explicitly approved, unverified versions.

Exact npm versions are pinned and `package-lock.json` records npm registry integrity. CI reproduces the bundles and compares them byte-for-byte with the committed artefacts.

## Content Security Policy

The parent permits network connections only to its own origin, jsDelivr, and unpkg. Because the renderer has an opaque sandbox origin, its static bootstrap script tags carry a CSP nonce; `strict-dynamic` and `blob:` then permit the trusted bootstrap to execute the checked bytes. The nonce is static because this is a static site, so it is an execution allow-list rather than a server-generated injection defence.

Neither policy permits `unsafe-eval`, and `script-src` does not permit `unsafe-inline`. The renderer's `style-src` does allow inline styles because Mermaid generates diagram-specific SVG `<style>` elements and style attributes at runtime. Blocking those styles causes incorrect black/default SVG rendering. This exception is confined to the opaque, script-sandboxed renderer; its CSP still prevents stylesheet URLs and other resource types from reaching external origins.

The Mermaid source itself is rendered locally in the browser and is not intentionally submitted to a remote rendering API. CDNs are part of the supply chain only when the user explicitly chooses an unverified Mermaid version.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full runtime and trust-boundary model.
