# Changelog

All notable changes to **manan-kanchu — AI Code Detector** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.1] — 2026-09-20

### Fixed
- **AWS access keys were never detected.** The "inside a string literal" false-positive guard suppressed every value-only pattern, and a key always sits inside quotes. Value-only secret patterns are now exempt.
- **Sanitize and Apply fix failed for every finding from a project scan** because findings carry workspace-relative paths that were read from the wrong directory. Paths are now resolved against the workspace; *Apply* refuses files outside it and preserves CRLF line endings.
- **Shell analyzer:** `chmod 755` was flagged as world-writable (and then recommended 755); only genuinely world-writable modes (777, 666, `a+w`, `o+w`) are flagged now. `rm -r -f /`, `rm --recursive --force /` and `dd if=/dev/urandom` were missed and are now caught.
- **Anthropic ignored the requested temperature** (the API defaulted to 1.0), making detection scores non-deterministic. It is now forwarded, with an automatic retry for models that reject it.
- **AI detection** could yield `NaN` on an unexpected model reply, injected an arbitrary 0.5 when a reply was unparseable, and was skewed by weights that did not sum to 1. Replies are validated, failures fall back to the heuristic score (reported as `heuristic-only`) and weights are normalised.
- **Project scans** never entered `.github/` (so the CI/CD rules could not run) and skipped `.mjs`, `.cjs`, `.h`, `.hpp`, `.dart`, `.scala`, `.kts`, `.bash` files that the rules already target.
- **Policies tab** showed a hard-coded list of six rules, marked rules that were never evaluated as passing and miscounted violations. It now lists the rules that were actually evaluated with their real violation counts.
- Dashboard: literal `&#x1F7E2;` text in the AI score label and the copy button; OpenAI never showed as *Active* in the provider grid.
- `npm run lint` failed (tests were outside the ESLint TypeScript project) and reported useless regex escapes.
- The default Gemini model `gemini-1.5-pro` has been retired by Google (HTTP 404).

### Added
- **Secret detectors** for Google API keys, GitHub tokens, Slack tokens, Azure storage account keys and private-key blocks, plus AWS temporary (`ASIA…`) keys.
- `no-weak-crypto` now also catches Python's `hashlib.md5()` / `hashlib.sha1()`.
- **Policy rules** `no-debugger`, `no-todo-comments` and `no-sql-injection` (documented but missing) — 14 built-in rules in total.
- **`maxTokens` and `temperature` settings are now honoured**: `maxTokens` caps every request, `temperature` applies to every analysis (0–1).
- **OpenAI GPT-6 Astra** is the new default OpenAI model. Reasoning models are handled automatically (`max_completion_tokens` with reasoning headroom, low reasoning effort, no custom temperature) with fallbacks for OpenAI-compatible servers.
- Friendly model names in the dashboard (for example *GPT-6 Astra*, *Claude Sonnet 4.6*), and the active model is shown next to the provider.
- **Filesystem MCP is connected**: every project-file read and write inside the workspace (scans, reports, previews, Apply fix) goes through the workspace-confined MCP server.
- Removing a stored API key: submit an empty key in *Configure AI Provider*.
- CI workflow, pull-request template, README diagrams and real dashboard screenshots.
- 154 unit tests in 16 suites (was 41 in 6).

### Security
- The Filesystem MCP tools accepted any path: `../` and absolute paths could read or write outside the workspace. They are now confined.
- The Gemini API key is sent in a header instead of the URL.
- The dashboard no longer loads Google Fonts; the content-security policy allows no external origins.
- The 3,000-character limit promised in `PRIVACY.md` is now enforced for auto-fix requests.

### Changed
- Provider selection order for cloud providers is documented as Anthropic → Gemini → OpenAI (as implemented).
- `index.html`, README, PRIVACY and CONTRIBUTING corrected to match the code (91 vulnerability patterns, 14 policy rules, 12 shell patterns, 7 malicious-code categories).
- License and contributing notices use the project name *manan-kanchu-code-ai*.

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
