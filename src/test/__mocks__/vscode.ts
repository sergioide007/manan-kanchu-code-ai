/* eslint-disable @typescript-eslint/no-explicit-any */
const vscode = {
  window: {
    createOutputChannel: jest.fn(() => ({ appendLine: jest.fn(), show: jest.fn(), dispose: jest.fn() })),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    createWebviewPanel: jest.fn(() => ({
      webview: { postMessage: jest.fn(), onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })), html: '' },
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      reveal: jest.fn(),
      dispose: jest.fn(),
    })),
    activeTextEditor: undefined,
    withProgress: jest.fn((_, fn) => fn({ report: jest.fn() })),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, def?: any) => def),
      update: jest.fn().mockResolvedValue(undefined),
    })),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    openTextDocument: jest.fn().mockResolvedValue({ uri: {} }),
    fs: { readFile: jest.fn(), writeFile: jest.fn() },
  },
  commands: {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
    executeCommand: jest.fn().mockResolvedValue(undefined),
  },
  ExtensionContext: jest.fn(),
  ViewColumn: { One: 1, Two: 2, Beside: -2 },
  ProgressLocation: { Notification: 15, SourceControl: 1, Window: 10 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  Uri: { file: jest.fn(p => ({ fsPath: p, path: p })) },
  SecretStorage: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    onDidChange: jest.fn(),
  })),
  Disposable: { from: jest.fn() },
};

module.exports = vscode;
