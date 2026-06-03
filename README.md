# manan-kanchu — AI Code Detector

> **Detect AI-generated code, scan vulnerabilities, audit security policies, and protect your codebase — all inside VS Code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-blue)](https://marketplace.visualstudio.com/items?itemName=sergioide007.manan-kanchu-code-ai)
[![Version](https://img.shields.io/badge/version-1.0.0-green)](./CHANGELOG.md)
[![Marketplace](https://img.shields.io/badge/VS%20Marketplace-published-green)](https://marketplace.visualstudio.com/items?itemName=sergioide007.manan-kanchu-code-ai)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red)](./LICENSE)

<!-- Replace with actual GIF once recorded: media/dashboard-overview.gif (800×500) -->
![manan-kanchu Dashboard — 6 tabs: Dashboard, Findings, Files, Script, Policies, Settings](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/dashboard-overview.gif)

---

## What is manan-kanchu?

**manan-kanchu** (mah-nan-KAHN-chu) is a Quechua word meaning *"there isn't"* — representing the goal of detecting what doesn't belong: AI-generated code masquerading as human work.

It provides a comprehensive security and code-quality dashboard directly inside VS Code, combining heuristic analysis with multi-provider AI intelligence to give you a full picture of your codebase health.

**100% open source · MIT license · Privacy-first** — your code goes directly to your chosen AI provider. No manan-kanchu servers.

---

## Features

### 1. AI Code Detection

<!-- Replace: media/scan-file.gif -->
![Scanning a file — AI detection score, heuristic indicators](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/scan-project.gif)

Hybrid scoring combines **heuristic analysis (40%)** and **AI semantic analysis (60%)** to produce a 0–100% confidence score per file. Indicators include:

- Naming convention uniformity, comment density, boilerplate ratios
- Structural patterns common in LLM-generated code
- Semantic fluency scoring via the active AI provider

### 2. Vulnerability Scanner

<!-- Replace: media/vulnerability-finding.gif -->
<!-- ![Vulnerability finding — SQL injection, critical severity, auto-fix suggestion](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/vulnerability-finding.gif) -->

20+ OWASP-aligned patterns with CWE codes:

| Category | Examples |
|---|---|
| Injection | SQL injection, command injection, LDAP injection |
| XSS | `innerHTML`, `document.write`, `eval` with user input |
| Secrets | Hardcoded API keys, AWS/GCP/Azure credentials, private keys |
| Crypto | MD5/SHA1 usage, weak random, predictable IVs |
| Path | Path traversal, arbitrary file read/write |
| Network | Insecure HTTP, open redirects, SSRF patterns |

### 3. Malicious Code Scanner

Detects code designed to harm or exfiltrate — useful for auditing third-party code and supply-chain risks:

- **Keyloggers** — `keydown`/`keypress` event listeners with suspicious data handling
- **Data exfiltration** — cookie/localStorage theft, beacon calls, form hijacking
- **Crypto miners** — WebAssembly or script patterns typical of browser miners
- **Obfuscation** — base64 decode chains, `eval(atob(...))`, `Function()` constructor abuse
- **Clipboard hijack** — silent clipboard content replacement

### 4. Policy Evaluator

10 built-in compliance rules evaluated across your project:

| Rule ID | Description |
|---|---|
| `no-hardcoded-secrets` | No API keys or passwords in source files |
| `no-eval` | Dynamic code execution forbidden |
| `no-innerHTML` | No direct `innerHTML` assignment |
| `license-compliance` | SPDX license identifiers in source files |
| `no-weak-crypto` | MD5 and SHA1 forbidden |
| `gdpr-personal-data-logging` | No PII in log statements |
| `no-console-log` | Production code must not use `console.log` |
| `no-debugger` | No `debugger` statements in committed code |
| `no-todo-comments` | No unresolved TODO/FIXME comments |
| `no-sql-injection` | Parameterized queries enforced |

Custom rules can be added via the `manan-kanchu.policies` setting.

### 5. Shell Command Analyzer

<!-- Replace: media/shell-analyzer.gif -->
<!-- ![Shell analyzer — analyzing rm -rf, showing risk level and safer alternative](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/shell-analyzer.gif) -->

Paste any shell command and get an instant risk assessment:

- Destructive commands (`rm -rf`, `truncate`, `dd`)
- Remote execution (`curl | bash`, `wget | sh`, `eval $(...)`)
- Privilege escalation (`sudo bash`, `chmod 777`, `setuid`)
- Safe alternative suggestions for flagged commands

### 6. Audit Dashboard

<!-- Replace: media/report-export.gif -->
<!-- ![Report export — generating Markdown audit report](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/report-export.gif) -->

Dark-theme WebviewPanel with 6 tabs:

| Tab | Content |
|---|---|
| **Dashboard** | Scan summary, severity charts, top findings |
| **Findings** | All findings filterable by category and severity |
| **Files** | Per-file AI scores, sorted by risk, drill-down view |
| **Shell** | Shell command analyzer with risk examples |
| **Policies** | Policy pass/fail grid with compliance percentage |
| **Settings** | Detection threshold, AI provider config, about |

Export full audit reports as Markdown to `.manan-kanchu/report-<timestamp>.md`.

---

## Quick Start

### Step 1 — Install

Search **"manan-kanchu"** in the Extensions panel (`Ctrl+Shift+X`), or run:

```bash
code --install-extension sergioide007.manan-kanchu-code-ai
```

### Step 2 — Configure an AI Provider

<!-- Replace: media/provider-config.gif -->
<!-- ![Configuring AI provider — selecting Anthropic, entering API key](https://raw.githubusercontent.com/sergioide007/manan-kanchu-code-ai/main/media/provider-config.gif) -->

Press `Ctrl+Shift+M` → **Configure AI Provider**:

**Local (free, fully private):**

```bash
# Ollama — auto-detected at http://localhost:11434
ollama pull codellama

# LM Studio — auto-detected at http://localhost:1234
# Load any GGUF model and start the local server
```

**Cloud:**

Select Anthropic, OpenAI, or Google Gemini → enter your API key.
Keys are stored in the OS keychain via VS Code SecretStorage — never in plaintext, never in `settings.json`.

### Step 3 — Open the Dashboard

```
Ctrl+Alt+M   →  Open manan-kanchu Dashboard
Ctrl+Shift+M →  Quick command menu
```

### Step 4 — Scan Your Project

Click **Scan Project** in the dashboard sidebar or use:
- `Ctrl+Alt+S` → Scan current file
- Right-click any file → **manan-kanchu: Scan Current File**
- Select code → right-click → **manan-kanchu: Scan Selected Code**

---

## Commands & Shortcuts

| Command | Shortcut | Description |
|---|---|---|
| `manan-kanchu: Open Dashboard` | `Ctrl+Alt+M` | Open the main analysis panel |
| `manan-kanchu: Show Commands` | `Ctrl+Shift+M` | Quick menu with all commands |
| `manan-kanchu: Scan Current File` | `Ctrl+Alt+S` | Analyze the active editor file |
| `manan-kanchu: Scan Entire Project` | — | Full project scan with file breakdown |
| `manan-kanchu: Scan Selected Code` | — | Analyze highlighted code selection |
| `manan-kanchu: Generate Audit Report` | — | Export Markdown report to workspace |
| `manan-kanchu: Configure AI Provider` | — | Set provider and API key |
| `manan-kanchu: Sanitize Detected Issues` | — | Apply AI-suggested auto-fixes |

> `Ctrl+Shift+M` shows the command menu without conflicting with other extensions.

---

## AI Providers

| Provider | Type | Privacy | Cost |
|---|---|---|---|
| Ollama | Local | 100% on-device | Free |
| LM Studio | Local | 100% on-device | Free |
| Anthropic Claude | Cloud | Direct API | API pricing |
| OpenAI GPT | Cloud | Direct API | API pricing |
| Google Gemini | Cloud | Direct API | API pricing |

**Auto mode** (default) — tries Ollama → LM Studio → Anthropic → OpenAI → Gemini. First available wins. Local providers are always preferred for privacy.

### Recommended Models

| Provider | Model | Best for |
|---|---|---|
| Anthropic | `claude-sonnet-4-6` | Balanced — default recommendation |
| OpenAI | `gpt-4o` | General analysis |
| Ollama | `codellama` | Local code analysis |

---

## Settings Reference

All settings are configurable in VS Code Settings UI or `settings.json`.

| Setting | Default | Description |
|---|---|---|
| `manan-kanchu.preferredProvider` | `auto` | Provider selection strategy |
| `manan-kanchu.anthropic.model` | `claude-sonnet-4-6` | Anthropic model ID |
| `manan-kanchu.openai.model` | `gpt-4o` | OpenAI model ID |
| `manan-kanchu.gemini.model` | `gemini-1.5-pro` | Gemini model ID |
| `manan-kanchu.ollama.endpoint` | `http://localhost:11434` | Ollama server URL |
| `manan-kanchu.ollama.model` | `codellama` | Ollama model name |
| `manan-kanchu.lmstudio.endpoint` | `http://localhost:1234` | LM Studio server URL |
| `manan-kanchu.detection.threshold` | `0.65` | AI detection threshold (0–1). Higher = stricter |
| `manan-kanchu.detection.heuristicWeight` | `0.4` | Heuristic contribution to score |
| `manan-kanchu.detection.aiWeight` | `0.6` | AI analysis contribution to score |
| `manan-kanchu.scan.excludePatterns` | `node_modules, dist, out, …` | Glob patterns excluded from project scans |
| `manan-kanchu.scan.maxFileSizeKB` | `512` | Max file size included in scans |
| `manan-kanchu.policies` | `[no-hardcoded-secrets, …]` | Active policy rule IDs |
| `manan-kanchu.maxTokens` | `4096` | Max tokens per AI request |
| `manan-kanchu.temperature` | `0.1` | AI temperature (low = deterministic analysis) |
| `manan-kanchu.requestTimeout` | `120000` | Request timeout in ms |
| `manan-kanchu.privacy.telemetry` | `false` | Anonymous usage statistics (off by default) |

---

## Architecture

```
src/
├── extension.ts            ← Activation, command registration
├── core/
│   ├── interfaces.ts       ← All shared TypeScript types
│   ├── config.ts           ← Settings manager
│   └── SecretManager.ts    ← OS keychain via VS Code SecretStorage
├── providers/
│   ├── AIProviderManager.ts  ← Auto-selection, provider lifecycle
│   ├── AnthropicProvider.ts
│   ├── OpenAIProvider.ts
│   ├── GeminiProvider.ts
│   ├── OllamaProvider.ts
│   └── LMStudioProvider.ts
├── analyzers/
│   ├── AICodeDetector.ts     ← Hybrid heuristic + AI scoring
│   ├── VulnerabilityScanner.ts ← 20+ OWASP patterns
│   ├── MaliciousCodeScanner.ts ← 7 malicious code categories
│   ├── PolicyEvaluator.ts    ← 10 built-in + custom rules
│   ├── ShellAnalyzer.ts      ← Shell command risk assessment
│   └── utils.ts
├── panel/
│   └── MainPanel.ts          ← WebviewPanel SPA (dashboard)
├── skills/
│   ├── SkillRegistry.ts
│   ├── ScanFileSkill.ts
│   ├── ScanProjectSkill.ts
│   ├── GenerateReportSkill.ts
│   └── SanitizeCodeSkill.ts
└── mcp/
    ├── MCPManager.ts
    └── FilesystemMCP.ts
```

---

## Adding GIF Demos

To add demo GIFs to this README once you have recorded them:

1. Place GIF files in the `media/` folder (keep each under 3 MB)
2. Uncomment the corresponding `![...]` lines above each feature section

| File | Content | Dimensions |
|---|---|---|
| `media/dashboard-overview.gif` | Opening the dashboard, switching tabs | 800×500 |
| `media/scan-file.gif` | Right-click → Scan File → findings appear | 800×500 |
| `media/scan-project.gif` | Full project scan with progress | 800×500 |
| `media/vulnerability-finding.gif` | Clicking a critical finding, seeing details | 800×500 |
| `media/provider-config.gif` | Configuring an API key, switching providers | 800×500 |
| `media/report-export.gif` | Generating and opening a Markdown report | 800×500 |
| `media/shell-analyzer.gif` | Shell command analysis with safe alternatives | 800×500 |

**Recording tips:** Use ScreenToGif (Windows) or Kap (macOS). Use VS Code with **GitHub Dark** theme so the UI blends naturally. Crop to the VS Code window only.

---

## Privacy

- No telemetry by default (`manan-kanchu.privacy.telemetry: false`)
- API keys stored in the OS keychain, never in settings files
- Code sent only to your chosen provider — no manan-kanchu servers
- Local providers (Ollama, LM Studio) keep everything 100% on-device
- See [PRIVACY.md](./PRIVACY.md) for full details

---

## Contributing

```bash
git clone https://github.com/sergioide007/manan-kanchu-code-ai
cd manan-kanchu-code-ai
npm install
npm run compile   # or: npx tsc --watch
npm test          # 41 unit tests across 6 suites
```

Press **F5** in VS Code to launch the Extension Development Host.

---

## License

MIT — see [LICENSE](./LICENSE).
