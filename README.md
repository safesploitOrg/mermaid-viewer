# 🧜 Mermaid Viewer

A small static Mermaid editor and previewer designed for comparing Mermaid layout engines before publishing diagrams to GitHub, documentation platforms or other Mermaid renderers.

**ELK is the default layout**, but the viewer exposes all four layouts listed in Mermaid's layout documentation:

- `elk` — ELK (Eclipse Layout Kernel)
- `tidy-tree` — hierarchical/tree-oriented layout
- `cose-bilkent` — force-directed graph layout
- `dagre` — layered graph layout and Mermaid's traditional default

Official Mermaid layout documentation:

- https://mermaid.ai/open-source/config/layouts.html

## Features

- ✍️ Live Mermaid editor
- 🧭 **ELK, Tidy Tree, Cose Bilkent and Dagre** layout selection
- ⭐ **ELK remains the default**
- 🔎 Smooth mouse-wheel zoom centred on the pointer
- 🖐️ Click-and-drag panning
- 🎯 Fit-to-window and 100% controls
- ⛶ Full-screen preview
- 🎨 Light and dark Mermaid themes
- 📐 Configurable render width
- 📌 Arbitrary semantic-version testing with explicit integrity state
- 🔽 Trusted-version dropdown for Mermaid 11.15.0 and 11.17.2
- ✅ Repository-controlled SHA-384 verification for bundled trusted versions
- ⚠️ Per-version consent, with an optional browser-persistent approval, before an unknown version is downloaded from a CDN
- 💾 Browser `localStorage` persistence
- 🧹 Blank input clears the preview rather than producing Mermaid's syntax-error graphic
- 🔐 Mermaid `securityLevel: "strict"`
- 🧱 Mermaid executes in a sandboxed iframe without same-origin privileges
- 📅 Footer year is generated dynamically from the client's browser
- 🔗 Footer link to the public GitHub repository
- 🚀 Static GitHub Pages deployment
- 🧪 Node.js unit and vendored-artefact checks

## Project structure

```text
.
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci.yml
│       └── pages.yml
├── public/
│   ├── .nojekyll
│   ├── index.html
│   ├── renderer.html
│   └── assets/
│       ├── css/
│       │   └── app.css
│       ├── js/
│       │   ├── app.js
│       │   ├── core.js
│       │   ├── integrity.js
│       │   ├── protocol.js
│       │   ├── renderer.js
│       │   └── externals/
│       └── images/
│           └── github-mark.svg
├── tests/
│   ├── core.test.js
│   ├── protocol.test.js
│   └── static-site.test.js
├── ARCHITECTURE.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── SECURITY.md
└── package.json
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the renderer boundary, message flow, layout-loading model and deployment architecture. Release history is recorded in [CHANGELOG.md](CHANGELOG.md).

## Run locally

No build step is required.

From the repository root:

```bash
python -m http.server 8000 --directory public
```

Then browse to:

```text
http://localhost:8000/
```

You can also use any other static HTTP server.

> Opening `index.html` directly with `file://` is not recommended because browser module and iframe behaviour is more reliable over HTTP.

## Tests

Install the exact development dependencies recorded in `package-lock.json`, then run the tests:

```bash
npm ci
npm test
```

`npm run check` also rebuilds the trusted single-file artefacts in a temporary directory and verifies that the committed copies are reproducible.

The tests cover:

- Mermaid version validation
- trusted-version lookup, SHA-384 matching and mismatch blocking
- unknown-version consent scoping and CDN URL construction
- committed artefact digest verification
- blank-input detection
- all four layout values and labels
- theme normalisation
- browser-local year generation
- render-width and zoom bounds
- fit/anchored-zoom calculations
- iframe message/channel validation
- sandbox/security assertions
- layout package loader assertions
- footer/repository-link assertions
- public example sanitisation

## Layout engines

### ELK — default

ELK is the default in this project. It generally produces compact diagrams with orthogonal routing and is particularly useful for nested subgraphs and infrastructure/architecture diagrams.

The ELK package is loaded on demand and pinned separately from Mermaid:

```text
@mermaid-js/layout-elk 0.2.1
```

### Tidy Tree

Tidy Tree is intended for hierarchical/tree-oriented diagrams. It is also loaded on demand:

```text
@mermaid-js/layout-tidy-tree 0.2.2
```

Mermaid documents the package as an optional layout that providers must register before use.
It is designed for compatible tree-oriented diagram families such as mindmaps. Mermaid 11.15 cannot apply it to a general flowchart; the viewer reports that compatibility error and recommends ELK or Dagre instead of showing Mermaid's misleading syntax-error graphic.

### Cose Bilkent

Cose Bilkent is a force-directed layout. The viewer uses Mermaid's full browser bundle, where Cose Bilkent is included as a built-in layout.
Cose Bilkent likewise depends on diagram types that provide Mermaid's generic rooted layout data (for example, mindmaps). The bundled CI/CD example is a flowchart, so it is intended for ELK or Dagre; selecting Cose Bilkent reports the compatibility limitation instead of showing Mermaid's misleading syntax-error graphic.

### Dagre

Dagre is Mermaid's layered/default flowchart layout. It is useful when comparing a diagram with platforms that use Mermaid's traditional default renderer.

## Mermaid version

The default Mermaid version remains pinned to:

```text
11.15.0
```

The version is editable in the UI and saved locally in the browser. This makes it possible to compare both:

- **layout differences**, and
- **Mermaid runtime version differences**.

Versions `11.15.0` and `11.17.2` have repository-controlled integrity records and local, single-file browser bundles. They are available in the trusted-version dropdown; `11.15.0` remains selected by default. Any other syntactically valid semantic version remains usable through **Other version…**, but the viewer does not download it until the user explicitly accepts the unverified-version warning. Unverified downloads try jsDelivr and then unpkg.

The visible integrity state covers the complete selected executable stack:

1. **Verified** — Mermaid and any external layout bundle have repository-owned SHA-384 digests, and every downloaded byte matches.
2. **Unverified** — integrity metadata is missing and the user explicitly approved that exact Mermaid version, either for the current selection or as a remembered browser decision.
3. **Integrity failure / blocked** — a known artefact does not match its expected digest. There is no bypass.

The consent dialog can optionally remember approval for that exact unverified version in `localStorage`, preventing the dialog from returning after a refresh. Remembered approval does not change the yellow **Integrity unverified** state and can be revoked by clearing the site's browser data.

## Security model

The page intentionally does **not** proxy or iframe GitHub's private Viewscreen renderer. GitHub's CSP only permits that renderer to be framed by GitHub origins.

Instead:

1. The main editor/viewer runs in `index.html`.
2. Rendering runs in `renderer.html` inside an iframe with:

   ```html
   sandbox="allow-scripts"
   ```

3. `allow-same-origin` is deliberately omitted.
4. Parent/renderer messages are scoped with a per-session random channel ID and validated against the expected iframe window.
5. Mermaid runs with `securityLevel: "strict"`.
6. Trusted Mermaid and layout artefacts are fetched locally and checked with Web Crypto before execution. The sandbox repeats the digest check before creating a Blob-backed script.
7. Unknown Mermaid versions are fetched from an explicitly allow-listed CDN only after current or remembered version-specific consent and are always labelled unverified.
8. Mermaid source is rendered in-browser; the application does not intentionally send it to a remote rendering API.

The trusted artefacts are generated with `npm run vendor:externals`. Exact package versions are pinned in `package.json`, npm download integrity is pinned by `package-lock.json`, and CI runs `npm run vendor:check`.

### Updating trusted artefacts

1. Pin reviewed Mermaid versions as exact npm aliases (for example, `npm install --save-dev --save-exact mermaid-11-18-0@npm:mermaid@11.18.0`) and pin layout package versions normally.
2. Add trusted Mermaid versions to the dropdown in `index.html`. If the default changes, also update it in `core.js` and `renderer.js`.
3. Run `npm run vendor:externals` to rebuild the single-file bundles, licences and digest manifest.
4. Review the generated bundle changes and run `npm run check` plus the browser smoke tests before committing.

Do not edit `mermaid-integrity.js` by hand. Adding a digest means approving those exact executable bytes; it should follow dependency and compatibility review, not merely a successful download.

See [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for more detail.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`.

For a new GitHub repository:

1. Push the project to the `main` branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. The `Deploy GitHub Pages` workflow validates the project, uploads `./public`, and deploys it.

GitHub's Pages custom-workflow documentation:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## CI

`.github/workflows/ci.yml` runs the unit tests on pushes and pull requests using Node.js 24.

The Pages workflow runs the tests again before deployment so a direct push to `main` cannot publish without passing validation.

## Updating GitHub Actions

Dependabot is configured to check GitHub Actions monthly.

## Repository

https://github.com/safesploitOrg/mermaid-viewer

## Licence

MIT. See [LICENSE](LICENSE).
