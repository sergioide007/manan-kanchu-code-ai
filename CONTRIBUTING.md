# Contributing to manan-kanchu — AI Code Detector

Thank you for considering a contribution to **manan-kanchu**!  
"Manan kanchu" (Quechua) means "there isn't" — the extension detects what shouldn't be there: AI-generated code, vulnerabilities, malicious patterns, and policy violations.

All contributions are welcome: bug fixes, new analyzers, new AI providers, UI improvements, documentation, and tests.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Running & Debugging](#running--debugging)
- [Tests](#tests)
- [Linting & Formatting](#linting--formatting)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Extension Points](#extension-points)
  - [Adding an AI Provider](#adding-an-ai-provider)
  - [Adding an Analyzer](#adding-an-analyzer)
  - [Adding a Skill](#adding-a-skill)
- [Security Policy](#security-policy)
- [License](#license)

---

## Code of Conduct

Be respectful and constructive. Harassment of any kind is not tolerated.  
Please open an [issue](https://github.com/sergioide007/manan-kanchu-code-ai/issues) if you witness problematic behavior.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20 LTS |
| npm | 10 |
| TypeScript | 5.3 |
| VS Code | 1.85 |

Install the **VS Code Extension Development** tooling once globally:

```bash
npm install -g @vscode/vsce
```

---

## Project Structure

```
manan-kanchu-code-ai/
├── src/
│   ├── core/                  # Shared interfaces, config, SecretManager
│   ├── providers/             # AI provider adapters (Anthropic, OpenAI, Gemini, Ollama, LMStudio)
│   │   └── AIProviderManager.ts
│   ├── analyzers/             # Detection engines
│   │   ├── AICodeDetector.ts
│   │   ├── VulnScanner.ts
│   │   ├── MaliciousScanner.ts
│   │   ├── PolicyEvaluator.ts
│   │   ├── ShellAnalyzer.ts
│   │   └── utils.ts
│   ├── panel/                 # WebviewPanel UI (single-scroll, collapsible sections)
│   │   └── MainPanel.ts
│   ├── skills/                # Extensible skill registry
│   │   ├── SkillRegistry.ts
│   │   ├── ScanFileSkill.ts
│   │   ├── ScanProjectSkill.ts
│   │   ├── GenerateReportSkill.ts
│   │   └── SanitizeCodeSkill.ts
│   ├── mcp/                   # Model Context Protocol integration
│   │   ├── MCPManager.ts
│   │   └── FilesystemMCP.ts
│   ├── extension.ts           # Extension entry point
│   └── test/
│       ├── __mocks__/vscode.ts
│       └── unit/
│           ├── analyzers/
│           ├── core/
│           └── providers/
├── icons/
├── resources/
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── PRIVACY.md
├── package.json
└── tsconfig.json
```

---

## Getting Started

1. **Fork** the repository on GitHub.

2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/manan-kanchu-code-ai.git
   cd manan-kanchu-code-ai
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Compile** the TypeScript:
   ```bash
   npm run compile
   ```

---

## Development Workflow

```bash
# Create a branch off main
git checkout -b feat/my-feature   # or fix/issue-123

# Watch mode — recompiles on save
npm run watch

# Run tests
npm test

# Lint
npm run lint
```

Branch naming convention:

| Prefix | Use case |
|--------|----------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code cleanup with no behavior change |
| `test/` | Adding or fixing tests |

---

## Running & Debugging

1. Open the project in VS Code.
2. Press `F5` — this launches the **Extension Development Host** (a second VS Code window with the extension loaded).
3. In the host window, open a workspace and use the Command Palette (`Ctrl+Shift+P`) to run any `manan-kanchu` command.

Useful keybindings in the development host:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Show manan-kanchu Commands |
| `Ctrl+Alt+M` | Open Dashboard |
| `Ctrl+Alt+S` | Scan Current File |

To reload the extension after a code change: `Ctrl+R` inside the Extension Development Host.

---

## Tests

Tests use **Jest** with **ts-jest** and a hand-crafted VS Code API mock at `src/test/__mocks__/vscode.ts`.

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

Coverage thresholds enforced globally:

| Metric | Minimum |
|--------|---------|
| Branches | 60 % |
| Functions | 70 % |
| Lines | 70 % |
| Statements | 70 % |

`ShellAnalyzer.ts` and `utils.ts` require **100 % branch coverage** — keep this when editing those files.

### Writing Tests

- Tests live in `src/test/unit/<module>/`.
- File naming: `<SourceFile>.test.ts`.
- Use the existing mock pattern for the VS Code API — import from `vscode` normally; Jest resolves it to the mock.
- Avoid integration tests that hit real AI providers; stub the provider interface instead.

---

## Linting & Formatting

```bash
npm run lint          # ESLint with TypeScript rules
```

Configuration is in [`.eslintrc.json`](.eslintrc.json). The project uses `@typescript-eslint` strict rules.  
Fix auto-fixable issues with:

```bash
npx eslint src --ext ts --fix
```

TypeScript is compiled with `strict: true`. Zero compiler errors are required before a PR can merge.

```bash
npx tsc --noEmit     # type-check only, no output
```

---

## Submitting a Pull Request

1. Make sure `npm run compile`, `npm test`, and `npm run lint` all pass with no errors.
2. Update `CHANGELOG.md` under `[Unreleased]` with a concise summary of your change.
3. Push your branch and open a PR against `main`.
4. Fill in the PR template (summary, motivation, test plan).
5. A maintainer will review; expect feedback within a few days.

**PR checklist:**

- [ ] TypeScript compiles cleanly (`npm run compile`)
- [ ] All tests pass (`npm test`)
- [ ] Coverage thresholds are not lowered
- [ ] Lint passes (`npm run lint`)
- [ ] CHANGELOG.md updated
- [ ] No secrets, API keys, or credentials committed
- [ ] New user-visible strings use plain English (no hardcoded locale assumptions)

---

## Reporting Bugs

Open an issue at [github.com/sergioide007/manan-kanchu-code-ai/issues](https://github.com/sergioide007/manan-kanchu-code-ai/issues).

Include:
- VS Code version (`Help → About`)
- Extension version (shown in Extensions panel)
- OS and Node.js version
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs from **Output → manan-kanchu** channel

---

## Extension Points

### Adding an AI Provider

1. Create `src/providers/<Name>Provider.ts` implementing the `AIProvider` interface from `src/core/interfaces.ts`.
2. Register it in `src/providers/AIProviderManager.ts`.
3. Add configuration entries in `package.json` under `contributes.configuration.properties` (follow the pattern of existing providers).
4. Add unit tests in `src/test/unit/providers/`.

```typescript
// Minimal skeleton
import { AIProvider, AnalysisRequest, AnalysisResult } from '../core/interfaces';

export class MyProvider implements AIProvider {
  readonly name = 'myprovider';

  async isAvailable(): Promise<boolean> { /* check connectivity */ }
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> { /* call API */ }
}
```

### Adding an Analyzer

1. Create `src/analyzers/<Name>Analyzer.ts`.
2. Keep the analyzer pure (no VS Code API calls) so it remains unit-testable.
3. Wire it into `MainPanel.ts` or the relevant skill.
4. Add tests with 100 % branch coverage if the file is security-critical.

### Adding a Skill

1. Create `src/skills/<Name>Skill.ts` implementing the `Skill` interface from `src/skills/SkillRegistry.ts`.
2. Register it in `SkillRegistry.ts`.
3. Expose it as a VS Code command in `package.json` → `contributes.commands` and `extension.ts`.

---

## Security Policy

If you find a security vulnerability, **do not open a public issue**.  
Email the maintainer privately or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

When contributing code that handles user secrets or API keys, always use `SecretManager` (`src/core/SecretManager.ts`) — which wraps VS Code's `SecretStorage` — and never write credentials to disk or logs.

---

## License

By contributing you agree that your changes will be released under the [MIT License](LICENSE) that covers this project.

Copyright (c) 2026 SpecSolid
