# media/

This folder holds GIF and screenshot assets used in the VS Code Marketplace listing and the GitHub README.

## Planned assets

| File | Content | Dimensions |
|------|---------|------------|
| `dashboard-overview.gif` | Opening the dashboard, switching tabs, seeing score metrics | 800×500 |
| `scan-file.gif` | Right-click → Scan Current File → findings appear in dashboard | 800×500 |
| `scan-project.gif` | Full project scan with progress, file list populating | 800×500 |
| `vulnerability-finding.gif` | Clicking a critical finding, seeing the code snippet and recommendation | 800×500 |
| `provider-config.gif` | Configuring an API key, switching providers | 800×500 |
| `report-export.gif` | Generating and opening a Markdown audit report | 800×500 |
| `shell-analyzer.gif` | Pasting a shell command, seeing risk flags and safe alternatives | 800×500 |

## Recording tips

- Use **GIMP → Filters → Animation** or **ScreenToGif** (Windows) / **Kap** (macOS) for recording.
- Keep each GIF under **3 MB** for fast loading on the Marketplace page.
- Pause on key moments for at least 2 s so viewers can read the content.
- Use VS Code with the **Dark+** or **GitHub Dark** theme so the extension UI blends naturally.
- Crop to the VS Code window only — no desktop chrome visible.

## Usage in README

```markdown
![Dashboard overview](media/dashboard-overview.gif)
```
