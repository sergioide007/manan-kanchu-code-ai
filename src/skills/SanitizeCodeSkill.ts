import { Skill, SkillContext, SkillResult, CodeFinding } from '../core/interfaces';

export class SanitizeCodeSkill implements Skill {
  readonly id = 'sanitize-code';
  readonly name = 'Sanitize Code';
  readonly description = 'Generate sanitized/fixed version of code based on findings';

  async execute(context: SkillContext): Promise<SkillResult> {
    const code = context.parameters['code'] as string;
    const finding = context.parameters['finding'] as CodeFinding;

    if (!code || !finding) return { success: false, errors: ['code and finding are required'] };
    if (!context.ai) return { success: false, errors: ['AI provider required for sanitization'] };

    const prompt = `You are a security expert. Fix the following code issue:

**Issue:** ${finding.title}
**Category:** ${finding.category}
**Severity:** ${finding.severity}
**Description:** ${finding.description}
**Recommendation:** ${finding.recommendation ?? 'Follow security best practices'}

**Problematic code snippet:**
\`\`\`
${finding.snippet}
\`\`\`

**Full code context (around the issue):**
\`\`\`
${code.split('\n').slice(Math.max(0, finding.startLine - 5), finding.endLine + 5).join('\n')}
\`\`\`

Provide ONLY the fixed code snippet (not the whole file). No explanation needed.`;

    try {
      const sanitized = await context.ai.complete(prompt, {
        maxTokens: 1024,
        temperature: 0.1,
      });

      const codeMatch = sanitized.match(/```[a-z]*\n([\s\S]+?)```/);
      const cleanCode = codeMatch ? codeMatch[1].trim() : sanitized.trim();

      return { success: true, output: { sanitizedCode: cleanCode, originalFinding: finding } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errors: [`Sanitization failed: ${message}`] };
    }
  }
}
