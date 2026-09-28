# Changelog

All notable changes to Mermaid Viewer are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.0] - 2026-09-28

### Added

- **Auto-detect layout mode** that reads Mermaid YAML frontmatter such as `config.layout: dagre` and renders with the layout requested by the source.
- A dedicated **Auto-detect** button and visible layout-state indicator showing detected, fallback, forced and unsupported states.
- Support for detecting all four viewer layouts from frontmatter: `elk`, `tidy-tree`, `cose-bilkent` and `dagre`.
- Compatibility detection for legacy flowchart renderer hints through `config.flowchart.defaultRenderer` (`elk` and `dagre-wrapper`).
- A render-only **forced layout** path: selecting a layout manually overrides source frontmatter for previewing without changing the user's editor text.
- Unit tests for frontmatter detection, inline configuration, comments, legacy renderer hints, unsupported values, ELK fallback and forced preview behaviour.

### Changed

- New/fresh sessions default to **Auto-detect** rather than permanently forcing the layout selector.
- When Auto-detect finds no layout directive, Mermaid Viewer continues to use **ELK as its fallback**.
- Existing v1.2 browser profiles that already stored a manual layout are migrated to **forced mode** so the update does not unexpectedly change their previews.
- Layout diagnostics now identify whether the result came from `AUTO` or `FORCED` mode.
- Unsupported frontmatter layouts are surfaced as an explicit error in Auto-detect mode rather than being silently normalised to ELK.

### Security

- Frontmatter inspection uses a narrow parser for the layout keys Mermaid Viewer needs; it does not execute YAML or introduce a general-purpose YAML deserialiser.
- Manual force mode modifies only an in-memory render copy. The original Mermaid source in the editor is never rewritten automatically.
- The existing SHA-384 executable-integrity checks, strict Mermaid security mode and sandbox boundary are unchanged.

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

[Unreleased]: https://github.com/safesploitOrg/mermaid-viewer/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/safesploitOrg/mermaid-viewer/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/safesploitOrg/mermaid-viewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/safesploitOrg/mermaid-viewer/releases/tag/v1.1.0
