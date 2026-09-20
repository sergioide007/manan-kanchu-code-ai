import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FilesystemMCP } from '../../../mcp/FilesystemMCP';
import { MCPManager } from '../../../mcp/MCPManager';
import { readWorkspaceFile, writeWorkspaceFile } from '../../../mcp/workspaceFiles';
import { SkillRegistry } from '../../../skills/SkillRegistry';
import { ScanFileSkill } from '../../../skills/ScanFileSkill';
import { ScanProjectSkill } from '../../../skills/ScanProjectSkill';
import { GenerateReportSkill } from '../../../skills/GenerateReportSkill';
import { FileScanResult, ScanSummary } from '../../../core/interfaces';

describe('MCP is connected to file access', () => {
  let dir: string;
  let mcp: MCPManager;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-wire-'));
    mcp = new MCPManager();
    mcp.registerServer(new FilesystemMCP(dir));
    spy = jest.spyOn(mcp, 'executeTool');
  });
  afterEach(() => { spy.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('hasTool reports registered tools only', () => {
    expect(mcp.hasTool('filesystem', 'read_file')).toBe(true);
    expect(mcp.hasTool('filesystem', 'nope')).toBe(false);
    expect(mcp.hasTool('nope', 'read_file')).toBe(false);
  });

  it('reads and writes inside the workspace go through the MCP tools', async () => {
    await writeWorkspaceFile(mcp, dir, 'sub/a.txt', 'hello');
    expect(await readWorkspaceFile(mcp, dir, 'sub/a.txt')).toBe('hello');
    expect(spy.mock.calls.map(c => c[1])).toEqual(['write_file', 'read_file']);
  });

  it('falls back to plain fs (creating folders) when no MCP server is registered', async () => {
    await writeWorkspaceFile(undefined, dir, 'x/y/z.txt', 'plain');
    expect(await readWorkspaceFile(new MCPManager(), dir, 'x/y/z.txt')).toBe('plain');
  });

  it('files outside the workspace never use the MCP server', async () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-other-'));
    fs.writeFileSync(path.join(other, 'f.txt'), 'outside');
    expect(await readWorkspaceFile(mcp, dir, path.join(other, 'f.txt'))).toBe('outside');
    expect(spy).not.toHaveBeenCalled();
    fs.rmSync(other, { recursive: true, force: true });
  });

  it('the registry hands its MCP manager to skills; scan-file and scan-project read through it', async () => {
    fs.writeFileSync(path.join(dir, 'a.js'), 'eval(x)\n');
    const registry = new SkillRegistry(undefined, mcp);
    registry.register(new ScanFileSkill());
    registry.register(new ScanProjectSkill());

    const file = await registry.execute('scan-file', { ai: null as never, workspace: dir, parameters: { filePath: 'a.js' } });
    expect(file.success).toBe(true);
    expect((file.output as FileScanResult).findings.some(f => f.title.includes('eval'))).toBe(true);

    const project = await registry.execute('scan-project', { ai: null as never, workspace: dir, parameters: {} });
    expect(project.success).toBe(true);
    expect(spy.mock.calls.filter(c => c[1] === 'read_file')).toHaveLength(2);
  });

  it('generate-report writes the report through the MCP write_file tool', async () => {
    const registry = new SkillRegistry(undefined, mcp);
    registry.register(new GenerateReportSkill());
    const summary = { projectPath: dir, filesScanned: 0, filesSkipped: 0, totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0,
      lowCount: 0, aiGeneratedFiles: 0, averageAiScore: 0, topFindings: [], fileResults: [], scanDurationMs: 1, startedAt: '', completedAt: '' } as ScanSummary;
    const res = await registry.execute('generate-report', { ai: null as never, workspace: dir, parameters: { summary } });
    expect(res.success).toBe(true);
    expect(spy.mock.calls.some(c => c[1] === 'write_file')).toBe(true);
    expect(fs.existsSync((res.output as { reportPath: string }).reportPath)).toBe(true);
  });

  it('project summaries list every active policy with its real violation count', async () => {
    fs.writeFileSync(path.join(dir, 'a.js'), 'eval(x)\n// TODO fix\n');
    const registry = new SkillRegistry(undefined, mcp);
    registry.register(new ScanProjectSkill());
    const cfg = { preferredProvider: 'auto', maxTokens: 1, temperature: 0, requestTimeout: 1, detectionThreshold: 0.65, heuristicWeight: 0.4, aiWeight: 0.6,
      excludePatterns: [], maxFileSizeKB: 512, activePolicies: ['no-eval', 'no-todo-comments', 'no-debugger'], privacyTelemetry: false };
    const res = await registry.execute('scan-project', { ai: null as never, workspace: dir, parameters: {}, config: cfg });
    const policies = (res.output as ScanSummary).policies!;
    expect(policies.map(p => p.id).sort()).toEqual(['no-debugger', 'no-eval', 'no-todo-comments']);
    expect(Object.fromEntries(policies.map(p => [p.id, p.violations]))).toEqual({ 'no-eval': 1, 'no-todo-comments': 1, 'no-debugger': 0 });
  });
});
