import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { AIProviderManager } from '../providers/AIProviderManager';
import { SkillRegistry } from '../skills/SkillRegistry';
import { MCPManager } from '../mcp/MCPManager';
import { MananKanchuConfigManager } from '../core/config';
import { WebviewMessage, ScanSummary, FileScanResult, CodeFinding, ShellAnalysis, ProviderType } from '../core/interfaces';
import { ShellAnalyzer } from '../analyzers/ShellAnalyzer';

export class MainPanel {
  public static current: MainPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private _lastSummary: ScanSummary | null = null;
  private _lastFileResult: FileScanResult | null = null;
  private _scanInProgress = false;

  static show(
    context: vscode.ExtensionContext,
    aiManager: AIProviderManager,
    skillRegistry: SkillRegistry,
    mcpManager: MCPManager,
    config: MananKanchuConfigManager
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (MainPanel.current) {
      MainPanel.current._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'manan-kanchu',
      'manan-kanchu — AI Detector',
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    MainPanel.current = new MainPanel(panel, context, aiManager, skillRegistry, mcpManager, config);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly aiManager: AIProviderManager,
    private readonly skillRegistry: SkillRegistry,
    private readonly mcpManager: MCPManager,
    private readonly config: MananKanchuConfigManager
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage((msg: WebviewMessage) => this._handle(msg), null, this._disposables);
    this._panel.webview.html = this._html();
  }

  private async _handle(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'scan-file': return this._handleScanFile(msg['filePath'] as string, msg['code'] as string);
      case 'scan-project': return this._handleScanProject();
      case 'scan-selection': return this._handleScanSelection(msg['code'] as string, msg['filePath'] as string);
      case 'scan-shell': return this._handleScanShell(msg['command'] as string);
      case 'generate-report': return this._handleGenerateReport(msg['format'] as string);
      case 'sanitize-finding': return this._handleSanitize(msg['finding'] as CodeFinding, msg['code'] as string);
      case 'configure-provider': return this._handleConfigureProvider();
      case 'get-models': return this._sendProviderInfo();
      case 'load-scan-history': return this._sendScanHistory();
      case 'clear-findings': return this._clearFindings();
      case 'export-report': return this._handleExportReport();
      case 'update-threshold': return this._handleUpdateThreshold(msg['value'] as number);
      case 'list-workspace-files': return this._handleListWorkspaceFiles(msg['query'] as string);
      case 'get-file-preview': return this._handleGetFilePreview(msg['filePath'] as string);
      case 'scan-region': return this._handleScanRegion(msg['filePath'] as string, msg['startLine'] as number, msg['endLine'] as number);
    }
  }

  private async _handleScanFile(filePath?: string, code?: string): Promise<void> {
    if (this._scanInProgress) {
      this._post({ type: 'scan-busy' });
      return;
    }
    this._scanInProgress = true;
    this._post({ type: 'scan-started', target: filePath ?? 'selection' });

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const ai = this.aiManager.getActive();

    let targetPath = filePath;
    let targetCode = code;

    if (!targetPath && !targetCode) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this._post({ type: 'scan-error', message: 'No active editor' });
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
        this._post({ type: 'scan-file-result', result: result.output });
      } else {
        this._post({ type: 'scan-error', message: result.errors?.[0] ?? 'Scan failed' });
      }
    } catch (e) {
      this._post({ type: 'scan-error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      this._scanInProgress = false;
    }
  }

  private async _handleScanSelection(code?: string, filePath?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const selection = editor?.selection;
    const selectedCode = code ?? (selection && !selection.isEmpty
      ? editor?.document.getText(selection)
      : undefined);

    if (!selectedCode) {
      this._post({ type: 'scan-error', message: 'No code selected' });
      return;
    }

    const path = filePath ?? editor?.document.fileName ?? 'selection.ts';
    await this._handleScanFile(path, selectedCode);
  }

  private async _handleScanProject(): Promise<void> {
    if (this._scanInProgress) {
      this._post({ type: 'scan-busy' });
      return;
    }

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    if (!workspace) {
      this._post({ type: 'scan-error', message: 'No workspace folder open' });
      return;
    }

    this._scanInProgress = true;
    this._post({ type: 'scan-started', target: 'project' });

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
        this._post({ type: 'scan-project-result', summary: result.output });
      } else {
        this._post({ type: 'scan-error', message: result.errors?.[0] ?? 'Scan failed' });
      }
    } catch (e) {
      this._post({ type: 'scan-error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      this._scanInProgress = false;
    }
  }

  private async _handleScanShell(command?: string): Promise<void> {
    if (!command) {
      this._post({ type: 'scan-error', message: 'No shell command provided' });
      return;
    }
    const ai = this.aiManager.getActive();
    const analyzer = new ShellAnalyzer(ai);
    const analysis: ShellAnalysis = await analyzer.analyze(command);
    this._post({ type: 'shell-result', analysis });
  }

  private async _handleGenerateReport(format?: string): Promise<void> {
    if (!this._lastSummary) {
      this._post({ type: 'report-error', message: 'No scan results available. Run a project scan first.' });
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
      this._post({ type: 'report-ready', report, reportPath });
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } else {
      this._post({ type: 'report-error', message: result.errors?.[0] });
    }
  }

  private async _handleSanitize(finding?: CodeFinding, code?: string): Promise<void> {
    if (!finding) {
      this._post({ type: 'sanitize-error', message: 'No finding provided' });
      return;
    }
    if (!this.aiManager.getActive()) {
      this._post({ type: 'sanitize-error', message: 'No AI provider available' });
      return;
    }

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
      this._post({ type: 'sanitize-result', result: result.output });
    } else {
      this._post({ type: 'sanitize-error', message: result.errors?.[0] });
    }
  }

  private async _handleConfigureProvider(): Promise<void> {
    const providers = [
      { label: 'Auto (prefer local)', id: 'auto', isLocal: true },
      { label: 'Ollama (Local)', id: 'ollama', isLocal: true },
      { label: 'LM Studio (Local)', id: 'lmstudio', isLocal: true },
      { label: 'Anthropic Claude', id: 'anthropic', isLocal: false },
      { label: 'OpenAI GPT', id: 'openai', isLocal: false },
      { label: 'Google Gemini', id: 'gemini', isLocal: false },
    ];

    const pick = await vscode.window.showQuickPick(providers.map(p => p.label), {
      placeHolder: 'Select AI provider',
    });
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
      vscode.window.showInformationMessage(`Provider configured: ${provider.label}`);
    } else {
      await this.config.updateSetting('preferredProvider', provider.id);
      await this.aiManager.reselect();
      vscode.window.showInformationMessage(`Provider configured: ${provider.label}`);
    }

    this._sendProviderInfo();
  }

  private _sendProviderInfo(): void {
    const info = this.aiManager.getActiveInfo();
    this._post({ type: 'provider-info', provider: info });
  }

  private _sendScanHistory(): void {
    this._post({ type: 'scan-history', summary: this._lastSummary, fileResult: this._lastFileResult });
  }

  private _clearFindings(): void {
    this._lastSummary = null;
    this._lastFileResult = null;
    this._post({ type: 'findings-cleared' });
  }

  private async _handleExportReport(): Promise<void> {
    if (!this._lastSummary) {
      vscode.window.showWarningMessage('No scan results to export. Run a scan first.');
      return;
    }
    await this._handleGenerateReport('markdown');
  }

  private async _handleUpdateThreshold(value?: number): Promise<void> {
    if (value === undefined || value < 0 || value > 1) return;
    await this.config.updateSetting('detection.threshold', value);
    this._post({ type: 'threshold-updated', value });
  }

  private _post(data: Record<string, unknown>): void {
    this._panel.webview.postMessage(data);
  }

  private async _handleListWorkspaceFiles(query?: string): Promise<void> {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) {
      this._post({ type: 'workspace-files', files: [] });
      return;
    }
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
      this._post({ type: 'workspace-files', files: files.slice(0, 200) });
    } catch {
      this._post({ type: 'workspace-files', files: [] });
    }
  }

  private _handleGetFilePreview(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n');
      const lines = allLines.slice(0, 300).map((text, i) => ({ n: i + 1, text }));
      this._post({ type: 'file-preview', filePath, lines, total: allLines.length });
    } catch {
      this._post({ type: 'file-preview-error', message: 'Cannot read file' });
    }
  }

  private async _handleScanRegion(filePath: string, startLine?: number, endLine?: number): Promise<void> {
    let code: string | undefined;
    if (startLine && endLine && endLine >= startLine) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        code = content.split('\n').slice(startLine - 1, endLine).join('\n');
      } catch { /* fallback to full file */ }
    }
    await this._handleScanFile(filePath, code);
  }

  public triggerScanFile(filePath?: string, code?: string): void {
    this._handleScanFile(filePath, code);
  }

  public triggerScanProject(): void {
    this._handleScanProject();
  }

  refreshProviders(): void {
    this._sendProviderInfo();
    this._panel.webview.html = this._html();
  }

  dispose(): void {
    MainPanel.current = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
  }

  // ─── HTML ──────────────────────────────────────────────────────────────────

  private _html(): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <title>manan-kanchu</title>
  <style>${this._css()}</style>
</head>
<body>
${this._body()}
<script nonce="${nonce}">${this._js()}</script>
</body>
</html>`;
  }

  private _css(): string {
    return `
      :root {
        --bg0: #0d1117; --bg1: #161b22; --bg2: #21262d; --bg3: #30363d;
        --fg0: #e6edf3; --fg1: #8b949e; --fg2: #6e7681;
        --accent: #58a6ff; --accent2: #79c0ff;
        --green: #3fb950; --yellow: #d29922; --orange: #f0883e;
        --red: #ff4444; --purple: #bc8cff; --teal: #39d353;
        --critical: #ff4444; --high: #f0883e; --medium: #d29922; --low: #3fb950; --info: #58a6ff;
        --border: #30363d; --radius: 8px; --radius-sm: 4px;
        --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        --mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
        --transition: all 0.15s ease;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: var(--font); background: var(--bg0); color: var(--fg0); font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

      /* Header */
      .header { background: var(--bg1); border-bottom: 1px solid var(--border); padding: 0 16px; display: flex; align-items: center; gap: 12px; height: 48px; flex-shrink: 0; }
      .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--fg0); }
      .logo-icon { font-size: 18px; }
      .logo-sub { font-size: 11px; color: var(--fg1); font-weight: 400; }
      .provider-badge { background: var(--bg2); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; font-size: 11px; color: var(--fg1); cursor: pointer; transition: var(--transition); }
      .provider-badge:hover { border-color: var(--accent); color: var(--accent); }
      .header-actions { margin-left: auto; display: flex; gap: 8px; }
      .btn-icon { background: var(--bg2); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: var(--transition); }
      .btn-icon:hover { background: var(--bg3); border-color: var(--accent); }

      /* Tabs */
      .tabs { background: var(--bg1); border-bottom: 1px solid var(--border); display: flex; padding: 0 16px; flex-shrink: 0; }
      .tab { padding: 10px 16px; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--fg1); border-bottom: 2px solid transparent; transition: var(--transition); white-space: nowrap; }
      .tab:hover { color: var(--fg0); }
      .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

      /* Layout */
      .main { flex: 1; display: flex; overflow: hidden; }
      .sidebar { width: 280px; background: var(--bg1); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
      .content { flex: 1; overflow-y: auto; padding: 20px; }
      .tab-panel { display: none; }
      .tab-panel.active { display: block; }

      /* Sidebar */
      .sidebar-section { border-bottom: 1px solid var(--border); padding: 12px; }
      .sidebar-title { font-size: 11px; font-weight: 600; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
      .scan-btn { width: 100%; padding: 10px 12px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: var(--transition); display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .scan-btn.primary { background: var(--accent); color: #0d1117; }
      .scan-btn.primary:hover { background: var(--accent2); }
      .scan-btn.secondary { background: var(--bg2); color: var(--fg0); border: 1px solid var(--border); }
      .scan-btn.secondary:hover { background: var(--bg3); }
      .scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      /* Stat Cards */
      .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
      .stat-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
      .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
      .stat-label { font-size: 11px; color: var(--fg1); margin-top: 4px; font-weight: 500; }
      .stat-card.critical .stat-value { color: var(--critical); }
      .stat-card.high .stat-value { color: var(--high); }
      .stat-card.medium .stat-value { color: var(--medium); }
      .stat-card.ai .stat-value { color: var(--purple); }
      .stat-card.total .stat-value { color: var(--accent); }
      .stat-card.clean .stat-value { color: var(--green); }

      /* Progress bar */
      .progress-bar { height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; margin-top: 6px; }
      .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

      /* Severity badges */
      .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
      .badge.critical { background: rgba(255,68,68,0.15); color: var(--critical); }
      .badge.high { background: rgba(240,136,62,0.15); color: var(--high); }
      .badge.medium { background: rgba(210,153,34,0.15); color: var(--medium); }
      .badge.low { background: rgba(63,185,80,0.15); color: var(--low); }
      .badge.info { background: rgba(88,166,255,0.15); color: var(--info); }
      .badge.ai { background: rgba(188,140,255,0.15); color: var(--purple); }

      /* Findings */
      .finding-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; transition: var(--transition); cursor: pointer; }
      .finding-card:hover { border-color: var(--accent); }
      .finding-card.critical { border-left: 3px solid var(--critical); }
      .finding-card.high { border-left: 3px solid var(--high); }
      .finding-card.medium { border-left: 3px solid var(--medium); }
      .finding-card.low { border-left: 3px solid var(--low); }
      .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .finding-title { font-weight: 600; font-size: 13px; flex: 1; }
      .finding-meta { font-size: 11px; color: var(--fg1); display: flex; gap: 12px; margin-bottom: 8px; }
      .finding-snippet { background: var(--bg0); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; font-family: var(--mono); font-size: 11px; color: var(--fg1); overflow-x: auto; max-height: 60px; }
      .finding-rec { font-size: 12px; color: var(--fg1); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }

      /* File list */
      .file-list { display: flex; flex-direction: column; gap: 4px; }
      .file-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); }
      .file-item:hover { border-color: var(--accent); background: var(--bg2); }
      .file-name { flex: 1; font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .file-score { font-family: var(--mono); font-size: 11px; width: 48px; text-align: right; }

      /* AI Score bar */
      .ai-score-bar { display: flex; align-items: center; gap: 8px; }
      .ai-score-track { flex: 1; height: 4px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
      .ai-score-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green), var(--yellow), var(--red)); }

      /* Shell input */
      .shell-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .shell-input { flex: 1; background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--mono); font-size: 13px; outline: none; }
      .shell-input:focus { border-color: var(--accent); }
      .shell-result { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .shell-risk { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-weight: 600; }
      .shell-issues { display: flex; flex-direction: column; gap: 8px; }
      .shell-issue { padding: 8px 12px; background: var(--bg2); border-radius: var(--radius-sm); font-size: 12px; }
      .shell-suggestion { margin-top: 12px; padding: 10px 12px; background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.3); border-radius: var(--radius-sm); font-size: 12px; }
      .shell-alt { margin-top: 8px; font-family: var(--mono); font-size: 12px; color: var(--green); }

      /* Policy grid */
      .policy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
      .policy-card { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
      .policy-status { font-size: 16px; }
      .policy-name { font-weight: 600; font-size: 13px; }
      .policy-desc { font-size: 11px; color: var(--fg1); margin-top: 2px; }
      .policy-card.pass { border-left: 3px solid var(--green); }
      .policy-card.fail { border-left: 3px solid var(--red); }

      /* Section headers */
      .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .section-title { font-size: 15px; font-weight: 700; }
      .section-subtitle { font-size: 12px; color: var(--fg1); margin-top: 2px; }

      /* Empty state */
      .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; text-align: center; color: var(--fg1); }
      .empty-icon { font-size: 48px; }
      .empty-title { font-size: 16px; font-weight: 600; color: var(--fg0); }
      .empty-desc { font-size: 13px; max-width: 340px; line-height: 1.6; }

      /* Loading spinner */
      @keyframes spin { to { transform: rotate(360deg); } }
      .spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
      .loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; color: var(--fg1); }

      /* Score circle */
      .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; border: 3px solid; }
      .score-circle.low { border-color: var(--green); color: var(--green); }
      .score-circle.medium { border-color: var(--yellow); color: var(--yellow); }
      .score-circle.high { border-color: var(--high); color: var(--high); }
      .score-circle.critical { border-color: var(--critical); color: var(--critical); }

      /* Threshold control */
      .threshold-row { display: flex; align-items: center; gap: 12px; background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 16px; }
      .threshold-label { font-size: 12px; color: var(--fg1); min-width: 160px; }
      .threshold-value { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent); min-width: 40px; }
      input[type=range] { flex: 1; accent-color: var(--accent); }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: var(--bg0); }
      ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: var(--fg2); }

      /* Detail panel */
      .detail-panel { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-top: 16px; }
      .detail-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
      .detail-info { flex: 1; }
      .detail-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
      .detail-path { font-family: var(--mono); font-size: 11px; color: var(--fg1); }
      .metrics-row { display: flex; gap: 16px; margin-bottom: 14px; }
      .metric { display: flex; flex-direction: column; gap: 2px; }
      .metric-val { font-size: 20px; font-weight: 700; }
      .metric-label { font-size: 11px; color: var(--fg1); }
      .indicators-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .indicator-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
      .indicator-name { min-width: 160px; color: var(--fg1); }
      .indicator-bar { flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
      .indicator-fill { height: 100%; background: var(--accent); border-radius: 3px; }
      .indicator-score { font-family: var(--mono); font-size: 11px; min-width: 36px; text-align: right; }

      /* Sanitize button */
      .sanitize-btn { background: var(--bg2); border: 1px solid var(--accent); color: var(--accent); padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: var(--transition); }
      .sanitize-btn:hover { background: rgba(88,166,255,0.1); }
      .sanitized-code { background: var(--bg0); border: 1px solid var(--green); border-radius: var(--radius-sm); padding: 10px; font-family: var(--mono); font-size: 12px; color: var(--green); margin-top: 8px; white-space: pre-wrap; }

      /* Charts */
      .chart-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
      .chart-label { min-width: 100px; font-size: 12px; color: var(--fg1); }
      .chart-bar { flex: 1; height: 18px; background: var(--bg3); border-radius: var(--radius-sm); overflow: hidden; position: relative; }
      .chart-fill { height: 100%; border-radius: var(--radius-sm); }
      .chart-count { font-size: 12px; font-family: var(--mono); min-width: 30px; text-align: right; }

      /* Tabs sidebar scrollable */
      .sidebar-files { flex: 1; overflow-y: auto; padding: 8px; }
      .notification { position: fixed; bottom: 16px; right: 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; z-index: 999; opacity: 0; transition: opacity 0.3s; }
      .notification.show { opacity: 1; }
      .notification.success { border-left: 3px solid var(--green); }
      .notification.error { border-left: 3px solid var(--critical); }

      /* Diff view */
      .sanitized-diff { margin-top: 10px; }
      .diff-view { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .diff-section { border-radius: var(--radius-sm); overflow: hidden; }
      .diff-label { padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
      .diff-before .diff-label { background: rgba(255,68,68,0.15); color: var(--critical); }
      .diff-after .diff-label { background: rgba(63,185,80,0.15); color: var(--green); }
      .diff-code { background: var(--bg0); border: 1px solid var(--border); padding: 8px 10px; font-family: var(--mono); font-size: 11px; color: var(--fg1); white-space: pre-wrap; overflow-x: auto; max-height: 200px; overflow-y: auto; margin: 0; }
      .diff-before .diff-code { border-color: rgba(255,68,68,0.3); }
      .diff-after .diff-code { border-color: rgba(63,185,80,0.3); color: var(--green); }
      /* False positive */
      .finding-card.fp-marked { opacity: 0.45; }
      .fp-btn { background: var(--bg2); border: 1px solid var(--border); color: var(--fg1); padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; transition: var(--transition); }
      .fp-btn:hover { border-color: var(--yellow); color: var(--yellow); }
      .fp-btn.marked { background: rgba(210,153,34,0.1); border-color: var(--yellow); color: var(--yellow); }
      /* AI Evidence */
      .evidence-panel { background: var(--bg0); border: 1px solid rgba(188,140,255,0.3); border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 8px; }
      .evidence-title { font-size: 11px; font-weight: 600; color: var(--purple); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
      .evidence-reason { font-size: 12px; color: var(--fg1); margin-bottom: 8px; font-style: italic; padding: 6px 8px; background: var(--bg1); border-radius: var(--radius-sm); border-left: 2px solid var(--purple); }
      .evidence-btn { background: none; border: 1px solid rgba(188,140,255,0.4); color: var(--purple); padding: 3px 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; transition: var(--transition); }
      .evidence-btn:hover { background: rgba(188,140,255,0.1); }
      /* Search */
      .search-input { background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 12px; outline: none; width: 180px; }
      .search-input:focus { border-color: var(--accent); }
      .search-input::placeholder { color: var(--fg2); }
      .fp-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fg1); cursor: pointer; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg1); white-space: nowrap; }
      .fp-toggle:hover { border-color: var(--yellow); color: var(--yellow); }
      .fp-toggle.active { border-color: var(--yellow); color: var(--yellow); background: rgba(210,153,34,0.1); }

      /* ── Animations ─────────────────────────────────────────────────────────── */
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes slideInDown { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 12px 2px rgba(88,166,255,0.25); } }
      @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      .finding-card { animation: slideInDown 0.18s ease both; }
      .tab-panel.active { animation: fadeIn 0.18s ease; }
      .scan-btn:not(:disabled) { transition: all 0.15s ease; }
      .scan-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
      .scan-btn:not(:disabled):active { transform: translateY(0); box-shadow: none; }
      .score-circle.scanning { animation: pulse-glow 1.4s ease-in-out infinite; }

      /* ── Skeleton ───────────────────────────────────────────────────────────── */
      .skeleton { background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: var(--radius-sm); }
      .skeleton-line { height: 12px; margin-bottom: 8px; border-radius: 6px; }
      .skeleton-card { height: 90px; margin-bottom: 10px; border-radius: var(--radius); }

      /* ── Copy button on snippets ────────────────────────────────────────────── */
      .snippet-wrap { position: relative; }
      .copy-btn { position: absolute; top: 4px; right: 4px; background: var(--bg2); border: 1px solid var(--border); color: var(--fg1); padding: 2px 7px; border-radius: var(--radius-sm); cursor: pointer; font-size: 10px; opacity: 0; transition: opacity 0.15s, color 0.15s; }
      .snippet-wrap:hover .copy-btn { opacity: 1; }
      .copy-btn:hover { color: var(--accent); border-color: var(--accent); }
      .copy-btn.copied { color: var(--green); border-color: var(--green); opacity: 1; }

      /* ── Modal overlay ──────────────────────────────────────────────────────── */
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
      .modal-box { background: var(--bg1); border: 1px solid var(--border); border-radius: 12px; width: 700px; max-width: 96vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,0.6); animation: slideUp 0.2s cubic-bezier(0.16,1,0.3,1); }
      .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
      .modal-title { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
      .modal-close { background: none; border: none; color: var(--fg1); cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 8px; border-radius: var(--radius-sm); transition: var(--transition); }
      .modal-close:hover { background: var(--bg3); color: var(--fg0); }
      .modal-search-wrap { padding: 12px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
      .modal-search-input { width: 100%; background: var(--bg0); border: 1px solid var(--border); color: var(--fg0); padding: 9px 14px; border-radius: var(--radius-sm); font-size: 13px; font-family: var(--mono); outline: none; transition: border-color 0.15s; }
      .modal-search-input:focus { border-color: var(--accent); }
      .modal-search-input::placeholder { color: var(--fg2); }
      .modal-stats { padding: 6px 20px; font-size: 11px; color: var(--fg2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
      .modal-file-list { overflow-y: auto; flex: 1; min-height: 180px; }
      .modal-file-item { display: flex; align-items: center; gap: 10px; padding: 9px 20px; cursor: pointer; transition: background 0.1s; border-left: 2px solid transparent; }
      .modal-file-item:hover { background: var(--bg2); }
      .modal-file-item.selected { background: rgba(88,166,255,0.08); border-left-color: var(--accent); }
      .modal-file-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
      .modal-file-name { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--fg0); white-space: nowrap; }
      .modal-file-path { font-size: 11px; color: var(--fg2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
      .modal-empty { padding: 40px 20px; text-align: center; color: var(--fg2); font-size: 12px; }

      /* ── Region selector ────────────────────────────────────────────────────── */
      .region-selector { border-top: 1px solid var(--border); padding: 16px 20px; background: var(--bg0); flex-shrink: 0; animation: slideInDown 0.18s ease; }
      .region-title { font-size: 12px; color: var(--fg1); margin-bottom: 4px; }
      .region-title strong { color: var(--accent); font-family: var(--mono); font-weight: 600; }
      .region-meta { font-size: 11px; color: var(--fg2); margin-bottom: 12px; }
      .region-controls { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
      .region-input-group { display: flex; align-items: center; gap: 8px; }
      .region-input-group label { font-size: 12px; color: var(--fg1); white-space: nowrap; }
      .region-input { background: var(--bg1); border: 1px solid var(--border); color: var(--fg0); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 13px; font-family: var(--mono); width: 76px; outline: none; transition: border-color 0.15s; }
      .region-input:focus { border-color: var(--accent); }
      .region-preview-box { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--mono); font-size: 11px; overflow-y: auto; max-height: 160px; margin-bottom: 12px; }
      .region-line { display: flex; padding: 1px 0; }
      .region-line.in-range { background: rgba(88,166,255,0.1); }
      .region-line-num { color: var(--fg2); min-width: 38px; text-align: right; padding: 0 10px; user-select: none; flex-shrink: 0; }
      .region-line-text { color: var(--fg1); overflow: hidden; text-overflow: ellipsis; white-space: pre; padding-right: 8px; }
      .region-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .select-all-btn { background: none; border: 1px solid var(--border); color: var(--fg1); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; transition: var(--transition); }
      .select-all-btn:hover { border-color: var(--accent); color: var(--accent); }

      /* ── Browse button badge ────────────────────────────────────────────────── */
      .scan-btn.browse { background: var(--bg2); border: 1px solid var(--purple); color: var(--purple); }
      .scan-btn.browse:hover { background: rgba(188,140,255,0.1); }
    `;
  }

  private _body(): string {
    return `
  <div class="header">
    <div class="logo">
      <span class="logo-icon">🔍</span>
      <div>
        <div>manan-kanchu</div>
        <div class="logo-sub">AI Code Detector</div>
      </div>
    </div>
    <div id="providerBadge" class="provider-badge">⚡ No provider</div>
    <div class="header-actions">
      <button class="btn-icon" id="btnHeaderScanFile">📄 Scan File</button>
      <button class="btn-icon" id="btnHeaderExport">📊 Export</button>
      <button class="btn-icon" id="btnHeaderSettings">⚙️</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="dashboard">Dashboard</div>
    <div class="tab" data-tab="findings">Findings</div>
    <div class="tab" data-tab="files">Files</div>
    <div class="tab" data-tab="shell">Shell</div>
    <div class="tab" data-tab="policies">Policies</div>
    <div class="tab" data-tab="settings">Settings</div>
  </div>

  <div class="main">
    <div class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">Scan Actions</div>
        <button class="scan-btn primary" id="btnScanProject">
          🔎 Scan Project
        </button>
        <button class="scan-btn secondary" id="btnScanFile">
          📄 Scan Current File
        </button>
        <button class="scan-btn secondary" id="btnScanSelection">
          ✂️ Scan Selection
        </button>
        <button class="scan-btn browse" id="btnBrowseFiles">
          📂 Browse &amp; Select File
        </button>
      </div>
      <div class="sidebar-section" id="scanProgress" style="display:none">
        <div class="sidebar-title">Scanning…</div>
        <div style="display:flex;align-items:center;gap:8px;"><div class="spinner"></div><span id="scanProgressText" style="font-size:12px;color:var(--fg1)">Analyzing files…</span></div>
        <div class="progress-bar" style="margin-top:10px;"><div class="progress-fill" id="progressFill" style="width:0%;background:var(--accent);"></div></div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-title">AI Detection Score</div>
        <div id="sidebarAiScore" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;">
          <div class="score-circle low" id="scoreCircle">
            <div id="scoreVal" style="font-size:20px;">—</div>
            <div style="font-size:10px;opacity:0.7;">AI Score</div>
          </div>
          <div style="font-size:11px;color:var(--fg1);text-align:center;" id="scoreLabel">Run a scan to see results</div>
        </div>
      </div>
      <div class="sidebar-files" id="sidebarFiles">
        <div class="sidebar-title" style="padding:4px 0;">File Results</div>
        <div id="fileListSidebar" style="font-size:12px;color:var(--fg1);">No files scanned</div>
      </div>
    </div>

    <div class="content">
      <!-- Dashboard Tab -->
      <div class="tab-panel active" id="tab-dashboard">
        <div id="dashboardEmpty" class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">manan-kanchu — AI Code Detector</div>
          <div class="empty-desc">7-signal hybrid analysis with explainable scores. Not a black-box number — every flag comes with evidence you can verify.</div>
          <div style="display:flex;gap:24px;justify-content:center;margin:4px 0 8px;font-size:12px;color:var(--fg1);">
            <span>🤖 AI authorship detection</span>
            <span>🛡️ OWASP scanning</span>
            <span>🔒 100% offline via Ollama</span>
          </div>
          <button class="scan-btn primary" style="width:200px;" id="btnDashboardStartScan">🔎 Start Project Scan</button>
        </div>
        <div id="dashboardResults" style="display:none;">
          <div class="section-header">
            <div>
              <div class="section-title">Scan Summary</div>
              <div class="section-subtitle" id="dashSubtitle">—</div>
            </div>
            <button class="btn-icon" id="btnGenerateReport">📊 Generate Report</button>
          </div>
          <div class="stats-grid">
            <div class="stat-card total"><div class="stat-value" id="statTotal">0</div><div class="stat-label">Total Findings</div></div>
            <div class="stat-card ai"><div class="stat-value" id="statAI">0%</div><div class="stat-label">Avg AI Score</div></div>
            <div class="stat-card critical"><div class="stat-value" id="statCritical">0</div><div class="stat-label">Critical</div></div>
            <div class="stat-card high"><div class="stat-value" id="statHigh">0</div><div class="stat-label">High</div></div>
            <div class="stat-card medium"><div class="stat-value" id="statMedium">0</div><div class="stat-label">Medium</div></div>
            <div class="stat-card clean"><div class="stat-value" id="statFiles">0</div><div class="stat-label">Files Scanned</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div class="detail-panel" style="margin-top:0;">
              <div class="sidebar-title" style="margin-bottom:10px;">Findings by Category</div>
              <div id="categoryChart"></div>
            </div>
            <div class="detail-panel" style="margin-top:0;">
              <div class="sidebar-title" style="margin-bottom:10px;">Severity Distribution</div>
              <div id="severityChart"></div>
            </div>
          </div>
          <div class="section-header"><div class="section-title">Top Findings</div></div>
          <div id="topFindings"></div>
        </div>
      </div>

      <!-- Findings Tab -->
      <div class="tab-panel" id="tab-findings">
        <div id="findingsEmpty" class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-title">No Findings Yet</div>
          <div class="empty-desc">Run a scan to see detailed security findings, AI detection results, and policy violations.</div>
        </div>
        <div id="findingsContent" style="display:none;">
          <div class="section-header" style="align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div class="section-title">All Findings <span id="findingsCount" style="font-size:13px;color:var(--fg1);font-weight:400;"></span></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input class="search-input" id="findingsSearch" placeholder="Search findings…" title="Search by title, file, description, snippet">
              <select id="findingsFilter" style="background:var(--bg1);color:var(--fg0);border:1px solid var(--border);padding:4px 8px;border-radius:var(--radius-sm);font-size:12px;">
                <option value="all">All Categories</option>
                <option value="ai-generated">AI Generated</option>
                <option value="vulnerability">Vulnerabilities</option>
                <option value="malicious">Malicious</option>
                <option value="policy-violation">Policy</option>
                <option value="secret-exposure">Secrets</option>
              </select>
              <select id="severityFilter" style="background:var(--bg1);color:var(--fg0);border:1px solid var(--border);padding:4px 8px;border-radius:var(--radius-sm);font-size:12px;">
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button class="fp-toggle" id="fpToggle" title="Show/hide false positives">⚑ FP: <span id="fpCount">0</span></button>
            </div>
          </div>
          <div id="findingsList"></div>
        </div>
      </div>

      <!-- Files Tab -->
      <div class="tab-panel" id="tab-files">
        <div id="filesEmpty" class="empty-state">
          <div class="empty-icon">📁</div>
          <div class="empty-title">No Files Analyzed</div>
          <div class="empty-desc">Run a project scan to see per-file AI detection scores and findings.</div>
        </div>
        <div id="filesContent" style="display:none;">
          <div class="section-header">
            <div class="section-title">File Analysis</div>
            <div style="font-size:12px;color:var(--fg1);">Click a file to see detailed analysis</div>
          </div>
          <div id="fileTable"></div>
          <div id="fileDetailPanel" style="display:none;"></div>
        </div>
      </div>

      <!-- Shell Tab -->
      <div class="tab-panel" id="tab-shell">
        <div class="section-header">
          <div>
            <div class="section-title">Shell Command Analyzer</div>
            <div class="section-subtitle">Analyze shell commands for security risks and get safer alternatives</div>
          </div>
        </div>
        <div class="shell-input-row">
          <input class="shell-input" id="shellInput" placeholder="Enter shell command to analyze...">
          <button class="scan-btn primary" style="width:120px;margin:0;" id="btnShellAnalyze">🔍 Analyze</button>
        </div>
        <div id="shellResult" style="display:none;"></div>
        <div class="section-header" style="margin-top:24px;"><div class="section-title">Common Risky Patterns</div></div>
        <div class="policy-grid" id="shellExamples"></div>
      </div>

      <!-- Policies Tab -->
      <div class="tab-panel" id="tab-policies">
        <div class="section-header">
          <div class="section-title">Policy Evaluation</div>
          <div class="section-subtitle">Compliance rules applied during code analysis</div>
        </div>
        <div id="policySummary"></div>
        <div id="policyGrid" class="policy-grid"></div>
      </div>

      <!-- Settings Tab -->
      <div class="tab-panel" id="tab-settings">
        <div class="section-header"><div class="section-title">Detection Settings</div></div>
        <div class="detail-panel" style="margin-top:0;margin-bottom:16px;">
          <div class="threshold-row" style="background:transparent;border:none;padding:0;margin-bottom:12px;">
            <div class="threshold-label">AI Detection Threshold</div>
            <input type="range" min="0" max="100" value="65" id="thresholdSlider">
            <div class="threshold-value" id="thresholdDisplay">0.65</div>
          </div>
          <div style="font-size:12px;color:var(--fg1);">Files scoring above this threshold are flagged as AI-generated. Higher = stricter detection.</div>
        </div>
        <div class="section-header"><div class="section-title">AI Providers</div></div>
        <div id="providersGrid"></div>
        <div class="section-header" style="margin-top:20px;"><div class="section-title">About</div></div>
        <div class="detail-panel" style="margin-top:0;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <span style="font-size:32px;">🔍</span>
            <div>
              <div style="font-size:16px;font-weight:700;">manan-kanchu AI Code Detector</div>
              <div style="font-size:12px;color:var(--fg1);">v1.0.0 — MIT License</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--fg1);line-height:1.7;">
            <p><strong style="color:var(--fg0);">manan-kanchu</strong> (mah-nan-KAHN-chu) is Quechua for <em>"there isn't"</em> — detecting what doesn't belong: AI-generated code masquerading as human work.</p>
            <br>
            <p style="color:var(--fg0);font-weight:600;margin-bottom:4px;">What makes it different:</p>
            <p>• <strong style="color:var(--fg0);">Explainable scores</strong> — 7 independent signals (entropy, comment patterns, structural uniformity, identifier vocabulary) combined with AI semantic analysis. Every flag shows why, not just a number.</p>
            <p style="margin-top:4px;">• <strong style="color:var(--fg0);">100% offline</strong> — Ollama and LM Studio keep your code on-device. No manan-kanchu servers, ever.</p>
            <p style="margin-top:4px;">• <strong style="color:var(--fg0);">One panel</strong> — AI authorship detection, OWASP vulnerability scanning, malicious code detection, policy compliance, and shell command analysis in a single workflow.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="notification" id="notification"></div>

  <!-- File Browser Modal -->
  <div class="modal-overlay" id="fileBrowserModal" style="display:none;">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">📂 Browse Workspace Files</div>
        <button class="modal-close" id="fileBrowserClose">✕</button>
      </div>
      <div class="modal-search-wrap">
        <input class="modal-search-input" id="fileSearchInput" placeholder="🔍 Filter by name or path…" autocomplete="off" spellcheck="false">
      </div>
      <div class="modal-stats" id="fileListStats"></div>
      <div class="modal-file-list" id="modalFileList">
        <div class="modal-empty">Loading workspace files…</div>
      </div>
      <div class="region-selector" id="regionSelector" style="display:none;">
        <div class="region-title">Selected: <strong id="regionFilePath"></strong></div>
        <div class="region-meta" id="regionMeta">—</div>
        <div class="region-controls">
          <div class="region-input-group">
            <label>From line</label>
            <input type="number" class="region-input" id="regionStart" min="1" value="1">
          </div>
          <span style="color:var(--fg2);">–</span>
          <div class="region-input-group">
            <label>To line</label>
            <input type="number" class="region-input" id="regionEnd" min="1" value="50">
          </div>
          <button class="select-all-btn" id="btnSelectAll">All lines</button>
        </div>
        <div class="region-preview-box" id="regionPreviewBox"></div>
        <div class="region-actions">
          <button class="scan-btn primary" id="btnScanRegion" style="width:auto;margin:0;">🔍 Analyze Region</button>
          <button class="scan-btn secondary" id="btnScanFullFile" style="width:auto;margin:0;">📄 Analyze Full File</button>
        </div>
      </div>
    </div>
  </div>
`;
  }

  private _js(): string {
    return `
(function() {
  const vscode = acquireVsCodeApi();

  // State
  const S = {
    tab: 'dashboard',
    summary: null,
    fileResult: null,
    allFindings: [],
    scanBusy: false,
    threshold: 0.65,
    provider: null,
    falsePositives: new Set(),
    sanitizedResults: {},
    showFalsePositives: false,
    workspaceFiles: [],
    selectedFile: null,
    filePreviewLines: [],
    filePreviewTotal: 0,
  };

  // Tab switching
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      S.tab = tab;
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + tab));
    });
  });

  // ─── Window message handler ────────────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data;
    switch (msg.type) {
      case 'provider-info': onProviderInfo(msg.provider); break;
      case 'scan-started': onScanStarted(msg.target); break;
      case 'scan-file-result': onFileScanResult(msg.result); break;
      case 'scan-project-result': onProjectScanResult(msg.summary); break;
      case 'scan-error': onScanError(msg.message); break;
      case 'scan-busy': showNotif('Scan already in progress…', 'error'); break;
      case 'shell-result': renderShellResult(msg.analysis); break;
      case 'report-ready': showNotif('Report generated! Opening…', 'success'); break;
      case 'report-error': showNotif(msg.message, 'error'); break;
      case 'sanitize-result': onSanitizeResult(msg.result); break;
      case 'sanitize-error': showNotif(msg.message, 'error'); break;
      case 'findings-cleared': onFindingsCleared(); break;
      case 'threshold-updated': S.threshold = msg.value; break;
      case 'scan-history': onScanHistory(msg.summary, msg.fileResult); break;
      case 'workspace-files': onWorkspaceFiles(msg.files); break;
      case 'file-preview': onFilePreview(msg.filePath, msg.lines, msg.total); break;
      case 'file-preview-error': showNotif(msg.message, 'error'); break;
    }
  });

  // ─── Actions ───────────────────────────────────────────────────────────────
  window.scanProject = () => { vscode.postMessage({ type: 'scan-project' }); };
  window.scanCurrentFile = () => { vscode.postMessage({ type: 'scan-file' }); };
  window.scanSelection = () => { vscode.postMessage({ type: 'scan-selection' }); };
  window.configureProvider = () => { vscode.postMessage({ type: 'configure-provider' }); };
  window.generateReport = () => { vscode.postMessage({ type: 'generate-report', format: 'markdown' }); };
  window.exportReport = () => { vscode.postMessage({ type: 'export-report' }); };
  window.analyzeShell = () => {
    const cmd = document.getElementById('shellInput').value.trim();
    if (!cmd) return;
    vscode.postMessage({ type: 'scan-shell', command: cmd });
  };
  window.filterFindings = () => { renderFindingsList(); };
  window.updateThreshold = (val) => {
    const v = val / 100;
    document.getElementById('thresholdDisplay').textContent = v.toFixed(2);
    S.threshold = v;
    vscode.postMessage({ type: 'update-threshold', value: v });
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────
  function onProviderInfo(provider) {
    S.provider = provider;
    const badge = document.getElementById('providerBadge');
    if (provider) {
      badge.textContent = '⚡ ' + provider.name;
      badge.style.borderColor = 'var(--green)';
      badge.style.color = 'var(--green)';
    } else {
      badge.textContent = '⚡ No provider';
      badge.style.borderColor = 'var(--border)';
      badge.style.color = 'var(--fg1)';
    }
    renderProvidersGrid(provider);
  }

  function onScanStarted(target) {
    S.scanBusy = true;
    document.getElementById('scanProgress').style.display = 'block';
    document.getElementById('btnScanProject').disabled = true;
    document.getElementById('scanProgressText').textContent = target === 'project' ? 'Scanning project files…' : 'Analyzing file…';
    document.getElementById('scoreCircle').classList.add('scanning');
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + Math.random() * 5, 90);
      document.getElementById('progressFill').style.width = progress + '%';
      if (!S.scanBusy) { clearInterval(timer); document.getElementById('progressFill').style.width = '100%'; }
    }, 200);
  }

  function onFileScanResult(result) {
    S.scanBusy = false;
    S.fileResult = result;
    S.allFindings = result.findings;
    hideScanProgress();
    updateScoreCircle(result.aiScore);
    renderFileDetail(result);
    renderFindingsList();
    switchTab('findings');
    showNotif('File analysis complete', 'success');
  }

  function onProjectScanResult(summary) {
    S.scanBusy = false;
    S.summary = summary;
    S.allFindings = summary.fileResults.flatMap(r => r.findings);
    hideScanProgress();
    updateScoreCircle(summary.averageAiScore);
    renderDashboard(summary);
    renderFilesTab(summary.fileResults);
    renderFindingsList();
    renderPoliciesTab(summary);
    renderSidebarFiles(summary.fileResults);
    switchTab('dashboard');
    showNotif('Project scan complete: ' + summary.filesScanned + ' files analyzed', 'success');
  }

  function onScanError(message) {
    S.scanBusy = false;
    hideScanProgress();
    showNotif(message || 'Scan failed', 'error');
  }

  function onFindingsCleared() {
    S.summary = null;
    S.fileResult = null;
    S.allFindings = [];
    S.falsePositives.clear();
    S.sanitizedResults = {};
    S.showFalsePositives = false;
    document.getElementById('dashboardEmpty').style.display = 'flex';
    document.getElementById('dashboardResults').style.display = 'none';
    document.getElementById('findingsEmpty').style.display = 'flex';
    document.getElementById('findingsContent').style.display = 'none';
    showNotif('Findings cleared', 'success');
  }

  function onScanHistory(summary, fileResult) {
    if (summary) onProjectScanResult(summary);
    else if (fileResult) onFileScanResult(fileResult);
  }

  function onSanitizeResult(result) {
    const { sanitizedCode, originalFinding } = result;
    S.sanitizedResults[originalFinding.id] = { before: originalFinding.snippet, after: sanitizedCode };
    renderFindingsList();
    showNotif('Fix ready — review the Before/After diff below', 'success');
  }

  // ─── Renderers ─────────────────────────────────────────────────────────────
  function renderDashboard(summary) {
    document.getElementById('dashboardEmpty').style.display = 'none';
    document.getElementById('dashboardResults').style.display = 'block';
    document.getElementById('dashSubtitle').textContent =
      summary.filesScanned + ' files · ' + (summary.scanDurationMs/1000).toFixed(1) + 's · ' + new Date(summary.completedAt).toLocaleTimeString();
    document.getElementById('statTotal').textContent = summary.totalFindings;
    document.getElementById('statAI').textContent = (summary.averageAiScore * 100).toFixed(0) + '%';
    document.getElementById('statCritical').textContent = summary.criticalCount;
    document.getElementById('statHigh').textContent = summary.highCount;
    document.getElementById('statMedium').textContent = summary.mediumCount;
    document.getElementById('statFiles').textContent = summary.filesScanned;

    // Category chart
    const cats = {};
    summary.fileResults.flatMap(r => r.findings).forEach(f => {
      cats[f.category] = (cats[f.category] || 0) + 1;
    });
    const maxCat = Math.max(...Object.values(cats), 1);
    document.getElementById('categoryChart').innerHTML = Object.entries(cats).map(([cat, count]) =>
      '<div class="chart-row">' +
      '<div class="chart-label">' + cat.replace('-', ' ') + '</div>' +
      '<div class="chart-bar"><div class="chart-fill" style="width:' + (count/maxCat*100) + '%;background:var(--accent);"></div></div>' +
      '<div class="chart-count">' + count + '</div></div>'
    ).join('');

    // Severity chart
    const sevs = [
      { label: 'Critical', key: 'criticalCount', color: 'var(--critical)' },
      { label: 'High', key: 'highCount', color: 'var(--high)' },
      { label: 'Medium', key: 'mediumCount', color: 'var(--medium)' },
      { label: 'Low', key: 'lowCount', color: 'var(--low)' },
    ];
    const maxSev = Math.max(...sevs.map(s => summary[s.key]), 1);
    document.getElementById('severityChart').innerHTML = sevs.map(s =>
      '<div class="chart-row">' +
      '<div class="chart-label">' + s.label + '</div>' +
      '<div class="chart-bar"><div class="chart-fill" style="width:' + (summary[s.key]/maxSev*100) + '%;background:' + s.color + ';"></div></div>' +
      '<div class="chart-count">' + summary[s.key] + '</div></div>'
    ).join('');

    // Top findings
    document.getElementById('topFindings').innerHTML = summary.topFindings.slice(0, 5).map(f => renderFindingCard(f)).join('');
  }

  function renderFindingCard(f) {
    const isFP = S.falsePositives.has(f.id);
    const fpClass = isFP ? ' fp-marked' : '';

    // AI evidence panel (hidden by default, toggled via button)
    let evidenceHtml = '';
    if (f.category === 'ai-generated' && f.indicators && f.indicators.length) {
      const rows = f.indicators.map(ind =>
        '<div class="indicator-row">' +
          '<div class="indicator-name" style="min-width:130px;">' + esc(ind.type.replace(/-/g,' ')) + '</div>' +
          '<div class="indicator-bar"><div class="indicator-fill" style="width:' + (ind.score * 100).toFixed(0) + '%;background:' + (ind.score > 0.7 ? 'var(--red)' : ind.score > 0.4 ? 'var(--yellow)' : 'var(--green)') + ';"></div></div>' +
          '<div class="indicator-score">' + (ind.score * 100).toFixed(0) + '%</div>' +
          '<div style="flex:2;font-size:11px;color:var(--fg2);padding-left:8px;overflow:hidden;">' + esc(ind.description) + '</div>' +
        '</div>'
      ).join('');
      evidenceHtml =
        '<div class="evidence-panel" id="ev-' + f.id + '">' +
          '<div class="evidence-title">🔬 AI Detection Evidence</div>' +
          (f.aiReason ? '<div class="evidence-reason">' + esc(f.aiReason) + '</div>' : '') +
          '<div class="indicators-list" style="margin-bottom:0;">' + rows + '</div>' +
        '</div>';
    }

    // Before/After diff if fix was generated
    const diff = S.sanitizedResults[f.id];
    const diffHtml = diff
      ? '<div class="sanitized-diff">' +
          '<div style="font-size:11px;font-weight:600;color:var(--fg1);margin:8px 0 6px;">✨ Suggested Fix</div>' +
          '<div class="diff-view">' +
            '<div class="diff-section diff-before"><div class="diff-label">Before</div><pre class="diff-code">' + esc(diff.before) + '</pre></div>' +
            '<div class="diff-section diff-after"><div class="diff-label">After</div><pre class="diff-code">' + esc(diff.after) + '</pre></div>' +
          '</div>' +
        '</div>'
      : '';

    return '<div class="finding-card ' + f.severity + fpClass + '" data-finding-id="' + f.id + '">' +
      '<div class="finding-header">' +
        '<span class="badge ' + f.category.replace(/-/g,'') + '">' + f.category.replace(/-/g,' ') + '</span>' +
        '<span class="finding-title">' + esc(f.title) + '</span>' +
        '<span class="badge ' + f.severity + '">' + f.severity + '</span>' +
        (isFP ? '<span class="badge medium" style="opacity:0.8;font-size:10px;">FP</span>' : '') +
      '</div>' +
      '<div class="finding-meta">' +
        '<span>📄 ' + esc(f.filePath.split('/').pop() || f.filePath) + ':' + f.startLine + '</span>' +
        '<span>🎯 ' + (f.confidence * 100).toFixed(0) + '% confidence</span>' +
        (f.cveId ? '<span>🏷️ ' + esc(f.cveId) + '</span>' : '') +
      '</div>' +
      '<div class="snippet-wrap">' +
        '<div class="finding-snippet">' + esc(f.snippet) + '</div>' +
        '<button class="copy-btn" data-action="copy-snippet" data-snippet="' + esc(f.snippet) + '">Copy</button>' +
      '</div>' +
      (f.recommendation ? '<div class="finding-rec">💡 ' + esc(f.recommendation) + '</div>' : '') +
      evidenceHtml +
      diffHtml +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button class="sanitize-btn" data-action="sanitize" data-finding-id="' + f.id + '">✨ Auto-fix</button>' +
        (f.category === 'ai-generated' && f.indicators && f.indicators.length ? '<button class="evidence-btn" data-action="toggle-evidence" data-finding-id="' + f.id + '">🔬 Evidence</button>' : '') +
        '<button class="fp-btn' + (isFP ? ' marked' : '') + '" data-action="mark-fp" data-finding-id="' + f.id + '">' + (isFP ? '✓ Marked FP' : '⚑ False Positive') + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderFindingsList() {
    const catFilter = document.getElementById('findingsFilter') ? document.getElementById('findingsFilter').value : 'all';
    const sevFilter = document.getElementById('severityFilter') ? document.getElementById('severityFilter').value : 'all';
    const search = ((document.getElementById('findingsSearch') || {}).value || '').toLowerCase().trim();
    const fpCount = S.falsePositives.size;
    const fpCountEl = document.getElementById('fpCount');
    if (fpCountEl) fpCountEl.textContent = fpCount;
    const fpToggleEl = document.getElementById('fpToggle');
    if (fpToggleEl) fpToggleEl.classList.toggle('active', S.showFalsePositives);

    if (S.allFindings.length === 0) {
      document.getElementById('findingsEmpty').style.display = 'flex';
      document.getElementById('findingsContent').style.display = 'none';
      return;
    }

    const filtered = S.allFindings.filter(f => {
      if (!S.showFalsePositives && S.falsePositives.has(f.id)) return false;
      if (catFilter !== 'all' && f.category !== catFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (search) {
        const hay = ((f.title || '') + ' ' + (f.description || '') + ' ' + (f.filePath || '') + ' ' + (f.recommendation || '') + ' ' + (f.snippet || '')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    document.getElementById('findingsEmpty').style.display = 'none';
    document.getElementById('findingsContent').style.display = 'block';
    const visibleTotal = S.allFindings.length - (S.showFalsePositives ? 0 : fpCount);
    const fpNote = fpCount > 0 && !S.showFalsePositives ? ', ' + fpCount + ' FP hidden' : '';
    document.getElementById('findingsCount').textContent = '(' + filtered.length + ' of ' + visibleTotal + fpNote + ')';
    document.getElementById('findingsList').innerHTML = filtered.map(renderFindingCard).join('');
  }

  window.sanitizeFinding = (findingId) => {
    const f = S.allFindings.find(x => x.id === findingId);
    if (!f) return;
    vscode.postMessage({ type: 'sanitize-finding', finding: f, code: '' });
  };

  window.markFalsePositive = (findingId) => {
    if (S.falsePositives.has(findingId)) {
      S.falsePositives.delete(findingId);
      showNotif('False positive unmarked', 'success');
    } else {
      S.falsePositives.add(findingId);
      showNotif('Marked as false positive — excluded from results', 'success');
    }
    renderFindingsList();
  };

  window.toggleEvidence = (findingId) => {
    const panel = document.getElementById('ev-' + findingId);
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };

  window.toggleFPView = () => {
    S.showFalsePositives = !S.showFalsePositives;
    renderFindingsList();
  };

  // ─── File Browser ──────────────────────────────────────────────────────────
  window.openFileBrowser = () => {
    S.selectedFile = null;
    document.getElementById('regionSelector').style.display = 'none';
    document.getElementById('modalFileList').innerHTML = '<div class="modal-empty">Loading workspace files…</div>';
    document.getElementById('fileSearchInput').value = '';
    document.getElementById('fileBrowserModal').style.display = 'flex';
    vscode.postMessage({ type: 'list-workspace-files', query: '' });
  };

  window.closeFileBrowser = () => {
    document.getElementById('fileBrowserModal').style.display = 'none';
  };

  function onWorkspaceFiles(files) {
    S.workspaceFiles = files || [];
    renderModalFileList(S.workspaceFiles);
  }

  function renderModalFileList(files) {
    const stats = document.getElementById('fileListStats');
    if (stats) stats.textContent = files.length ? files.length + ' file' + (files.length !== 1 ? 's' : '') + ' — click to select' : '';
    const el = document.getElementById('modalFileList');
    if (!files.length) {
      el.innerHTML = '<div class="modal-empty">No matching files found</div>';
      return;
    }
    el.innerHTML = files.map(f => {
      const isSelected = S.selectedFile && S.selectedFile.path === f.path;
      const dir = f.relativePath.includes('/') ? f.relativePath.substring(0, f.relativePath.lastIndexOf('/')) : '';
      return '<div class="modal-file-item' + (isSelected ? ' selected' : '') + '" data-action="pick-file"' +
        ' data-path="' + esc(f.path) + '" data-relpath="' + esc(f.relativePath) + '"' +
        ' data-name="' + esc(f.name) + '" data-ext="' + esc(f.ext) + '">' +
        '<div class="modal-file-icon">' + extIcon(f.ext) + '</div>' +
        '<div style="flex:1;overflow:hidden;">' +
          '<div class="modal-file-name">' + esc(f.name) + '</div>' +
          (dir ? '<div class="modal-file-path">' + esc(dir) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function extIcon(ext) {
    const m = { ts:'🔷',tsx:'🔷',js:'🟨',jsx:'🟨',py:'🐍',java:'☕',cs:'🟦',go:'🐹',rs:'🦀',rb:'💎',html:'🌐',css:'🎨',scss:'🎨',sh:'⚙️',sql:'🗄️',vue:'💚',svelte:'🧡',kt:'🟣',swift:'🟠',cpp:'🔵',c:'🔵',h:'🔵',php:'🐘' };
    return m[ext] || '📄';
  }

  function pickFile(filePath, relativePath, name, ext) {
    S.selectedFile = { path: filePath, relativePath, name, ext };
    renderModalFileList(S.workspaceFiles);
    document.getElementById('regionFilePath').textContent = relativePath;
    document.getElementById('regionMeta').textContent = 'Loading…';
    document.getElementById('regionSelector').style.display = 'block';
    document.getElementById('regionPreviewBox').innerHTML =
      '<div style="padding:8px 12px;">' +
        '<div class="skeleton skeleton-line" style="width:80%;"></div>' +
        '<div class="skeleton skeleton-line" style="width:60%;"></div>' +
        '<div class="skeleton skeleton-line" style="width:70%;"></div>' +
      '</div>';
    vscode.postMessage({ type: 'get-file-preview', filePath });
  }

  function onFilePreview(filePath, lines, total) {
    if (!S.selectedFile || S.selectedFile.path !== filePath) return;
    S.filePreviewLines = lines || [];
    S.filePreviewTotal = total || 0;
    document.getElementById('regionMeta').textContent = total + ' lines total · specify a range or select all';
    const endEl = document.getElementById('regionEnd');
    endEl.max = total;
    endEl.value = Math.min(50, total);
    document.getElementById('regionStart').max = total;
    updateRegionPreview();
  }

  window.updateRegionPreview = () => {
    if (!S.filePreviewLines.length) return;
    const start = Math.max(1, parseInt(document.getElementById('regionStart').value) || 1);
    const end = Math.min(S.filePreviewTotal, parseInt(document.getElementById('regionEnd').value) || 50);
    // show lines in range ±3 for context
    const preview = S.filePreviewLines.filter(l => l.n >= Math.max(1, start - 3) && l.n <= Math.min(S.filePreviewTotal, end + 3));
    document.getElementById('regionPreviewBox').innerHTML = preview.map(l => {
      const inRange = l.n >= start && l.n <= end;
      return '<div class="region-line' + (inRange ? ' in-range' : '') + '">' +
        '<div class="region-line-num">' + l.n + '</div>' +
        '<div class="region-line-text">' + esc((l.text || '').substring(0, 140)) + '</div>' +
      '</div>';
    }).join('');
  };

  window.scanRegion = () => {
    if (!S.selectedFile) return;
    const start = parseInt(document.getElementById('regionStart').value) || 1;
    const end = parseInt(document.getElementById('regionEnd').value) || 50;
    closeFileBrowser();
    vscode.postMessage({ type: 'scan-region', filePath: S.selectedFile.path, startLine: start, endLine: end });
  };

  window.scanFullFile = () => {
    if (!S.selectedFile) return;
    const fp = S.selectedFile.path;
    closeFileBrowser();
    vscode.postMessage({ type: 'scan-file', filePath: fp });
  };

  window.copySnippet = (btn, text) => {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {});
  };

  function renderFilesTab(fileResults) {
    if (!fileResults || !fileResults.length) return;
    document.getElementById('filesEmpty').style.display = 'none';
    document.getElementById('filesContent').style.display = 'block';

    const sorted = [...fileResults].sort((a, b) => b.aiScore - a.aiScore);
    document.getElementById('fileTable').innerHTML = '<div class="file-list">' +
      sorted.map(f => {
        const score = (f.aiScore * 100).toFixed(0);
        const scoreColor = f.aiScore > 0.8 ? 'var(--critical)' : f.aiScore > 0.65 ? 'var(--high)' : f.aiScore > 0.4 ? 'var(--medium)' : 'var(--green)';
        return '<div class="file-item" data-action="file-detail" data-filepath="' + esc(f.filePath) + '">' +
          '<span style="font-size:14px;">' + langIcon(f.language) + '</span>' +
          '<span class="file-name">' + esc(f.filePath) + '</span>' +
          '<div class="ai-score-bar" style="width:100px;">' +
            '<div class="ai-score-track"><div class="ai-score-fill" style="width:' + score + '%;"></div></div>' +
          '</div>' +
          '<span class="file-score" style="color:' + scoreColor + '">' + score + '%</span>' +
          '<span class="badge ' + f.severity + '">' + f.severity + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  window.showFileDetail = (filePath) => {
    const data = S.summary?.fileResults?.find(r => r.filePath === filePath);
    if (!data) return;
    const panel = document.getElementById('fileDetailPanel');
    panel.style.display = 'block';
    panel.innerHTML = renderFileDetailHtml(data);
  };

  function renderFileDetailHtml(r) {
    return '<div class="detail-panel">' +
      '<div class="detail-header">' +
        '<div class="score-circle ' + scoreClass(r.aiScore) + '">' +
          '<div style="font-size:18px;">' + (r.aiScore * 100).toFixed(0) + '</div>' +
          '<div style="font-size:10px;">AI%</div>' +
        '</div>' +
        '<div class="detail-info">' +
          '<div class="detail-title">' + esc(r.filePath.split('/').pop() || r.filePath) + '</div>' +
          '<div class="detail-path">' + esc(r.filePath) + '</div>' +
          '<div style="margin-top:4px;">' + '<span class="badge ' + esc(r.language.toLowerCase()) + '">' + esc(r.language) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="metrics-row">' +
        metric(r.linesOfCode, 'Lines') +
        metric(r.vulnerabilities, 'Vulns') +
        metric(r.policyViolations, 'Violations') +
        metric(r.findings.length, 'Total') +
      '</div>' +
      (r.findings.length ? '<div>' + r.findings.slice(0, 5).map(renderFindingCard).join('') + '</div>' : '<div style="color:var(--green);font-size:13px;">✅ No findings in this file</div>') +
    '</div>';
  }

  function metric(val, label) {
    return '<div class="metric"><div class="metric-val">' + val + '</div><div class="metric-label">' + label + '</div></div>';
  }

  function renderFileDetail(result) {
    // Single file scan result
    const el = document.getElementById('tab-files');
    document.getElementById('filesEmpty').style.display = 'none';
    document.getElementById('filesContent').style.display = 'block';
    document.getElementById('fileDetailPanel').style.display = 'block';
    document.getElementById('fileDetailPanel').innerHTML = renderFileDetailHtml(result);
  }

  function renderSidebarFiles(fileResults) {
    if (!fileResults || !fileResults.length) return;
    const sorted = [...fileResults].sort((a, b) => b.aiScore - a.aiScore).slice(0, 20);
    document.getElementById('fileListSidebar').innerHTML = sorted.map(f => {
      const score = (f.aiScore * 100).toFixed(0);
      const color = f.aiScore > 0.65 ? 'var(--red)' : 'var(--green)';
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 2px;cursor:pointer;font-size:11px;" data-action="file-detail" data-filepath="' + esc(f.filePath) + '">' +
        '<span style="font-family:var(--mono);color:' + color + ';min-width:30px;text-align:right;">' + score + '%</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg1);">' + esc(f.filePath.split('/').pop() || f.filePath) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderShellResult(analysis) {
    const colors = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)', info: 'var(--info)' };
    const color = colors[analysis.riskLevel] || 'var(--fg1)';
    const el = document.getElementById('shellResult');
    el.style.display = 'block';
    el.innerHTML = '<div class="shell-result">' +
      '<div class="shell-risk"><span style="color:' + color + ';font-size:18px;">⚠</span><span style="color:' + color + ';text-transform:uppercase;">' + analysis.riskLevel + ' Risk</span></div>' +
      '<div class="shell-issues">' + (analysis.issues.length
        ? analysis.issues.map(i => '<div class="shell-issue"><strong>' + esc(i.type.replace(/-/g,' ')) + '</strong>: ' + esc(i.description) + '</div>').join('')
        : '<div class="shell-issue" style="color:var(--green);">✅ No issues detected</div>') +
      '</div>' +
      (analysis.suggestion ? '<div class="shell-suggestion">💡 ' + esc(analysis.suggestion) + '</div>' : '') +
      (analysis.saferAlternative ? '<div class="shell-alt">$ ' + esc(analysis.saferAlternative) + '</div>' : '') +
    '</div>';

    // Shell examples
    const examples = [
      { cmd: 'rm -rf /', desc: 'Destroys filesystem', risk: 'critical' },
      { cmd: 'curl url | bash', desc: 'Blind remote execution', risk: 'critical' },
      { cmd: 'chmod 777 /app', desc: 'World-writable permissions', risk: 'high' },
      { cmd: 'sudo bash', desc: 'Unrestricted root shell', risk: 'critical' },
    ];
    document.getElementById('shellExamples').innerHTML = examples.map(e =>
      '<div class="policy-card fail" style="cursor:pointer;" data-action="shell-example" data-cmd="' + esc(e.cmd) + '">' +
        '<div class="policy-status">⚠️</div>' +
        '<div><div class="policy-name" style="font-family:var(--mono);">' + esc(e.cmd) + '</div><div class="policy-desc">' + esc(e.desc) + '</div></div>' +
        '<span class="badge ' + e.risk + '">' + e.risk + '</span>' +
      '</div>'
    ).join('');
  }

  function renderPoliciesTab(summary) {
    const policies = [
      { id: 'no-hardcoded-secrets', name: 'No Hardcoded Secrets', desc: 'API keys and passwords not in source' },
      { id: 'no-eval', name: 'No eval() Usage', desc: 'Dynamic code execution forbidden' },
      { id: 'no-innerHTML', name: 'Safe innerHTML', desc: 'No direct innerHTML assignment' },
      { id: 'license-compliance', name: 'License Headers', desc: 'SPDX identifiers in source files' },
      { id: 'no-weak-crypto', name: 'No Weak Crypto', desc: 'MD5/SHA1 forbidden' },
      { id: 'gdpr-personal-data-logging', name: 'GDPR Logging', desc: 'No PII in log statements' },
    ];

    const violatedRules = new Set(
      summary.fileResults.flatMap(r => r.findings)
        .filter(f => f.category === 'policy-violation')
        .map(f => f.policyRule)
    );

    document.getElementById('policyGrid').innerHTML = policies.map(p => {
      const pass = !violatedRules.has(p.id);
      return '<div class="policy-card ' + (pass ? 'pass' : 'fail') + '">' +
        '<div class="policy-status">' + (pass ? '✅' : '❌') + '</div>' +
        '<div><div class="policy-name">' + p.name + '</div><div class="policy-desc">' + p.desc + '</div></div>' +
      '</div>';
    }).join('');

    const passing = policies.filter(p => !violatedRules.has(p.id)).length;
    const pct = Math.round(passing / policies.length * 100);
    document.getElementById('policySummary').innerHTML =
      '<div class="detail-panel" style="margin-top:0;margin-bottom:16px;display:flex;align-items:center;gap:16px;">' +
        '<div class="score-circle ' + (pct >= 80 ? 'low' : pct >= 50 ? 'medium' : 'critical') + '">' +
          '<div style="font-size:20px;">' + pct + '</div><div style="font-size:10px;">% Pass</div>' +
        '</div>' +
        '<div><div style="font-size:16px;font-weight:700;">' + passing + '/' + policies.length + ' policies passing</div>' +
        '<div style="font-size:12px;color:var(--fg1);margin-top:4px;">' + (pct === 100 ? 'All policies satisfied ✅' : (policies.length - passing) + ' violations found across project') + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderProvidersGrid(activeProvider) {
    const providers = [
      { name: 'Anthropic Claude', icon: '🟣', local: false },
      { name: 'OpenAI GPT', icon: '🟢', local: false },
      { name: 'Google Gemini', icon: '🔵', local: false },
      { name: 'Ollama (Local)', icon: '🟡', local: true },
      { name: 'LM Studio (Local)', icon: '🟠', local: true },
    ];
    const el = document.getElementById('providersGrid');
    if (!el) return;
    el.innerHTML = '<div class="policy-grid">' + providers.map(p => {
      const active = activeProvider && activeProvider.name === p.name;
      return '<div class="policy-card ' + (active ? 'pass' : '') + '" style="cursor:pointer;" data-action="configure-provider">' +
        '<div class="policy-status">' + p.icon + '</div>' +
        '<div><div class="policy-name">' + p.name + '</div><div class="policy-desc">' + (p.local ? 'Local model' : 'Cloud API') + '</div></div>' +
        (active ? '<span class="badge low">Active</span>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────
  function hideScanProgress() {
    S.scanBusy = false;
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('btnScanProject').disabled = false;
    document.getElementById('scoreCircle').classList.remove('scanning');
  }

  function updateScoreCircle(score) {
    const pct = (score * 100).toFixed(0);
    const circle = document.getElementById('scoreCircle');
    circle.className = 'score-circle ' + scoreClass(score);
    document.getElementById('scoreVal').textContent = pct + '%';
    document.getElementById('scoreLabel').textContent = score > 0.8 ? '🔴 High AI probability' : score > 0.65 ? '🟠 Likely AI-generated' : score > 0.4 ? '🟡 Possibly AI-assisted' : '🟢 Likely human-written';
  }

  function scoreClass(score) {
    if (score > 0.8) return 'critical';
    if (score > 0.65) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  function langIcon(lang) {
    const icons = { TypeScript: '🔷', JavaScript: '🟨', Python: '🐍', Java: '☕', 'C#': '🟦', Go: '🐹', Rust: '🦀', Ruby: '💎', HTML: '🌐', CSS: '🎨', Shell: '⚙️', SQL: '🗄️' };
    return icons[lang] || '📄';
  }

  function switchTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.toggle('active', x.id === 'tab-' + tab));
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  let notifTimer;
  function showNotif(msg, type) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification show ' + (type || '');
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
  }

  // ─── Static event listeners ────────────────────────────────────────────────
  function on(id, evt, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }

  on('providerBadge',       'click',  configureProvider);
  on('btnHeaderScanFile',   'click',  scanCurrentFile);
  on('btnHeaderExport',     'click',  exportReport);
  on('btnHeaderSettings',   'click',  configureProvider);
  on('btnScanProject',      'click',  scanProject);
  on('btnScanFile',         'click',  scanCurrentFile);
  on('btnScanSelection',    'click',  scanSelection);
  on('btnBrowseFiles',      'click',  openFileBrowser);
  on('fileBrowserClose',    'click',  closeFileBrowser);
  on('btnScanRegion',       'click',  scanRegion);
  on('btnScanFullFile',     'click',  scanFullFile);
  on('regionStart',         'input',  updateRegionPreview);
  on('regionEnd',           'input',  updateRegionPreview);
  on('btnSelectAll', 'click', function() {
    if (!S.filePreviewTotal) return;
    document.getElementById('regionStart').value = 1;
    document.getElementById('regionEnd').value = S.filePreviewTotal;
    updateRegionPreview();
  });
  on('fileSearchInput', 'input', function(e) {
    const q = e.target.value.trim().toLowerCase();
    renderModalFileList(q ? S.workspaceFiles.filter(f => f.relativePath.toLowerCase().includes(q)) : S.workspaceFiles);
  });
  // Close modal on backdrop click
  (function() {
    const overlay = document.getElementById('fileBrowserModal');
    if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFileBrowser(); });
  })();
  // ESC closes modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeFileBrowser();
  });
  on('btnShellAnalyze',     'click',  analyzeShell);
  on('shellInput',          'keydown', function(e) { if (e.key === 'Enter') analyzeShell(); });
  on('findingsSearch',      'input',  filterFindings);
  on('findingsFilter',      'change', filterFindings);
  on('severityFilter',      'change', filterFindings);
  on('fpToggle',            'click',  toggleFPView);
  on('thresholdSlider',     'input',  function(e) { updateThreshold(e.target.value); });
  on('btnGenerateReport',   'click',  generateReport);
  on('btnDashboardStartScan', 'click', scanProject);

  // ─── Event delegation for dynamic content ─────────────────────────────────
  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'sanitize') {
      sanitizeFinding(target.dataset.findingId);
    } else if (action === 'mark-fp') {
      markFalsePositive(target.dataset.findingId);
    } else if (action === 'toggle-evidence') {
      toggleEvidence(target.dataset.findingId);
    } else if (action === 'pick-file') {
      pickFile(target.dataset.path, target.dataset.relpath, target.dataset.name, target.dataset.ext);
    } else if (action === 'copy-snippet') {
      copySnippet(target, target.dataset.snippet || '');
    } else if (action === 'file-detail') {
      showFileDetail(target.dataset.filepath);
    } else if (action === 'shell-example') {
      const inp = document.getElementById('shellInput');
      if (inp) inp.value = target.dataset.cmd;
      analyzeShell();
    } else if (action === 'configure-provider') {
      configureProvider();
    }
  });

  // ─── Init ──────────────────────────────────────────────────────────────────
  vscode.postMessage({ type: 'get-models' });
  vscode.postMessage({ type: 'load-scan-history' });
  renderShellExamples();
  renderProvidersGrid(null);

  function renderShellExamples() {
    const examples = [
      { cmd: 'rm -rf /', desc: 'Destroys the entire filesystem', risk: 'critical' },
      { cmd: 'curl url | bash', desc: 'Blindly executes remote scripts', risk: 'critical' },
      { cmd: 'chmod 777 /app', desc: 'Makes everything world-writable', risk: 'high' },
      { cmd: 'sudo bash', desc: 'Opens unrestricted root shell', risk: 'critical' },
      { cmd: 'wget -qO- url | sh', desc: 'Silent remote script execution', risk: 'critical' },
      { cmd: 'eval $(curl url)', desc: 'Inline execution of remote content', risk: 'critical' },
    ];
    const el = document.getElementById('shellExamples');
    if (el) {
      el.innerHTML = examples.map(e =>
        '<div class="policy-card fail" style="cursor:pointer;" data-action="shell-example" data-cmd="' + esc(e.cmd) + '">' +
          '<div class="policy-status">⚠️</div>' +
          '<div><div class="policy-name" style="font-family:var(--mono);font-size:12px;">' + esc(e.cmd) + '</div><div class="policy-desc">' + esc(e.desc) + '</div></div>' +
          '<span class="badge ' + e.risk + '">' + e.risk + '</span>' +
        '</div>'
      ).join('');
    }
  }

})();
`;
  }
}
