import * as vscode from 'vscode';
import { MainPanel } from './panel/MainPanel';
import { AIProviderManager } from './providers/AIProviderManager';
import { MananKanchuConfigManager } from './core/config';
import { SecretManager } from './core/SecretManager';
import { SkillRegistry } from './skills/SkillRegistry';
import { MCPManager } from './mcp/MCPManager';
import { FilesystemMCP } from './mcp/FilesystemMCP';
import { ScanFileSkill } from './skills/ScanFileSkill';
import { ScanProjectSkill } from './skills/ScanProjectSkill';
import { GenerateReportSkill } from './skills/GenerateReportSkill';
import { SanitizeCodeSkill } from './skills/SanitizeCodeSkill';

let aiManager: AIProviderManager;
let skillRegistry: SkillRegistry;
let mcpManager: MCPManager;
let config: MananKanchuConfigManager;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('manan-kanchu');
  output.appendLine('manan-kanchu AI Code Detector activating…');

  config = new MananKanchuConfigManager();
  const secrets = new SecretManager(context.secrets);

  aiManager = new AIProviderManager(config, secrets);
  skillRegistry = new SkillRegistry(config.toConfig());
  mcpManager = new MCPManager();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  if (workspaceRoot) {
    mcpManager.registerServer(new FilesystemMCP(workspaceRoot));
  }

  skillRegistry.register(new ScanFileSkill());
  skillRegistry.register(new ScanProjectSkill());
  skillRegistry.register(new GenerateReportSkill());
  skillRegistry.register(new SanitizeCodeSkill());

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('manan-kanchu.open', () => {
      MainPanel.show(context, aiManager, skillRegistry, mcpManager, config);
    }),

    vscode.commands.registerCommand('manan-kanchu.showMenu', async () => {
      const items = [
        { label: '$(search) Open Dashboard', cmd: 'manan-kanchu.open' },
        { label: '$(file-code) Scan Current File', cmd: 'manan-kanchu.scanFile' },
        { label: '$(folder) Scan Entire Project', cmd: 'manan-kanchu.scanProject' },
        { label: '$(selection) Scan Selected Code', cmd: 'manan-kanchu.scanSelection' },
        { label: '$(graph) Generate Audit Report', cmd: 'manan-kanchu.generateReport' },
        { label: '$(settings-gear) Configure AI Provider', cmd: 'manan-kanchu.configureProvider' },
      ];
      const pick = await vscode.window.showQuickPick(items.map(i => i.label), {
        placeHolder: 'manan-kanchu — Select action',
      });
      if (!pick) return;
      const item = items.find(i => i.label === pick);
      if (item) await vscode.commands.executeCommand(item.cmd);
    }),

    vscode.commands.registerCommand('manan-kanchu.scanFile', async () => {
      MainPanel.show(context, aiManager, skillRegistry, mcpManager, config);
      await waitForPanel();
      MainPanel.current?.['_panel']?.webview?.postMessage({ type: 'scan-file' });
    }),

    vscode.commands.registerCommand('manan-kanchu.scanProject', async () => {
      MainPanel.show(context, aiManager, skillRegistry, mcpManager, config);
      await waitForPanel();
      MainPanel.current?.['_panel']?.webview?.postMessage({ type: 'scan-project' });
    }),

    vscode.commands.registerCommand('manan-kanchu.scanSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select code to scan first');
        return;
      }
      MainPanel.show(context, aiManager, skillRegistry, mcpManager, config);
      await waitForPanel();
      const code = editor.document.getText(editor.selection);
      const filePath = editor.document.fileName;
      MainPanel.current?.['_panel']?.webview?.postMessage({ type: 'scan-selection', code, filePath });
    }),

    vscode.commands.registerCommand('manan-kanchu.configureProvider', async () => {
      await vscode.commands.executeCommand('manan-kanchu.open');
      await waitForPanel();
      MainPanel.current?.['_panel']?.webview?.postMessage({ type: 'configure-provider' });
    }),

    vscode.commands.registerCommand('manan-kanchu.generateReport', async () => {
      MainPanel.show(context, aiManager, skillRegistry, mcpManager, config);
      await waitForPanel();
      MainPanel.current?.['_panel']?.webview?.postMessage({ type: 'generate-report', format: 'markdown' });
    }),

    vscode.commands.registerCommand('manan-kanchu.sanitize', async () => {
      vscode.window.showInformationMessage('Open manan-kanchu Dashboard and scan a file to see auto-fix options.');
    }),

    output
  );

  // Initialize AI providers in background
  initProviders(output);

  output.appendLine('manan-kanchu activated');
}

async function initProviders(output: vscode.OutputChannel): Promise<void> {
  try {
    await aiManager.initialize();
    const info = aiManager.getActiveInfo();
    if (info) {
      output.appendLine(`Active provider: ${info.name} (${info.model})`);
    } else {
      output.appendLine('No AI provider available. Configure one in the dashboard.');
    }
    MainPanel.current?.refreshProviders();
  } catch (e) {
    output.appendLine(`Provider init error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function waitForPanel(ms = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function deactivate(): void {
  MainPanel.current?.dispose();
}
