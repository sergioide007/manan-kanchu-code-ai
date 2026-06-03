import { PolicyEvaluationResult, PolicyRule, PolicyViolation } from '../core/interfaces';
import { uuid, isInsideStringLiteral } from './utils';

const BUILT_IN_RULES: PolicyRule[] = [
  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'API keys, passwords, and tokens must not be hardcoded in source code.',
    severity: 'critical',
    pattern: /(?:api[_-]?key|password|secret|token|credential)\s*[:=]\s*['"`][A-Za-z0-9_\-!@#$%^&*]{8,}['"`]/gi,
  },
  {
    id: 'no-eval',
    name: 'No eval() Usage',
    description: 'eval() and Function() constructors are forbidden — security risk.',
    severity: 'critical',
    pattern: /\beval\s*\(|new\s+Function\s*\(/g,
  },
  {
    id: 'no-innerHTML',
    name: 'No Unsafe innerHTML',
    description: 'Direct innerHTML assignment with dynamic content is forbidden.',
    severity: 'high',
    pattern: /\.innerHTML\s*=\s*(?!['"`]\s*['"`])/g,
  },
  {
    id: 'no-console-log',
    name: 'No console.log in Production Code',
    description: 'console.log/warn/error statements must not be left in production code.',
    severity: 'low',
    pattern: /console\.(log|warn|error|info|debug)\s*\(/g,
  },
  {
    id: 'license-compliance',
    name: 'License Header Required',
    description: 'Source files must include a license header or SPDX identifier.',
    severity: 'medium',
    check: (code: string, filePath: string): PolicyViolation[] => {
      const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.go', '.rs'];
      const hasExt = extensions.some(e => filePath.endsWith(e));
      if (!hasExt) return [];
      // Skip generated/vendor and test infrastructure — these are not project source files
      const GENERATED_DIRS = ['coverage', 'lcov-report', 'node_modules', 'dist', 'build', '.next', 'out', 'vendor', '__mocks__', '__tests__'];
      const pathSegments = filePath.replace(/\\/g, '/').split('/');
      if (GENERATED_DIRS.some(d => pathSegments.includes(d))) return [];
      if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)) return [];
      const header = code.substring(0, 500);
      const hasLicense = /(?:MIT|Apache|GPL|BSD|LGPL|MPL|ISC|copyright|SPDX-License-Identifier)/i.test(header);
      if (hasLicense) return [];
      return [{
        ruleId: 'license-compliance',
        ruleName: 'License Header Required',
        severity: 'medium',
        filePath,
        line: 1,
        snippet: code.split('\n')[0] ?? '',
        message: 'No license header found in source file.',
      }];
    },
  },
  {
    id: 'no-http-external',
    name: 'No HTTP for External URLs',
    description: 'External URLs must use HTTPS, not HTTP.',
    severity: 'medium',
    // Excludes XML/SVG namespace URIs (www.w3.org, schemas.) which are identifiers, not endpoints
    pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|www\.w3\.org|schemas?\.|xml\.)[^'"`]+['"`]/g,
  },
  {
    id: 'no-any-typescript',
    name: 'No TypeScript any Type',
    description: 'Usage of "any" type bypasses TypeScript safety.',
    severity: 'low',
    pattern: /:\s*any\b|\bas\s+any\b/g,
  },
  {
    id: 'no-async-without-await',
    name: 'Async Functions Must Use await',
    description: 'async functions without await are likely bugs.',
    severity: 'low',
    check: (code: string, filePath: string): PolicyViolation[] => {
      if (!filePath.match(/\.(ts|js|tsx|jsx)$/)) return [];
      const violations: PolicyViolation[] = [];
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (/async\s+function|async\s+\(|async\s+\w+\s*=/.test(line)) {
          const blockEnd = Math.min(i + 20, lines.length);
          const block = lines.slice(i, blockEnd).join('\n');
          if (!/\bawait\b/.test(block) && !/Promise/.test(block)) {
            violations.push({
              ruleId: 'no-async-without-await',
              ruleName: 'Async Functions Must Use await',
              severity: 'low',
              filePath,
              line: i + 1,
              snippet: line.trim(),
              message: 'async function may be missing await.',
            });
          }
        }
      });
      return violations;
    },
  },
  {
    id: 'gdpr-personal-data-logging',
    name: 'GDPR: No Personal Data in Logs',
    description: 'Personal data (email, phone, name, SSN) must not be logged.',
    severity: 'high',
    pattern: /console\.[a-z]+\([^)]*(?:email|phone|ssn|passport|dob|birthdate|address|creditcard)[^)]*\)/gi,
  },
  {
    id: 'no-synchronous-fs',
    name: 'No Synchronous File Operations',
    description: 'Synchronous fs operations block the event loop.',
    severity: 'medium',
    pattern: /\bfs\.(readFileSync|writeFileSync|readdirSync|statSync|existsSync|unlinkSync|mkdirSync)\b/g,
  },
  {
    id: 'no-weak-crypto',
    name: 'No Weak Cryptography',
    description: 'MD5 and SHA1 are cryptographically broken.',
    severity: 'high',
    pattern: /(?:createHash|hashlib\.new|MessageDigest\.getInstance)\s*\(\s*['"`](?:md5|sha1|sha-1)['"`]/gi,
  },
];

export class PolicyEvaluator {
  private rules: Map<string, PolicyRule> = new Map();

  constructor() {
    for (const rule of BUILT_IN_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  evaluate(code: string, filePath: string, activeRuleIds?: string[]): PolicyEvaluationResult {
    const activeRules = activeRuleIds
      ? [...this.rules.values()].filter(r => activeRuleIds.includes(r.id))
      : [...this.rules.values()];

    const violations: PolicyViolation[] = [];
    const passed: string[] = [];

    const lines = code.split('\n');

    for (const rule of activeRules) {
      const ruleViolations: PolicyViolation[] = [];

      if (rule.pattern) {
        const p = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match: RegExpExecArray | null;
        while ((match = p.exec(code)) !== null) {
          if (isInsideStringLiteral(code, match.index)) continue;

          const lineIndex = code.substring(0, match.index).split('\n').length;
          ruleViolations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            filePath,
            line: lineIndex,
            snippet: (lines[lineIndex - 1] ?? '').trim(),
            message: rule.description,
          });
        }
      }

      if (rule.check) {
        ruleViolations.push(...rule.check(code, filePath));
      }

      if (ruleViolations.length === 0) {
        passed.push(rule.id);
      } else {
        violations.push(...ruleViolations);
      }
    }

    const score = activeRules.length > 0
      ? Math.round((passed.length / activeRules.length) * 100)
      : 100;

    return { filePath, violations, passed, score, analyzedAt: new Date().toISOString() };
  }

  addCustomRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  getRules(): PolicyRule[] {
    return [...this.rules.values()];
  }
}

