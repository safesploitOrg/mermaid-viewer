# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability before a fix is available.
Use GitHub's private vulnerability reporting feature for the repository where available.

## Browser security model

The editor and viewer UI run in the parent page. Mermaid rendering runs inside a sandboxed iframe with `allow-scripts` only; it is deliberately not granted `allow-same-origin`.

Mermaid is initialised with `securityLevel: "strict"`.

Parent/renderer `postMessage` traffic is scoped with a random per-renderer channel ID and accepted only from the expected iframe window.

The renderer downloads pinned/version-selected JavaScript modules from jsDelivr, with unpkg as a fallback. This includes Mermaid and, when selected, the optional ELK or Tidy Tree layout package. Dagre and Cose Bilkent are provided by Mermaid's full ESM build.

The Mermaid source itself is rendered locally in the browser and is not intentionally submitted to a remote rendering API. Public CDNs remain part of the application's software supply chain.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full runtime and trust-boundary model.
