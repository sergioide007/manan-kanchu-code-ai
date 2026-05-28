import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillContext, SkillResult, FileScanResult } from '../core/interfaces';
import { AICodeDetector } from '../analyzers/AICodeDetector';
import { VulnerabilityScanner } from '../analyzers/VulnerabilityScanner';
import { MaliciousCodeScanner } from '../analyzers/MaliciousCodeScanner';
import { PolicyEvaluator } from '../analyzers/PolicyEvaluator';
import { detectLanguage, maxSeverity } from '../analyzers/utils';

export class ScanFileSkill implements Skill {
  readonly id = 'scan-file';
  readonly name = 'Scan File';
  readonly description = 'Perform full analysis on a single file';

  async execute(context: SkillContext): Promise<SkillResult> {
    const filePath = context.parameters['filePath'] as string;
    const code = context.parameters['code'] as string | undefined;

    if (!filePath) return { success: false, errors: ['filePath is required'] };

    let content = code;
    if (!content) {
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(context.workspace, filePath);
      if (!fs.existsSync(absPath)) return { success: false, errors: [`File not found: ${absPath}`] };
      content = fs.readFileSync(absPath, 'utf-8');
    }

    const detector = new AICodeDetector(
      context.ai,
      context.config?.heuristicWeight ?? 0.4,
      context.config?.aiWeight ?? 0.6
    );
    const vulnScanner = new VulnerabilityScanner();
    const maliciousScanner = new MaliciousCodeScanner();
    const policyEvaluator = new PolicyEvaluator();

    const [aiResult, vulnResult] = await Promise.all([
      detector.analyzeCode(content, filePath),
      Promise.resolve(vulnScanner.scanCode(content, filePath)),
    ]);

    const maliciousFindings = maliciousScanner.scan(content, filePath);
    const policyResult = policyEvaluator.evaluate(content, filePath, context.config?.activePolicies);

    const allFindings = [
      ...aiResult.findings,
      ...vulnResult.findings,
      ...maliciousFindings,
      ...policyResult.violations.map(v => ({
        id: `pol-${v.ruleId}-${v.line}`,
        category: 'policy-violation' as const,
        severity: v.severity,
        title: v.ruleName,
        description: v.message,
        filePath,
        startLine: v.line,
        endLine: v.line,
        snippet: v.snippet,
        confidence: 1.0,
        policyRule: v.ruleId,
      })),
    ];

    const result: FileScanResult = {
      filePath,
      language: detectLanguage(filePath),
      linesOfCode: content.split('\n').length,
      aiScore: aiResult.aiScore,
      vulnerabilities: vulnResult.findings.length,
      policyViolations: policyResult.violations.length,
      severity: maxSeverity(allFindings.map(f => f.severity)) as FileScanResult['severity'],
      findings: allFindings,
    };

    return { success: true, output: result };
  }
}
