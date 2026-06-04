import * as vscode from 'vscode';
import { AIProviderManager } from '../providers/AIProviderManager';
import { SkillRegistry } from '../skills/SkillRegistry';
import { MCPManager } from '../mcp/MCPManager';
import { MananKanchuConfigManager } from '../core/config';
import { WebviewMessage } from '../core/interfaces';
import { PanelMessageHandler } from './PanelMessageHandler';
import { buildWebviewHtml } from './webview/WebviewRenderer';

export class MainPanel {
  public static current: MainPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _handler: PanelMessageHandler;

  static show(
    _context: vscode.ExtensionContext,
    aiManager: AIProviderManager,
    skillRegistry: SkillRegistry,
    _mcpManager: MCPManager,
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
    MainPanel.current = new MainPanel(panel, aiManager, skillRegistry, config);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    aiManager: AIProviderManager,
    skillRegistry: SkillRegistry,
    config: MananKanchuConfigManager
  ) {
    this._panel = panel;
    this._handler = new PanelMessageHandler(
      aiManager,
      skillRegistry,
      config,
      (data) => this._panel.webview.postMessage(data)
    );

    this._handler.setLastEditor(vscode.window.activeTextEditor);

    vscode.window.onDidChangeActiveTextEditor(
      editor => this._handler.setLastEditor(editor),
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this._handler.handle(msg),
      null,
      this._disposables
    );

    this._panel.webview.html = buildWebviewHtml();
  }

  triggerScanFile(filePath?: string, code?: string): void {
    this._handler.scanFile(filePath, code);
  }

  triggerScanProject(): void {
    this._handler.scanProject();
  }

  refreshProviders(): void {
    this._handler.sendProviderInfo();
    this._panel.webview.html = buildWebviewHtml();
  }

  dispose(): void {
    MainPanel.current = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
  }
}
