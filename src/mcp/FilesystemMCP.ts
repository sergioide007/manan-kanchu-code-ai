import * as fs from 'fs';
import * as path from 'path';
import { MCPServer, MCPTool } from '../core/interfaces';

export class FilesystemMCP implements MCPServer {
  readonly id = 'filesystem';
  readonly name = 'Filesystem';
  readonly tools: MCPTool[];

  constructor(private readonly workspaceRoot: string) {
    this.tools = [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        execute: async (params) => {
          const filePath = path.resolve(this.workspaceRoot, params['path'] as string);
          return fs.readFileSync(filePath, 'utf-8');
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        execute: async (params) => {
          const filePath = path.resolve(this.workspaceRoot, params['path'] as string);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, params['content'] as string, 'utf-8');
          return { success: true };
        },
      },
      {
        name: 'list_files',
        description: 'List files in a directory recursively',
        execute: async (params) => {
          const dir = path.resolve(this.workspaceRoot, (params['path'] as string) ?? '.');
          const maxDepth = (params['maxDepth'] as number) ?? 5;
          return this._walk(dir, maxDepth, 0);
        },
      },
      {
        name: 'file_exists',
        description: 'Check if a file or directory exists',
        execute: async (params) => {
          const filePath = path.resolve(this.workspaceRoot, params['path'] as string);
          return { exists: fs.existsSync(filePath) };
        },
      },
    ];
  }

  private _walk(dir: string, maxDepth: number, currentDepth: number): string[] {
    if (currentDepth >= maxDepth) return [];
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(this.workspaceRoot, fullPath);

      if (this._shouldSkip(entry.name)) continue;

      if (entry.isDirectory()) {
        files.push(...this._walk(fullPath, maxDepth, currentDepth + 1));
      } else {
        files.push(rel);
      }
    }

    return files;
  }

  private _shouldSkip(name: string): boolean {
    const skip = ['node_modules', '.git', 'dist', 'out', 'coverage', '.vscode'];
    return skip.includes(name) || name.startsWith('.');
  }
}
