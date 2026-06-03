import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillContext, SkillResult, ScanSummary, FileScanResult, CodeFinding } from '../core/interfaces';
import { AICodeDetector } from '../analyzers/AICodeDetector';
import { VulnerabilityScanner } from '../analyzers/VulnerabilityScanner';
import { MaliciousCodeScanner } from '../analyzers/MaliciousCodeScanner';
import { PolicyEvaluator } from '../analyzers/PolicyEvaluator';
import { detectLanguage, maxSeverity } from '../analyzers/utils';

const SCANNABLE_EXTENSIONS = new Set([
  // Application code
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.sh', '.ps1',
  '.html', '.vue', '.svelte',
  // DevOps / IaC
  '.tf', '.hcl', '.yaml', '.yml', '.json',
]);

// Files with no extension that should be scanned
const SCANNABLE_BASENAMES = new Set(['Dockerfile', 'Makefile', 'Jenkinsfile']);

// Always excluded regardless of user config — generated/vendor/test-output dirs contain
// non-source content that would produce mass false positives in the security scanners.
const MANDATORY_EXCLUDE = new Set(['node_modules', '.git', 'coverage', 'lcov-report', 'build', 'dist', 'out', '.next']);

const DEFAULT_EXCLUDE = [...MANDATORY_EXCLUDE];

export class ScanProjectSkill implements Skill {
  readonly id = 'scan-project';
  readonly name = 'Scan Project';
  readonly description = 'Perform full analysis on all source files in the project';

  async execute(context: SkillContext): Promise<SkillResult> {
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const workspaceRoot = context.workspace;
    // Merge user config with mandatory excludes so coverage/lcov-report/etc. can never be scanned
    const userExcludes = context.config?.excludePatterns ?? DEFAULT_EXCLUDE;
    const excludePatterns = [...new Set([...MANDATORY_EXCLUDE, ...userExcludes])];
    const maxSizeKB = (context.config?.maxFileSizeKB ?? 512) * 1024;

    const files = this._collectFiles(workspaceRoot, excludePatterns, maxSizeKB);

    if (files.length === 0) {
      return { success: false, errors: ['No scannable files found in workspace'] };
    }

    const detector = new AICodeDetector(context.ai, context.config?.heuristicWeight, context.config?.aiWeight);
    const vulnScanner = new VulnerabilityScanner();
    const maliciousScanner = new MaliciousCodeScanner();
    const policyEvaluator = new PolicyEvaluator();

    const fileResults: FileScanResult[] = [];
    let filesSkipped = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(workspaceRoot, filePath);

        const [aiResult, vulnResult] = await Promise.all([
          detector.analyzeCode(content, relPath),
          Promise.resolve(vulnScanner.scanCode(content, relPath)),
        ]);

        const maliciousFindings = maliciousScanner.scan(content, relPath);
        const policyResult = policyEvaluator.evaluate(content, relPath, context.config?.activePolicies);

        const allFindings: CodeFinding[] = [
          ...aiResult.findings,
          ...vulnResult.findings,
          ...maliciousFindings,
          ...policyResult.violations.map(v => ({
            id: `pol-${v.ruleId}-${v.line}`,
            category: 'policy-violation' as const,
            severity: v.severity,
            title: v.ruleName,
            description: v.message,
            filePath: relPath,
            startLine: v.line,
            endLine: v.line,
            snippet: v.snippet,
            confidence: 1.0,
            policyRule: v.ruleId,
          })),
        ];

        fileResults.push({
          filePath: relPath,
          language: detectLanguage(filePath),
          linesOfCode: content.split('\n').length,
          aiScore: aiResult.aiScore,
          vulnerabilities: vulnResult.findings.length,
          policyViolations: policyResult.violations.length,
          severity: (maxSeverity(allFindings.map(f => f.severity)) as FileScanResult['severity']) || 'info',
          findings: allFindings,
        });
      } catch {
        filesSkipped++;
      }
    }

    const allFindings = fileResults.flatMap(r => r.findings);
    const summary: ScanSummary = {
      projectPath: workspaceRoot,
      filesScanned: fileResults.length,
      filesSkipped,
      totalFindings: allFindings.length,
      criticalCount: allFindings.filter(f => f.severity === 'critical').length,
      highCount: allFindings.filter(f => f.severity === 'high').length,
      mediumCount: allFindings.filter(f => f.severity === 'medium').length,
      lowCount: allFindings.filter(f => f.severity === 'low').length,
      aiGeneratedFiles: fileResults.filter(r => r.aiScore >= (context.config?.detectionThreshold ?? 0.65)).length,
      averageAiScore: fileResults.length
        ? fileResults.reduce((s, r) => s + r.aiScore, 0) / fileResults.length
        : 0,
      topFindings: allFindings
        .sort((a, b) => {
          const weights = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
          return weights[b.severity] - weights[a.severity];
        })
        .slice(0, 10),
      fileResults,
      scanDurationMs: Date.now() - start,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    return { success: true, output: summary };
  }

  private _collectFiles(dir: string, excludePatterns: string[], maxSizeBytes: number): string[] {
    const results: string[] = [];
    this._walkDir(dir, excludePatterns, maxSizeBytes, results);
    return results;
  }

  private _walkDir(dir: string, excludePatterns: string[], maxSize: number, results: string[]): void {
    if (!fs.existsSync(dir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excludePatterns.some(p => this._matchesPattern(entry.name, p))) continue;
      if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this._walkDir(fullPath, excludePatterns, maxSize, results);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const isScannableExt = SCANNABLE_EXTENSIONS.has(ext);
        const isScannableBasename = !ext && SCANNABLE_BASENAMES.has(entry.name);
        if (!isScannableExt && !isScannableBasename) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size <= maxSize) results.push(fullPath);
        } catch {
          // skip
        }
      }
    }
  }

  private _matchesPattern(name: string, pattern: string): boolean {
    if (!pattern.includes('*')) return name === pattern;
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$').test(name);
  }
}
