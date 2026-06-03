// ─── Provider Types ───────────────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lmstudio';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

export interface AIProvider {
  readonly name: string;
  readonly type: ProviderType;
  readonly modelName: string;
  isAvailable(): Promise<boolean>;
  chat(messages: Message[], options?: ChatOptions): Promise<AIResponse>;
  complete(prompt: string, options?: ChatOptions): Promise<string>;
}

// ─── Detection Types ──────────────────────────────────────────────────────────

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingCategory =
  | 'ai-generated'
  | 'vulnerability'
  | 'malicious'
  | 'policy-violation'
  | 'secret-exposure'
  | 'shell-risk';

export interface CodeFinding {
  id: string;
  category: FindingCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  confidence: number;        // 0-1
  recommendation?: string;
  sanitizedCode?: string;
  cveId?: string;
  policyRule?: string;
  indicators?: AIIndicator[];
  aiReason?: string;
}

export type AIDetectionTier = 'clean' | 'uncertain' | 'detected';

export interface AIDetectionResult {
  filePath: string;
  aiScore: number;                       // 0-1, calibrated probability
  heuristicScore: number;
  aiAnalysisScore: number;
  confidenceInterval: [number, number];  // 80% CI around aiScore
  tier: AIDetectionTier;                 // clean <0.45 | uncertain 0.45-0.72 | detected >0.72
  findings: CodeFinding[];
  indicators: AIIndicator[];
  linesTotal: number;
  linesAI: number;
  analysisModel: string;
  analyzedAt: string;
}

export interface AIIndicator {
  type:
    | 'comment-density'
    | 'comment-patterns'
    | 'naming-pattern'
    | 'boilerplate'
    | 'structure-uniformity'
    | 'signature-match'
    | 'entropy-burstiness'
    | 'line-length-uniformity'
    | 'generic-identifiers';
  description: string;
  weight: number;
  score: number;
}

// ─── Vulnerability Types ──────────────────────────────────────────────────────

export interface VulnerabilityResult {
  filePath: string;
  findings: CodeFinding[];
  riskScore: number;         // 0-10 CVSS-like
  analyzedAt: string;
}

// ─── Policy Types ─────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  severity: SeverityLevel;
  pattern?: RegExp;
  check?: (code: string, filePath: string) => PolicyViolation[];
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: SeverityLevel;
  filePath: string;
  line: number;
  snippet: string;
  message: string;
}

export interface PolicyEvaluationResult {
  filePath: string;
  violations: PolicyViolation[];
  passed: string[];
  score: number;             // 0-100, compliance %
  analyzedAt: string;
}

// ─── Shell Analysis Types ─────────────────────────────────────────────────────

export interface ShellAnalysis {
  command: string;
  riskLevel: SeverityLevel;
  issues: ShellIssue[];
  suggestion?: string;
  saferAlternative?: string;
}

export interface ShellIssue {
  type: 'command-injection' | 'destructive' | 'privilege-escalation' | 'network-exfiltration' | 'insecure-pipe';
  description: string;
  severity: SeverityLevel;
}

// ─── Project Scan Types ───────────────────────────────────────────────────────

export interface ScanSummary {
  projectPath: string;
  filesScanned: number;
  filesSkipped: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  aiGeneratedFiles: number;
  averageAiScore: number;
  topFindings: CodeFinding[];
  fileResults: FileScanResult[];
  scanDurationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface FileScanResult {
  filePath: string;
  language: string;
  linesOfCode: number;
  aiScore: number;
  vulnerabilities: number;
  policyViolations: number;
  severity: SeverityLevel;
  findings: CodeFinding[];
}

// ─── Skills Types ─────────────────────────────────────────────────────────────

export interface SkillContext {
  ai: AIProvider;
  workspace: string;
  parameters: Record<string, unknown>;
  config?: MananKanchuConfig;
}

export interface SkillResult {
  success: boolean;
  output?: unknown;
  errors?: string[];
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  execute(context: SkillContext): Promise<SkillResult>;
}

// ─── MCP Types ────────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface MCPServer {
  readonly id: string;
  readonly name: string;
  readonly tools: MCPTool[];
}

export interface MCPExecutor {
  executeTool(serverId: string, toolName: string, params: Record<string, unknown>): Promise<unknown>;
}

// ─── Config Type ──────────────────────────────────────────────────────────────

export interface MananKanchuConfig {
  preferredProvider: string;
  maxTokens: number;
  temperature: number;
  requestTimeout: number;
  detectionThreshold: number;
  heuristicWeight: number;
  aiWeight: number;
  excludePatterns: string[];
  maxFileSizeKB: number;
  activePolicies: string[];
  privacyTelemetry: boolean;
}

// ─── Webview Message Types ────────────────────────────────────────────────────

export type WebviewMessageType =
  | 'open-dashboard'
  | 'scan-file'
  | 'scan-project'
  | 'scan-selection'
  | 'scan-shell'
  | 'scan-policy'
  | 'generate-report'
  | 'sanitize-finding'
  | 'switch-tab'
  | 'configure-provider'
  | 'get-models'
  | 'load-scan-history'
  | 'clear-findings'
  | 'export-report'
  | 'apply-fix'
  | 'add-policy'
  | 'remove-policy'
  | 'update-threshold'
  | 'list-workspace-files'
  | 'get-file-preview'
  | 'scan-region'
  | 'get-file-scan-preview'
  | 'get-selection-scan-preview'
  | 'add-custom-policy';

export interface WebviewMessage {
  type: WebviewMessageType;
  [key: string]: unknown;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface AuditReport {
  title: string;
  projectPath: string;
  generatedAt: string;
  summary: ScanSummary;
  recommendations: Recommendation[];
  format: 'markdown' | 'json' | 'html';
  content: string;
}

export interface Recommendation {
  priority: number;
  category: FindingCategory;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}
