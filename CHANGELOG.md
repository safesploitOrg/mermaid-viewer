# Changelog

All notable changes to Mermaid Viewer are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-09-03

### Added

- Repository-controlled, single-file bundles for Mermaid 11.15.0 and 11.17.2, ELK 0.2.1 and Tidy Tree 0.2.2.
- SHA-384 integrity metadata and verification in both the parent page and sandboxed renderer.
- Clear verified, unverified and blocked integrity states in the interface.
- Explicit, per-version consent before downloading an unknown Mermaid version from an external CDN.
- Optional browser-persistent approval that suppresses repeat consent prompts for the exact unverified version while retaining the yellow warning state.
- Trusted-version dropdown with Mermaid 11.15.0 as the default and 11.17.2 as the latest verified choice.
- Reproducible vendoring and integrity checks through `npm run vendor:externals` and `npm run vendor:check`.
- Automated coverage for trusted artefacts, consent handling, integrity failures and the vendored bundle manifest.

### Changed

- Unknown Mermaid versions now use jsDelivr and unpkg only after the user consciously accepts the unverified-code risk.
- Known integrity mismatches are blocked with no bypass.
- Mermaid version input now requires a complete semantic version.
- Renderer errors distinguish syntax, incompatible layout, network and integrity failures.
- The default example is now a CI/CD security pipeline.

### Security

- Trusted executable artefacts are served locally, so the default rendering path no longer depends on a CDN being available.
- The renderer repeats digest verification before executing a trusted artefact in its sandbox.
- Content Security Policy rules restrict network access to the two consent-only CDN origins and do not permit unsafe evaluation.

## [1.1.0] - 2026-09-03

### Added

- Static Mermaid editor and viewer with ELK, Tidy Tree, Cose Bilkent and Dagre layouts.
- ELK as the default layout, plus configurable render width, zoom, pan, fit and fullscreen controls.
- Editable Mermaid runtime version and light/dark theme selection.
- Sandboxed rendering with Mermaid's strict security level and validated iframe messaging.
- GitHub Pages deployment, CI tests, project documentation, branding and favicon.

### Security

- The renderer iframe omitted `allow-same-origin` and used a per-session channel for parent/renderer messages.
- Mermaid and optional layout scripts were loaded from public CDNs without repository-owned integrity validation.

[Unreleased]: https://github.com/safesploitOrg/mermaid-viewer/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/safesploitOrg/mermaid-viewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/safesploitOrg/mermaid-viewer/releases/tag/v1.1.0
