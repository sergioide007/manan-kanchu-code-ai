import { AIProvider, AIDetectionResult, AIDetectionTier, AIIndicator, CodeFinding } from '../core/interfaces';
import { uuid } from './utils';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLD_DETECTED  = 0.72;  // High-confidence AI content
const THRESHOLD_UNCERTAIN = 0.45;  // Ambiguous zone — flag for human review

// ─── Comment Patterns ────────────────────────────────────────────────────────
// These are specific to LLM output style, not generic coding conventions.
// Each pattern was chosen because experienced developers rarely write them.

const AI_COMMENT_PATTERNS = [
  // "This function/method/class handles/provides/returns X" — LLMs narrate code purpose
  /\/\/\s*This (function|method|class|component|service|module)\s+(is|does|handles|provides|returns|creates|manages|implements)\b/i,

  // "A simple/basic X that does Y" — LLMs introduce helpers with this preamble
  /\/\/\s*A (simple|basic|custom|helper|utility)\s+(function|method|class|component)\s+(that|to|for|which)\b/i,

  // JSDoc "@param {Type} name - The X" — LLMs always use "- The" connector
  /\*\s+@param\s+\{[\w|, ]+\}\s+\w+\s+-\s+The\s+/i,

  // "Initialize/Create/Define the X" — LLMs explain obvious setup steps
  /\/\/\s*(Initialize|Create|Define|Set up|Configure)\s+the\s+\w+/i,

  // "Return the X" — LLMs describe return values inline
  /\/\/\s*(Return|Returns)\s+the\s+\w+/i,

  // "Helper function to X" — LLMs introduce utilities explicitly
  /\/\/\s*Helper (function|method)\s+to\s+\w+/i,

  // Empty TODO/FIXME/NOTE — LLMs add placeholder markers
  /\/\/\s*(TODO|FIXME|NOTE|HACK):\s*$/m,

  // "Handle/Process/Check/Get/Set X" imperative openers — LLMs narrate what each block does
  /\/\/\s*(Handle|Process|Check|Get|Set|Update|Delete|Create|Build|Render|Fetch|Load|Save|Convert|Parse|Validate|Format)\s+\w/i,

  // "We need to X" / "We can X" — LLMs reason through code out loud
  /\/\/\s*We (need to|can|should|will|use|check|handle)\s+\w/i,

  // Numbered steps: "1." / "Step 1" / "First," / "Then," / "Finally,"
  /\/\/\s*(Step \d|[1-9]\.|First[,:]|Second[,:]|Third[,:]|Then[,:]|Finally[,:]|Next[,:])/i,

  // "The following X" — LLMs introduce code blocks with this preamble
  /\/\/\s*The following\s+(code|function|class|method|block|snippet|example|implementation)\b/i,

  // Multi-word JSDoc @description / @summary lines
  /\*\s+@(description|summary|example)\s+\w.{10,}/i,
];

// ─── Boilerplate Patterns ────────────────────────────────────────────────────

const AI_BOILERPLATE_PATTERNS = [
  // Default export functional component with JSX return
  /export\s+default\s+function\s+\w+\([^)]*\)\s*\{[\s\S]{0,200}return\s*\([\s\S]{0,500}\);\s*\}/,
  // Async arrow with immediate try-catch
  /const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{\s*try\s*\{/i,
  // Interface with Props/State/Config/Options suffix
  /interface\s+\w+(Props|State|Config|Options|Data|Request|Response)\s*\{[\s\S]{0,500}\}/,
  // console.log with template literal describing what was done — AI narrates side effects
  /console\.(log|error|warn)\s*\(\s*[`'"][\w\s]+(successfully|failed|error|complete|done|created|updated|deleted)/i,
  // Multiple consecutive type annotations with optional chaining — AI defensive patterns
  /\?\.\w+\?\.\w+\?\.\w+/,
  // "if (!x) { throw new Error('X is required') }" — LLM guard pattern
  /if\s*\(\s*!\w+\s*\)\s*\{\s*(throw\s+new\s+\w*Error|return\s+(null|undefined|false|\{))/i,
];

// ─── Structural Signatures ───────────────────────────────────────────────────

const AI_STRUCTURE_SIGNATURES = [
  // catch block logging to console and rethrowing — LLM default error handling
  /catch\s*\([^)]*\)\s*\{\s*console\.(error|log|warn)\([^)]*\);\s*(throw\s+\w+;)?\s*\}/g,
  // Every async function wrapped in try-catch at the top level
  /async\s+(function\s+\w+|\w+\s*=>|\(\s*\)\s*=>)[^{]*\{\s*try\s*\{/g,
  // JSDoc with @description + @param + @returns in sequence
  /\/\*\*\s*\n\s*\*\s*@(description|summary)[^*]*\n\s*\*\s*@param[^*]*\n\s*\*\s*@returns/g,
];

// ─── Generic Identifier Vocabulary ──────────────────────────────────────────
// Identifiers that LLMs use disproportionately. Domain-specific code uses
// project-relevant names; AI defaults to this generic vocabulary.

const GENERIC_IDENTIFIER_SET = new Set([
  'result', 'response', 'data', 'error', 'config', 'options', 'params', 'payload',
  'output', 'input', 'value', 'item', 'items', 'list', 'arr', 'obj', 'ctx',
  'callback', 'handler', 'helper', 'util', 'utils', 'service', 'manager',
  'provider', 'factory', 'builder', 'processor', 'validator', 'formatter',
  'parsed', 'converted', 'transformed', 'normalized', 'formatted', 'filtered',
  'mapped', 'reduced', 'sorted', 'updated', 'created', 'deleted', 'fetched',
]);

// ─── Language Calibration ────────────────────────────────────────────────────
// Offset applied after scoring to account for framework convention overlap.
// TypeScript/JS has many conventions that look like AI patterns. Shell scripts
// are almost always over-commented when AI-generated.

const LANG_CALIBRATION: Record<string, number> = {
  ts: -0.02, tsx: -0.02,   // React/TS conventions overlap with AI patterns (reduced penalty)
  js: -0.01, jsx: -0.01,   // JS has fewer framework conventions than TS
  py: 0.02,                 // Google/NumPy docstrings are strongly AI-typical
  sh: 0.05, bash: 0.05,    // AI over-comments every shell command
  ps1: 0.04,
  md: 0.03,                 // Uniform header structure is strongly AI-typical
};

// ─── Detector ────────────────────────────────────────────────────────────────

export class AICodeDetector {
  constructor(
    private readonly ai: AIProvider | null,
    private readonly heuristicWeight: number = 0.65,
    private readonly aiWeight: number = 0.35,
  ) {}

  async analyzeCode(code: string, filePath: string): Promise<AIDetectionResult> {
    const indicators = this._runHeuristics(code);
    const heuristicScore = this._computeWeightedScore(indicators);

    let aiAnalysisScore = heuristicScore;
    let analysisModel = 'heuristic-only';
    let aiReason: string | undefined;

    if (this.ai) {
      try {
        const result = await this._runAIAnalysis(code, filePath);
        aiAnalysisScore = result.score;
        aiReason = result.reason;
        analysisModel = this.ai.modelName;
      } catch {
        // AI analysis failed — heuristic score carries full weight
        aiAnalysisScore = heuristicScore;
      }
    }

    const rawScore = this.ai
      ? heuristicScore * this.heuristicWeight + aiAnalysisScore * this.aiWeight
      : heuristicScore;

    const calibration = this._getLanguageCalibration(filePath);
    const aiScore = Math.max(0, Math.min(1, rawScore + calibration));

    const confidenceInterval = this._computeConfidenceInterval(indicators, aiScore);
    const tier = this._scoreTier(aiScore);

    const lines = code.split('\n');
    const linesTotal = lines.length;
    const linesAI = Math.round(linesTotal * aiScore);

    const findings: CodeFinding[] = aiScore >= THRESHOLD_UNCERTAIN
      ? [this._buildFinding(filePath, aiScore, code, linesTotal, tier, indicators, aiReason)]
      : [];

    return {
      filePath,
      aiScore,
      heuristicScore,
      aiAnalysisScore,
      confidenceInterval,
      tier,
      findings,
      indicators,
      linesTotal,
      linesAI,
      analysisModel,
      analyzedAt: new Date().toISOString(),
    };
  }

  // ─── Heuristics ─────────────────────────────────────────────────────────────

  private _runHeuristics(code: string): AIIndicator[] {
    return [
      this._signalEntropy(code),
      this._signalCommentPatterns(code),
      this._signalGenericIdentifiers(code),
      this._signalBoilerplate(code),
      this._signalStructuralUniformity(code),
      this._signalCommentDensity(code),
      this._signalLineLengthUniformity(code),
    ];
  }

  // Combined signal: code-line repetition + per-line entropy uniformity.
  // Filters comment lines first — mixed comments/code inflate variance artificially.
  // AI code reuses identical statements (return result; const result = ...;) across
  // boilerplate functions, and produces uniformly-structured non-comment lines.
  private _signalEntropy(code: string): AIIndicator {
    const isCommentLine = (l: string) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(l);

    const codeLines = code.split('\n')
      .filter(l => !isCommentLine(l) && l.trim().length > 5);

    if (codeLines.length < 5) {
      return { type: 'entropy-burstiness', description: 'Insufficient code lines for analysis', weight: 0.25, score: 0 };
    }

    // Sub-signal 1: identical line repetition — AI reuses boilerplate phrases verbatim
    const trimmed = codeLines.map(l => l.trim());
    const freq = new Map<string, number>();
    for (const l of trimmed) freq.set(l, (freq.get(l) ?? 0) + 1);
    const duplicateCount = [...freq.values()].filter(c => c >= 2).reduce((s, c) => s + c, 0);
    const repetitionRatio = duplicateCount / codeLines.length;
    // Map: ratio=0→0, ratio≥0.20→1.0
    const repetitionScore = Math.min(repetitionRatio / 0.20, 1);

    // Sub-signal 2: entropy uniformity across code-only lines
    const entropies = codeLines
      .map(l => this._shannonEntropy(this._tokenizeLine(l)))
      .filter(e => e > 0);

    let uniformityScore = 0;
    if (entropies.length >= 3) {
      const mean = entropies.reduce((a, b) => a + b, 0) / entropies.length;
      const variance = entropies.reduce((a, e) => a + (e - mean) ** 2, 0) / entropies.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      // Low CV → uniform entropy across lines → AI-like. Map: cv=0.10→1.0, cv=0.40→0.0
      uniformityScore = Math.max(0, Math.min(1, (0.40 - cv) / 0.30));
    }

    // Repetition is a stronger signal; entropy uniformity reinforces it
    const score = 0.60 * repetitionScore + 0.40 * uniformityScore;
    return {
      type: 'entropy-burstiness',
      description: `Code repetition ${(repetitionRatio * 100).toFixed(1)}% + entropy uniformity (AI reuses identical statement patterns)`,
      weight: 0.25,
      score,
    };
  }

  // AI-specific comment phrasing — chosen to minimise FPs from real conventions.
  private _signalCommentPatterns(code: string): AIIndicator {
    let matches = 0;
    for (const p of AI_COMMENT_PATTERNS) {
      if (p.test(code)) matches++;
    }
    // 2 matches → full score (lowered from 3 to increase sensitivity)
    const score = Math.min(matches / 2, 1);
    return {
      type: 'comment-patterns',
      description: `${matches}/${AI_COMMENT_PATTERNS.length} AI-specific comment patterns matched`,
      weight: 0.20,
      score,
    };
  }

  // Generic vocabulary ratio — LLMs overuse a predictable set of identifiers.
  // Requires >30% generic identifiers before contributing meaningful signal.
  private _signalGenericIdentifiers(code: string): AIIndicator {
    const identifiers = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) ?? [];
    if (identifiers.length < 10) {
      return { type: 'generic-identifiers', description: 'Too few identifiers to evaluate', weight: 0.15, score: 0 };
    }

    const genericCount = identifiers.filter(id => GENERIC_IDENTIFIER_SET.has(id.toLowerCase())).length;
    const ratio = genericCount / identifiers.length;

    // Map: ratio≥0.30→1.0, ratio≤0.10→0.0  (tightened from 0.40/0.15)
    const score = Math.max(0, Math.min(1, (ratio - 0.10) / 0.20));
    return {
      type: 'generic-identifiers',
      description: `${(ratio * 100).toFixed(1)}% generic identifiers (AI defaults to non-domain vocabulary)`,
      weight: 0.15,
      score,
    };
  }

  // Structural boilerplate — AI overuses certain code skeletons.
  private _signalBoilerplate(code: string): AIIndicator {
    let matches = 0;
    for (const p of AI_BOILERPLATE_PATTERNS) {
      if (p.test(code)) matches++;
    }
    // 2 matches out of 6 → full score
    const score = Math.min(matches / 2, 1);
    return {
      type: 'boilerplate',
      description: `${matches} boilerplate code structures (default React/async skeletons)`,
      weight: 0.15,
      score,
    };
  }

  // Structural uniformity — AI repeats identical error-handling patterns.
  private _signalStructuralUniformity(code: string): AIIndicator {
    let matches = 0;
    for (const p of AI_STRUCTURE_SIGNATURES) {
      const found = code.match(p);
      if (found) matches += found.length;
    }
    const score = Math.min(matches / 3, 1);
    return {
      type: 'structure-uniformity',
      description: `${matches} repeated structural patterns (identical error handling, JSDoc blocks)`,
      weight: 0.15,
      score,
    };
  }

  // Comment density — AI over-comments but this signal alone causes FPs.
  // Weight is kept low; it amplifies other signals rather than driving the score.
  private _signalCommentDensity(code: string): AIIndicator {
    const lines = code.split('\n');
    const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
    const ratio = commentLines / Math.max(lines.length, 1);
    // AI typically comments 25–50% of lines. Normalise at 40% cap.
    const score = Math.min(ratio / 0.40, 1);
    return {
      type: 'comment-density',
      description: `Comment density ${(ratio * 100).toFixed(1)}% (AI over-comments relative to humans)`,
      weight: 0.10,
      score,
    };
  }

  // Line length uniformity — AI produces evenly-spaced lines; humans don't.
  private _signalLineLengthUniformity(code: string): AIIndicator {
    const lengths = code.split('\n')
      .filter(l => l.trim().length > 0)
      .map(l => l.length);

    if (lengths.length < 10) {
      return { type: 'line-length-uniformity', description: 'Too few lines for uniformity analysis', weight: 0, score: 0 };
    }

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, l) => a + (l - mean) ** 2, 0) / lengths.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;

    // Low CV → uniform line lengths → AI signal. Map: cv=0.30→1.0, cv=0.65→0.0
    // Weight 0 when <10 lines, so dynamically set to 0.10 here
    const score = Math.max(0, Math.min(1, (0.65 - cv) / 0.35));
    return {
      type: 'line-length-uniformity',
      description: `Line-length CV=${cv.toFixed(3)} (low variation suggests AI authorship)`,
      weight: 0.10,
      score,
    };
  }

  // ─── Scoring Utilities ────────────────────────────────────────────────────

  private _computeWeightedScore(indicators: AIIndicator[]): number {
    const totalWeight = indicators.reduce((s, i) => s + i.weight, 0);
    const weightedSum = indicators.reduce((s, i) => s + i.score * i.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private _computeConfidenceInterval(indicators: AIIndicator[], point: number): [number, number] {
    const activeIndicators = indicators.filter(i => i.weight > 0);
    if (activeIndicators.length < 2) return [point, point];

    const variance = activeIndicators.reduce((a, i) => a + (i.score - point) ** 2, 0) / activeIndicators.length;
    // 80% confidence interval: z=1.28
    const margin = 1.28 * Math.sqrt(variance) / Math.sqrt(activeIndicators.length);
    return [
      parseFloat(Math.max(0, point - margin).toFixed(3)),
      parseFloat(Math.min(1, point + margin).toFixed(3)),
    ];
  }

  private _scoreTier(score: number): AIDetectionTier {
    if (score >= THRESHOLD_DETECTED) return 'detected';
    if (score >= THRESHOLD_UNCERTAIN) return 'uncertain';
    return 'clean';
  }

  private _getLanguageCalibration(filePath: string): number {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return LANG_CALIBRATION[ext] ?? 0;
  }

  // ─── AI Semantic Analysis ─────────────────────────────────────────────────

  private async _runAIAnalysis(code: string, filePath: string): Promise<{ score: number; reason?: string }> {
    if (!this.ai) return { score: 0 };

    const ext = filePath.split('.').pop() ?? 'txt';
    const snippet = code.length > 1800 ? code.substring(0, 1800) + '\n...' : code;

    const prompt = `Rate 0.0–1.0: is this ${ext} LLM-generated? Judge by: domain depth, semantic genericness, edge-case correctness.
Reply ONLY JSON: {"score":0.82,"reason":"one sentence"}
\`\`\`${ext}
${snippet}
\`\`\``;

    const response = await this.ai.complete(prompt, { maxTokens: 80, temperature: 0 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { score: number; reason?: string };
        return { score: Math.max(0, Math.min(1, parsed.score)), reason: parsed.reason };
      }
    } catch {
      const numMatch = response.match(/\b(0\.\d+|1\.0|0|1)\b/);
      if (numMatch) return { score: parseFloat(numMatch[1]) };
    }

    return { score: 0.5 };
  }

  // ─── Finding Builder ──────────────────────────────────────────────────────

  private _buildFinding(
    filePath: string,
    score: number,
    code: string,
    lines: number,
    tier: AIDetectionTier,
    indicators?: AIIndicator[],
    aiReason?: string,
  ): CodeFinding {
    const severity = score >= 0.90 ? 'critical'
      : score >= 0.72 ? 'high'
      : score >= 0.55 ? 'medium'
      : 'low';

    const label = tier === 'detected'
      ? `AI-Generated Content Detected (${(score * 100).toFixed(0)}% confidence)`
      : `Possible AI-Generated Content — Human Review Recommended (${(score * 100).toFixed(0)}% signals)`;

    const description = tier === 'detected'
      ? `Strong evidence of AI authorship across ${indicators?.length ?? 0} independent signals.`
      : `Mixed signals — some AI patterns detected but below the high-confidence threshold.`;

    return {
      id: uuid(),
      category: 'ai-generated',
      severity,
      title: label,
      description,
      filePath,
      startLine: 1,
      endLine: lines,
      snippet: code.split('\n').slice(0, 10).join('\n'),
      confidence: score,
      recommendation: tier === 'detected'
        ? 'Review for correctness, edge cases, and domain-specific requirements that AI may have missed.'
        : 'Verify that the code reflects actual project requirements and not generic AI defaults.',
      indicators,
      aiReason,
    };
  }

  // ─── Entropy Utilities ────────────────────────────────────────────────────

  private _shannonEntropy(tokens: string[]): number {
    if (tokens.length === 0) return 0;
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / tokens.length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private _tokenizeLine(line: string): string[] {
    return line
      .split(/[\s\(\)\{\}\[\],;:=+\-*/<>!&|.'"\\@]+/)
      .filter(t => t.length >= 2);
  }
}
