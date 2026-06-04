import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIProviderManager } from '../providers/AIProviderManager';
import { SkillRegistry } from '../skills/SkillRegistry';
import { MananKanchuConfigManager } from '../core/config';
import { WebviewMessage, ScanSummary, FileScanResult, CodeFinding, ShellAnalysis, ProviderType } from '../core/interfaces';
import { ShellAnalyzer } from '../analyzers/ShellAnalyzer';

export type PostFn = (data: Record<string, unknown>) => void;

export class PanelMessageHandler {
  private _lastSummary: ScanSummary | null = null;
  private _lastFileResult: FileScanResult | null = null;
  private _scanInProgress = false;
  private _lastEditor: vscode.TextEditor | undefined;

  constructor(
    private readonly aiManager: AIProviderManager,
    private readonly skillRegistry: SkillRegistry,
    private readonly config: MananKanchuConfigManager,
    private readonly post: PostFn
  ) {}

  setLastEditor(editor: vscode.TextEditor | undefined): void {
    if (editor) this._lastEditor = editor;
  }

  async handle(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'scan-file':       return this.scanFile(msg['filePath'] as string, msg['code'] as string);
      case 'scan-project':    return this.scanProject();
      case 'scan-selection':  return this.scanSelection(msg['code'] as string, msg['filePath'] as string);
      case 'scan-shell':      return this.scanShell(msg['command'] as string);
      case 'generate-report': return this.generateReport(msg['format'] as string);
      case 'sanitize-finding': return this.sanitize(msg['finding'] as CodeFinding, msg['code'] as string);
      case 'configure-provider': return this.configureProvider();
      case 'get-models':      return this.sendProviderInfo();
      case 'load-scan-history': return this.sendScanHistory();
      case 'clear-findings':  return this.clearFindings();
      case 'export-report':   return this.exportReport();
      case 'update-threshold': return this.updateThreshold(msg['value'] as number);
      case 'list-workspace-files': return this.listWorkspaceFiles(msg['query'] as string);
      case 'get-file-preview': return this.getFilePreview(msg['filePath'] as string);
      case 'scan-region':     return this.scanRegion(msg['filePath'] as string, msg['startLine'] as number, msg['endLine'] as number);
      case 'apply-fix':       return this.applyFix(msg['findingId'] as string, msg['filePath'] as string, msg['startLine'] as number, msg['endLine'] as number, msg['fixedCode'] as string);
    }
  }

  async scanFile(filePath?: string, code?: string): Promise<void> {
    if (this._scanInProgress) { this.post({ type: 'scan-busy' }); return; }
    this._scanInProgress = true;
    this.post({ type: 'scan-started', target: filePath ?? 'selection' });

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const ai = this.aiManager.getActive();
    let targetPath = filePath;
    let targetCode = code;

    if (!targetPath && !targetCode) {
      const editor = vscode.window.activeTextEditor ?? this._lastEditor;
      if (!editor) {
        this.post({ type: 'scan-error', message: 'No active editor' });
        this._scanInProgress = false;
        return;
      }
      targetPath = editor.document.fileName;
      targetCode = editor.document.getText();
    }

    try {
      const result = await this.skillRegistry.execute('scan-file', {
        ai: ai!,
        workspace,
        parameters: { filePath: targetPath ?? 'selection.ts', code: targetCode },
        config: this.config.toConfig(),
      });
      if (result.success) {
        this._lastFileResult = result.output as FileScanResult;
        this.post({ type: 'scan-file-result', result: result.output });
      } else {
        this.post({ type: 'scan-error', message: result.errors?.[0] ?? 'Scan failed' });
      }
    } catch (e) {
      this.post({ type: 'scan-error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      this._scanInProgress = false;
    }
  }

  async scanSelection(code?: string, filePath?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor ?? this._lastEditor;
    const selection = editor?.selection;
    const selectedCode = code ?? (selection && !selection.isEmpty ? editor?.document.getText(selection) : undefined);
    if (!selectedCode) { this.post({ type: 'scan-error', message: 'No code selected' }); return; }
    const fp = filePath ?? editor?.document.fileName ?? 'selection.ts';
    await this.scanFile(fp, selectedCode);
  }

  async scanProject(): Promise<void> {
    if (this._scanInProgress) { this.post({ type: 'scan-busy' }); return; }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    if (!workspace) { this.post({ type: 'scan-error', message: 'No workspace folder open' }); return; }

    this._scanInProgress = true;
    this.post({ type: 'scan-started', target: 'project' });
    const ai = this.aiManager.getActive();

    try {
      const result = await this.skillRegistry.execute('scan-project', {
        ai: ai!,
        workspace,
        parameters: {},
        config: this.config.toConfig(),
      });
      if (result.success) {
        this._lastSummary = result.output as ScanSummary;
        this.post({ type: 'scan-project-result', summary: result.output });
      } else {
        this.post({ type: 'scan-error', message: result.errors?.[0] ?? 'Scan failed' });
      }
    } catch (e) {
      this.post({ type: 'scan-error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      this._scanInProgress = false;
    }
  }

  async scanShell(command?: string): Promise<void> {
    if (!command) { this.post({ type: 'scan-error', message: 'No shell command provided' }); return; }
    const ai = this.aiManager.getActive();
    const analyzer = new ShellAnalyzer(ai);
    const analysis: ShellAnalysis = await analyzer.analyze(command);
    this.post({ type: 'shell-result', analysis });
  }

  async generateReport(format?: string): Promise<void> {
    if (!this._lastSummary) {
      this.post({ type: 'report-error', message: 'No scan results available. Run a project scan first.' });
      return;
    }
    const ai = this.aiManager.getActive();
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const result = await this.skillRegistry.execute('generate-report', {
      ai: ai!,
      workspace,
      parameters: { summary: this._lastSummary, format: format ?? 'markdown' },
      config: this.config.toConfig(),
    });
    if (result.success) {
      const { report, reportPath } = result.output as { report: unknown; reportPath: string };
      this.post({ type: 'report-ready', report, reportPath });
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } else {
      this.post({ type: 'report-error', message: result.errors?.[0] });
    }
  }

  async sanitize(finding?: CodeFinding, code?: string): Promise<void> {
    if (!finding) { this.post({ type: 'sanitize-error', message: 'No finding provided' }); return; }
    if (!this.aiManager.getActive()) { this.post({ type: 'sanitize-error', message: 'No AI provider available' }); return; }

    const ai = this.aiManager.getActive()!;
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    let fileCode = code ?? '';
    if (!fileCode && finding.filePath) {
      try { fileCode = fs.readFileSync(finding.filePath, 'utf-8'); } catch { /* keep empty */ }
    }

    const result = await this.skillRegistry.execute('sanitize-code', {
      ai,
      workspace,
      parameters: { code: fileCode, finding },
      config: this.config.toConfig(),
    });
    if (result.success) {
      this.post({ type: 'sanitize-result', result: result.output });
    } else {
      this.post({ type: 'sanitize-error', message: result.errors?.[0] });
    }
  }

  async configureProvider(): Promise<void> {
    const providers = [
      { label: 'Auto (prefer local)', id: 'auto', isLocal: true },
      { label: 'Ollama (Local)', id: 'ollama', isLocal: true },
      { label: 'LM Studio (Local)', id: 'lmstudio', isLocal: true },
      { label: 'Anthropic Claude', id: 'anthropic', isLocal: false },
      { label: 'OpenAI GPT', id: 'openai', isLocal: false },
      { label: 'Google Gemini', id: 'gemini', isLocal: false },
    ];
    const pick = await vscode.window.showQuickPick(providers.map(p => p.label), { placeHolder: 'Select AI provider' });
    if (!pick) return;
    const provider = providers.find(p => p.label === pick);
    if (!provider) return;

    if (!provider.isLocal) {
      const key = await vscode.window.showInputBox({
        prompt: `Enter API key for ${provider.label}`,
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;
      await this.aiManager.refreshProvider(provider.id as ProviderType, key);
    } else {
      await this.config.updateSetting('preferredProvider', provider.id);
      await this.aiManager.reselect();
    }
    vscode.window.showInformationMessage(`Provider configured: ${provider.label}`);
    this.sendProviderInfo();
  }

  sendProviderInfo(): void {
    this.post({ type: 'provider-info', provider: this.aiManager.getActiveInfo() });
  }

  sendScanHistory(): void {
    this.post({ type: 'scan-history', summary: this._lastSummary, fileResult: this._lastFileResult });
  }

  clearFindings(): void {
    this._lastSummary = null;
    this._lastFileResult = null;
    this.post({ type: 'findings-cleared' });
  }

  async exportReport(): Promise<void> {
    if (!this._lastSummary) {
      vscode.window.showWarningMessage('No scan results to export. Run a scan first.');
      return;
    }
    await this.generateReport('markdown');
  }

  async updateThreshold(value?: number): Promise<void> {
    if (value === undefined || value < 0 || value > 1) return;
    await this.config.updateSetting('detection.threshold', value);
    this.post({ type: 'threshold-updated', value });
  }

  async listWorkspaceFiles(query?: string): Promise<void> {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) { this.post({ type: 'workspace-files', files: [] }); return; }
    const wsPath = wsFolder.uri.fsPath;
    try {
      const uris = await vscode.workspace.findFiles(
        '**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,rb,php,cpp,c,h,sh,sql,vue,svelte,kt,swift}',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**}',
        500
      );
      let files = uris.map(uri => {
        const rel = path.relative(wsPath, uri.fsPath).replace(/\\/g, '/');
        return { path: uri.fsPath, relativePath: rel, name: path.basename(uri.fsPath), ext: path.extname(uri.fsPath).slice(1) };
      }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      if (query) {
        const q = query.toLowerCase();
        files = files.filter(f => f.relativePath.toLowerCase().includes(q));
      }
      this.post({ type: 'workspace-files', files: files.slice(0, 200) });
    } catch {
      this.post({ type: 'workspace-files', files: [] });
    }
  }

  getFilePreview(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n');
      const lines = allLines.slice(0, 300).map((text, i) => ({ n: i + 1, text }));
      this.post({ type: 'file-preview', filePath, lines, total: allLines.length });
    } catch {
      this.post({ type: 'file-preview-error', message: 'Cannot read file' });
    }
  }

  async scanRegion(filePath: string, startLine?: number, endLine?: number): Promise<void> {
    let code: string | undefined;
    if (startLine && endLine && endLine >= startLine) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        code = content.split('\n').slice(startLine - 1, endLine).join('\n');
      } catch { /* fallback to full file */ }
    }
    await this.scanFile(filePath, code);
  }

  async applyFix(findingId: string, filePath: string, startLine: number, endLine: number, fixedCode: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const lineStart = Math.max(0, startLine - 1);
      const lineEnd = Math.min(lines.length, endLine);

      const originalFirstLine = lines[lineStart] ?? '';
      const baseIndent = originalFirstLine.match(/^(\s*)/)?.[1] ?? '';
      const fixedLines = fixedCode.split('\n');
      const fixFirstIndent = fixedLines[0]?.match(/^(\s*)/)?.[1] ?? '';

      const adjustedFixed = baseIndent.length > fixFirstIndent.length
        ? fixedLines.map(l => baseIndent + l.trimStart())
        : fixedLines;

      const newLines = [...lines.slice(0, lineStart), ...adjustedFixed, ...lines.slice(lineEnd)];
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      this.post({ type: 'fix-applied', findingId, filePath });
    } catch (e) {
      this.post({ type: 'fix-error', findingId, message: e instanceof Error ? e.message : String(e) });
    }
  }
}
