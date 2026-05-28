let _counter = 0;

export function uuid(): string {
  _counter++;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${_counter}`;
}

export function detectLanguage(filePath: string): string {
  const basename = filePath.split(/[\\/]/).pop() ?? '';
  // Files with no extension or special DevOps names
  const basenameMap: Record<string, string> = {
    Dockerfile: 'Dockerfile', Makefile: 'Makefile', Jenkinsfile: 'Groovy',
  };
  if (basenameMap[basename]) return basenameMap[basename];

  const raw = basename.split('.').pop();
  const ext = (raw ? raw.toLowerCase() : '');
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript/JSX', js: 'JavaScript', jsx: 'JavaScript/JSX',
    py: 'Python', java: 'Java', cs: 'C#', cpp: 'C++', c: 'C', go: 'Go',
    rs: 'Rust', rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
    sh: 'Shell', bash: 'Bash', ps1: 'PowerShell', sql: 'SQL',
    html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', yaml: 'YAML', yml: 'YAML',
    md: 'Markdown', xml: 'XML',
    // IaC / DevOps
    tf: 'Terraform', hcl: 'HCL',
  };
  return map[ext] ?? (ext.toUpperCase() || 'Unknown');
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '\n...[truncated]';
}

export function severityToNumber(s: string): number {
  switch (s) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export function maxSeverity(severities: string[]): string {
  if (!severities.length) return 'info';
  return severities.sort((a, b) => severityToNumber(b) - severityToNumber(a))[0];
}
