import { AIProvider, ShellAnalysis, ShellIssue, SeverityLevel } from '../core/interfaces';

interface ShellPattern {
  type: ShellIssue['type'];
  pattern: RegExp;
  severity: SeverityLevel;
  description: string;
  suggestion?: string;
}

const SHELL_PATTERNS: ShellPattern[] = [
  {
    type: 'destructive',
    pattern: /\brm\s+-[a-z]*f[a-z]*\s+[/~$]/i,
    severity: 'critical',
    description: 'rm -rf on root/home paths can destroy the filesystem.',
    suggestion: 'Specify exact paths and test with --dry-run first.',
  },
  {
    type: 'destructive',
    pattern: /\bdd\s+if=\/dev\/zero|if=\/dev\/random/i,
    severity: 'critical',
    description: 'dd with zero/random input can overwrite entire disks.',
    suggestion: 'Use with extreme caution. Specify exact byte count.',
  },
  {
    type: 'privilege-escalation',
    pattern: /\bsudo\s+(?:su|bash|sh|zsh|fish)\b/i,
    severity: 'critical',
    description: 'sudo shell drops you into a root shell with no audit trail.',
    suggestion: 'Use sudo with specific commands instead of opening a shell.',
  },
  {
    type: 'insecure-pipe',
    pattern: /curl\s+[^|]*\|\s*(?:bash|sh|zsh|python|perl|ruby|node)/i,
    severity: 'critical',
    description: 'Piping remote script directly to shell without inspection.',
    suggestion: 'Download the script first, review it, then execute separately.',
  },
  {
    type: 'insecure-pipe',
    pattern: /wget\s+[^|]*\|\s*(?:bash|sh|zsh|python)/i,
    severity: 'critical',
    description: 'wget piped to shell executes unverified remote code.',
    suggestion: 'Download and inspect before executing: wget url && cat script.sh && bash script.sh',
  },
  {
    type: 'privilege-escalation',
    pattern: /chmod\s+[0-9]*7[0-9][0-9]\s+/,
    severity: 'high',
    description: 'chmod 777 grants world-writable permissions — security risk.',
    suggestion: 'Use minimum required permissions: chmod 755 for executables, 644 for files.',
  },
  {
    type: 'command-injection',
    pattern: /\$\(|`[^`]*\$[A-Z_]+[^`]*`/,
    severity: 'high',
    description: 'Command substitution with environment variables — injection risk if unsanitized.',
    suggestion: 'Quote variables: "$VAR" and validate inputs before use.',
  },
  {
    type: 'network-exfiltration',
    pattern: /(?:curl|wget|nc|netcat)\s+.*\s+(?:\/etc\/passwd|\/etc\/shadow|~\/\.ssh)/i,
    severity: 'critical',
    description: 'Sensitive system files being sent over network.',
    suggestion: 'This is a red flag. Investigate immediately.',
  },
  {
    type: 'destructive',
    pattern: />\s*\/dev\/s[a-z][a-z0-9]|>\s*\/dev\/hd[a-z]/,
    severity: 'critical',
    description: 'Writing to raw disk device can destroy data.',
    suggestion: 'Never write to block devices without explicit backup plan.',
  },
  {
    type: 'privilege-escalation',
    pattern: /crontab\s+-[ei]/i,
    severity: 'medium',
    description: 'Modifying cron jobs can establish persistence.',
    suggestion: 'Review crontab changes carefully for unexpected entries.',
  },
  {
    type: 'network-exfiltration',
    pattern: /\bssh\s+.*-R\s+\d+:/i,
    severity: 'high',
    description: 'Reverse SSH tunnel — can expose internal services externally.',
    suggestion: 'Ensure this tunnel is authorized and monitored.',
  },
  {
    type: 'destructive',
    pattern: /\btruncate\s+-s\s+0|:\s*>\s*(?:\/[a-z]+){2,}/,
    severity: 'high',
    description: 'Truncating files to zero bytes destroys content.',
    suggestion: 'Backup before truncating. Use with caution on system logs.',
  },
];

export class ShellAnalyzer {
  constructor(private readonly ai: AIProvider | null) {}

  async analyze(command: string): Promise<ShellAnalysis> {
    const rawIssues = this._runHeuristicPatterns(command);
    const issues: ShellIssue[] = rawIssues.map(r => ({ type: r.type, description: r.description, severity: r.severity }));
    const riskLevel = this._computeRisk(issues);

    let suggestion: string | undefined;
    let saferAlternative: string | undefined;

    if (this.ai && issues.length > 0) {
      try {
        const result = await this._aiAnalyze(command, issues);
        suggestion = result.suggestion;
        saferAlternative = result.saferAlternative;
      } catch {
        suggestion = rawIssues[0]?.suggestion;
      }
    } else {
      suggestion = rawIssues[0]?.suggestion;
    }

    return { command, riskLevel, issues, suggestion, saferAlternative };
  }

  private _runHeuristicPatterns(command: string): ShellPattern[] {
    return SHELL_PATTERNS.filter(sp => sp.pattern.test(command));
  }

  private _computeRisk(issues: ShellIssue[]): SeverityLevel {
    if (!issues.length) return 'info';
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    if (issues.some(i => i.severity === 'high')) return 'high';
    if (issues.some(i => i.severity === 'medium')) return 'medium';
    return 'low';
  }

  private async _aiAnalyze(command: string, issues: ShellIssue[]): Promise<{
    suggestion?: string;
    saferAlternative?: string;
  }> {
    if (!this.ai) return {};

    const prompt = `Analyze this shell command and provide safety guidance:

Command: ${command}
Detected issues: ${issues.map(i => i.description).join('; ')}

Respond ONLY with JSON: {"suggestion": "short safety tip", "saferAlternative": "safer version of the command or null"}`;

    const response = await this.ai.complete(prompt, { maxTokens: 200, temperature: 0 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as { suggestion?: string; saferAlternative?: string };
      }
    } catch {
      return {};
    }

    return {};
  }
}
