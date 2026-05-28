import { AIProvider, AIDetectionResult, AIIndicator, CodeFinding } from '../core/interfaces';
import { uuid } from './utils';

// AI-generated code signatures: patterns consistently produced by LLMs
const AI_COMMENT_PATTERNS = [
  /\/\/\s*(This (function|method|class|component|helper|utility) (is|does|handles|provides|returns|takes|accepts))/i,
  /\/\/\s*(A (simple|basic|helper|utility) (function|method|class) (that|to|for))/i,
  /\/\*\*[\s\S]*?@param\s+\{[^}]+\}\s+\w+\s+-\s+The\s+/i,
  /\/\/\s*(TODO|FIXME|NOTE|HACK):\s*$/, // empty TODO/NOTE — LLMs add them as placeholders
  /\/\/\s*(Initialize|Create|Define|Set up|Configure) (the|a|an)\s+\w+/i,
];

const AI_BOILERPLATE_PATTERNS = [
  /export\s+default\s+function\s+\w+\(\)\s*\{[\s\S]{0,200}return\s*\([\s\S]{0,500}\);\s*\}/,
  /const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,100}try\s*\{[\s\S]{0,200}catch\s*\(e(rror|rr)?\)\s*\{/i,
  /interface\s+\w+(Props|State|Config|Options|Data)\s*\{[\s\S]{0,500}\}/,
];

const AI_NAMING_OVERPATTERNS = [
  /\b(handleSubmit|handleChange|handleClick|handleError|handleSuccess|handleResponse)\b/g,
  /\b(isLoading|isError|isSuccess|isValid|isAuthenticated|isAuthorized)\b/g,
  /\b(fetchData|loadData|getData|updateData|deleteData|createData)\b/g,
  /\b(formatDate|formatCurrency|formatString|parseDate|validateEmail|validatePhone)\b/g,
];

const AI_STRUCTURE_SIGNATURES = [
  // Uniform error handling pattern
  /catch\s*\([^)]*\)\s*\{\s*console\.(error|log)\([^)]*\);\s*\}/g,
  // Try-catch wrapping every async function
  /async\s+function\s+\w+[^{]*\{\s*try\s*\{/g,
  // Exact JSDoc block structure
  /\/\*\*\s*\n\s*\*\s*@description[^*]*\n\s*\*\s*@param[^*]*\n\s*\*\s*@returns/g,
];

export class AICodeDetector {
  constructor(
    private readonly ai: AIProvider | null,
    private readonly heuristicWeight: number = 0.4,
    private readonly aiWeight: number = 0.6
  ) {}

  async analyzeCode(code: string, filePath: string): Promise<AIDetectionResult> {
    const indicators: AIIndicator[] = this._runHeuristics(code);
    const heuristicScore = this._computeHeuristicScore(indicators);

    let aiAnalysisScore = 0;
    let analysisModel = 'heuristic-only';
    let aiReason: string | undefined;

    if (this.ai) {
      try {
        const result = await this._runAIAnalysis(code, filePath);
        aiAnalysisScore = result.score;
        aiReason = result.reason;
        analysisModel = this.ai.modelName;
      } catch {
        aiAnalysisScore = heuristicScore; // fallback to heuristic
      }
    } else {
      aiAnalysisScore = heuristicScore;
    }

    const aiScore = this.ai
      ? heuristicScore * this.heuristicWeight + aiAnalysisScore * this.aiWeight
      : heuristicScore;

    const lines = code.split('\n');
    const linesTotal = lines.length;
    const linesAI = Math.round(linesTotal * aiScore);

    const findings: CodeFinding[] = aiScore >= 0.65
      ? [this._buildFinding(filePath, aiScore, code, linesTotal, indicators, aiReason)]
      : [];

    return {
      filePath,
      aiScore,
      heuristicScore,
      aiAnalysisScore,
      findings,
      indicators,
      linesTotal,
      linesAI,
      analysisModel,
      analyzedAt: new Date().toISOString(),
    };
  }

  private _runHeuristics(code: string): AIIndicator[] {
    const indicators: AIIndicator[] = [];

    // Comment density
    const lines = code.split('\n');
    const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
    const commentRatio = commentLines / Math.max(lines.length, 1);
    const commentScore = Math.min(commentRatio / 0.4, 1);
    indicators.push({
      type: 'comment-density',
      description: `Comment density ${(commentRatio * 100).toFixed(1)}% (AI tends to over-comment)`,
      weight: 0.15,
      score: commentScore,
    });

    // AI comment patterns
    let commentPatternMatches = 0;
    for (const p of AI_COMMENT_PATTERNS) {
      if (p.test(code)) commentPatternMatches++;
    }
    const commentPatternScore = Math.min(commentPatternMatches / 3, 1);
    indicators.push({
      type: 'comment-density',
      description: `${commentPatternMatches} AI-style comment patterns detected`,
      weight: 0.20,
      score: commentPatternScore,
    });

    // Naming patterns
    let namingMatches = 0;
    for (const p of AI_NAMING_OVERPATTERNS) {
      const matches = code.match(p);
      if (matches) namingMatches += matches.length;
    }
    const namingScore = Math.min(namingMatches / 8, 1);
    indicators.push({
      type: 'naming-pattern',
      description: `${namingMatches} generic AI naming conventions detected`,
      weight: 0.20,
      score: namingScore,
    });

    // Boilerplate patterns
    let boilerplateMatches = 0;
    for (const p of AI_BOILERPLATE_PATTERNS) {
      if (p.test(code)) boilerplateMatches++;
    }
    const boilerplateScore = Math.min(boilerplateMatches / 2, 1);
    indicators.push({
      type: 'boilerplate',
      description: `${boilerplateMatches} boilerplate code structures detected`,
      weight: 0.25,
      score: boilerplateScore,
    });

    // Structure uniformity
    let structureMatches = 0;
    for (const p of AI_STRUCTURE_SIGNATURES) {
      const matches = code.match(p);
      if (matches) structureMatches += matches.length;
    }
    const structureScore = Math.min(structureMatches / 4, 1);
    indicators.push({
      type: 'structure-uniformity',
      description: `${structureMatches} uniform structural patterns (AI tends to repeat exact patterns)`,
      weight: 0.20,
      score: structureScore,
    });

    return indicators;
  }

  private _computeHeuristicScore(indicators: AIIndicator[]): number {
    const totalWeight = indicators.reduce((s, i) => s + i.weight, 0);
    const weightedSum = indicators.reduce((s, i) => s + i.score * i.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private async _runAIAnalysis(code: string, filePath: string): Promise<{ score: number; reason?: string }> {
    if (!this.ai) return { score: 0 };

    const ext = filePath.split('.').pop() ?? 'txt';
    const codeSnippet = code.length > 3000 ? code.substring(0, 3000) + '\n...[truncated]' : code;

    const prompt = `Analyze this ${ext} code and estimate the probability (0.0 to 1.0) that it was generated by an AI language model.

Consider:
- Uniform code style with no personal quirks
- Over-commented or generic variable names
- Boilerplate patterns common in LLM outputs
- Lack of domain-specific knowledge
- Perfect formatting consistency
- Generic error handling patterns

Respond ONLY with a JSON object: {"score": 0.85, "reason": "brief reason"}

Code to analyze:
\`\`\`${ext}
${codeSnippet}
\`\`\``;

    const response = await this.ai.complete(prompt, { maxTokens: 200, temperature: 0 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { score: number; reason?: string };
        return { score: Math.max(0, Math.min(1, parsed.score)), reason: parsed.reason };
      }
    } catch {
      // Parse failed — try numeric extraction
      const numMatch = response.match(/\b(0\.\d+|1\.0|0|1)\b/);
      if (numMatch) {
        return { score: parseFloat(numMatch[1]) };
      }
    }

    return { score: 0.5 };
  }

  private _buildFinding(filePath: string, score: number, code: string, lines: number, indicators?: AIIndicator[], aiReason?: string): CodeFinding {
    const severity = score >= 0.9 ? 'critical' : score >= 0.75 ? 'high' : score >= 0.65 ? 'medium' : 'low';
    const snippetLines = code.split('\n').slice(0, 10).join('\n');
    return {
      id: uuid(),
      category: 'ai-generated',
      severity,
      title: `AI-Generated Code Detected (${(score * 100).toFixed(0)}% confidence)`,
      description: `This file appears to be ${(score * 100).toFixed(0)}% AI-generated based on heuristic and AI analysis.`,
      filePath,
      startLine: 1,
      endLine: lines,
      snippet: snippetLines,
      confidence: score,
      recommendation: 'Review this code for correctness, edge cases, and domain-specific requirements that AI may have missed.',
      indicators,
      aiReason,
    };
  }
}
