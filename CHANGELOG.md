# Changelog

All notable changes to **manan-kanchu — AI Code Detector** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-05-26

### Added
- **AI Code Detection** — hybrid heuristic (40%) + AI semantic analysis (60%) scoring, 0–100% confidence per file
- **Vulnerability Scanner** — 20+ OWASP patterns: SQL injection, XSS, command injection, hardcoded secrets, AWS/GCP keys, path traversal, insecure redirects, weak randomness, and more (CWE codes included)
- **Malicious Code Scanner** — detects keyloggers, cookie exfiltration, form hijacking, crypto miners, clipboard hijack, obfuscated payloads across 7 categories
- **Policy Evaluator** — 10 built-in rules (`no-eval`, `no-innerHTML`, `no-hardcoded-secrets`, `license-compliance`, …) plus custom rule DSL
- **Shell Analyzer** — flags destructive commands (`rm -rf`, remote pipe execution, privilege escalation) with safer alternatives
- **Audit Dashboard** — dark-theme WebviewPanel with 6 tabs: Dashboard, Findings, Files, Shell, Policies, Settings
- **Report Generation** — export full audit report as Markdown or JSON to `.manan-kanchu/report-<timestamp>.md`
- **Code Sanitization** — `manan-kanchu.sanitize` command to apply AI-suggested fixes
- **Multi-Provider AI** — Ollama, LM Studio (local), Anthropic Claude, Google Gemini, OpenAI GPT (cloud)
- **Privacy-first provider selection** — local providers tried first; cloud used only when configured
- **OS Keychain storage** — API keys stored via VS Code SecretStorage, never written to disk
- **MCP Filesystem server** — Model Context Protocol integration for project-aware AI context
- **Skill registry** — extensible `Skill` interface for adding new analysis capabilities
- **8 registered commands**: open dashboard, scan file, scan project, scan selection, configure provider, generate report, sanitize, show menu
- **3 keybindings**: `Ctrl+Shift+M` (menu), `Ctrl+Alt+M` (dashboard), `Ctrl+Alt+S` (scan file)
- **Right-click context menu** integration in editor
- **41 unit tests** across 6 test suites (AICodeDetector, VulnerabilityScanner, PolicyEvaluator, MaliciousCodeScanner, SecretManager, AIProviderManager)
- Full TypeScript strict mode, CommonJS output, nonce-based CSP in webview

---

## [Unreleased]

### Planned — v1.1
- Git integration: scan diffs on commit/push, AI score annotations in git gutter

### Planned — v1.2
- GitHub Action + GitLab CI template for pipeline threshold enforcement

### Planned — v1.3
- Team baseline storage and per-commit deviation alerts

### Planned — v1.4
- Auto-sanitize: one-click remediation for common vulnerability patterns

### Planned — v2.0
- Fine-tuned lightweight detection model trained on human vs AI code dataset
