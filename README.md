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
- 📌 Configurable/pinned Mermaid version
- 💾 Browser `localStorage` persistence
- 🧹 Blank input clears the preview rather than producing Mermaid's syntax-error graphic
- 🔐 Mermaid `securityLevel: "strict"`
- 🧱 Mermaid executes in a sandboxed iframe without same-origin privileges
- 📅 Footer year is generated dynamically from the client's browser
- 🔗 Footer link to the public GitHub repository
- 🚀 Static GitHub Pages deployment
- 🧪 Dependency-free Node.js unit tests

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
│       │   ├── protocol.js
│       │   └── renderer.js
│       └── images/
│           └── github-mark.svg
├── tests/
│   ├── core.test.js
│   ├── protocol.test.js
│   └── static-site.test.js
├── ARCHITECTURE.md
├── LICENSE
├── README.md
├── SECURITY.md
└── package.json
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the renderer boundary, message flow, layout-loading model and deployment architecture.

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

The project uses Node.js' built-in test runner, so there are no npm dependencies to install.

```bash
npm test
```

The tests cover:

- Mermaid version validation
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

### Cose Bilkent

Cose Bilkent is a force-directed layout. The viewer uses Mermaid's full ESM build, where Cose Bilkent is included as a built-in layout.

### Dagre

Dagre is Mermaid's layered/default flowchart layout. It is useful when comparing a diagram with platforms that use Mermaid's traditional default renderer.

## Mermaid version

The initial Mermaid version remains pinned to:

```text
11.15.0
```

The version is editable in the UI and saved locally in the browser. This makes it possible to compare both:

- **layout differences**, and
- **Mermaid runtime version differences**.

The renderer first attempts to load the selected Mermaid version from jsDelivr and falls back to unpkg if required.

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
6. Mermaid source is rendered in-browser; the application does not intentionally send it to a remote rendering API.

The Mermaid and optional layout JavaScript is still obtained from public CDNs, so the CDN remains part of the supply chain.

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
