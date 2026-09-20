# Media guide

Images used by the README live in `media/`. The VS Code Marketplace only shows images served over HTTPS and does **not** render Mermaid or SVG, so the README links PNG/JPG files by their `raw.githubusercontent.com` URL.

## Screenshots (`media/*.jpg`)

| File | Content |
| --- | --- |
| `dashboard-overview.jpg` | Dashboard tab after a project scan |
| `scan-file.jpg` | Findings tab after scanning one file (AI score and evidence) |
| `scan-project.jpg` | Files tab |
| `vulnerability-finding.jpg` | A critical finding with the before/after auto-fix |
| `policies.jpg` | Policies tab |
| `shell-analyzer.jpg` | Shell tab with a critical command |
| `provider-config.jpg` | Settings tab |

Specs: 1280×800 viewport captured at 2× (2560×1600), JPEG quality 92, dark theme, no personal data. The current set was rendered from the real dashboard HTML with sample data from a demo project; replace them with captures from a live VS Code window whenever you like, keeping the same file names.

## Diagrams (`media/diagrams/*.png`)

Sources are Mermaid files in `docs/diagrams/`. After editing one, re-render it to PNG (2×, white background) and commit both files:

```bash
npx @mermaid-js/mermaid-cli -i docs/diagrams/01-pipeline.mmd -o media/diagrams/01-pipeline.png -s 2 -b white
```

## Animated demos

`media/dashboard-overview.gif` and `media/scan-project.gif` are optional animated demos (800×450). They are excluded from the extension package by `.vscodeignore`.
