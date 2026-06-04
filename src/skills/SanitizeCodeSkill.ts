import { Skill, SkillContext, SkillResult, CodeFinding } from '../core/interfaces';

function findMethodStart(lines: string[], fromIndex: number): number {
  const declPattern = /^\s*(export\s+)?(default\s+)?(async\s+)?(function[\s*]|class\s+\w|const\s+\w+\s*=\s*(async\s+)?\(|[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*[:{]|public\s|private\s|protected\s)/;
  for (let i = fromIndex; i >= Math.max(0, fromIndex - 80); i--) {
    if (declPattern.test(lines[i])) return i;
  }
  return Math.max(0, fromIndex - 10);
}

function findMethodEnd(lines: string[], fromIndex: number, methodStart: number): number {
  let depth = 0;
  let foundOpen = false;
  const limit = Math.min(lines.length - 1, fromIndex + 150);
  for (let i = methodStart; i <= limit; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      else if (ch === '}') { depth--; }
    }
    if (foundOpen && depth <= 0 && i >= fromIndex) return i;
  }
  return Math.min(lines.length - 1, fromIndex + 20);
}

function getMethodContext(code: string, startLine: number, endLine: number): string {
  const lines = code.split('\n');
  const s0 = Math.max(0, startLine - 1);
  const e0 = Math.min(lines.length - 1, endLine - 1);
  const mStart = findMethodStart(lines, s0);
  const mEnd = findMethodEnd(lines, e0, mStart);
  return lines.slice(mStart, mEnd + 1).join('\n');
}

export class SanitizeCodeSkill implements Skill {
  readonly id = 'sanitize-code';
  readonly name = 'Sanitize Code';
  readonly description = 'Generate sanitized/fixed version of code based on findings';

  async execute(context: SkillContext): Promise<SkillResult> {
    const code = context.parameters['code'] as string;
    const finding = context.parameters['finding'] as CodeFinding;

    if (!code || !finding) return { success: false, errors: ['code and finding are required'] };
    if (!context.ai) return { success: false, errors: ['AI provider required for sanitization'] };

    const methodContext = getMethodContext(code, finding.startLine, finding.endLine);

    const prompt = `You are a security expert. Fix the following code issue.

Issue: ${finding.title}
Category: ${finding.category}
Severity: ${finding.severity}
Description: ${finding.description}
Recommendation: ${finding.recommendation ?? 'Follow security best practices'}

Problematic code snippet (lines ${finding.startLine}-${finding.endLine}):
\`\`\`
${finding.snippet}
\`\`\`

Full method/function context:
\`\`\`
${methodContext}
\`\`\`

Return ONLY a fenced code block with the fixed replacement. Rules:
- If the fix ADDS content (e.g. a license header, comment, import) before or after existing code, your replacement MUST include the original snippet lines too.
- If the fix CHANGES existing code, replace only the problematic part.
- Never omit lines that are not part of the problem.
- Preserve original indentation.
- No explanations outside the code block.`;

    try {
      const sanitized = await context.ai.complete(prompt, {
        maxTokens: 1024,
        temperature: 0.1,
      });

      const codeMatch = sanitized.match(/```[a-z]*\n([\s\S]+?)```/);
      if (!codeMatch) {
        return { success: false, errors: ['AI did not return a code block. Try a more capable model.'] };
      }
      const cleanCode = codeMatch[1].trim();

      const hallucinationSignals = [
        finding.title,
        finding.description.slice(0, 40),
        'Suggested Fix',
        '% confidence',
        'policy violation',
      ];
      const isHallucination = hallucinationSignals.some(sig =>
        cleanCode.toLowerCase().includes(sig.toLowerCase())
      );
      if (isHallucination) {
        return { success: false, errors: ['AI returned a description instead of code. Try a more capable model.'] };
      }

      return { success: true, output: { sanitizedCode: cleanCode, originalFinding: finding } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errors: [`Sanitization failed: ${message}`] };
    }
  }
}
