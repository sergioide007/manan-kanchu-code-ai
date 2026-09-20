import * as fs from 'fs';
import * as path from 'path';
import { MCPExecutor } from '../core/interfaces';
import { isInside, resolveAgainst } from '../core/pathUtils';

const SERVER = 'filesystem';

/**
 * File access for skills and the panel. Inside the workspace every read and write goes through the
 * Filesystem MCP server (which refuses anything that escapes the workspace); outside it, or when no
 * MCP server is registered (e.g. a single file opened without a folder), plain fs is used.
 */
export async function readWorkspaceFile(mcp: MCPExecutor | undefined, workspace: string, filePath: string): Promise<string> {
  const abs = resolveAgainst(workspace, filePath);
  if (mcp?.hasTool(SERVER, 'read_file') && isInside(workspace, abs)) {
    return String(await mcp.executeTool(SERVER, 'read_file', { path: abs }));
  }
  return fs.readFileSync(abs, 'utf-8');
}

export async function writeWorkspaceFile(mcp: MCPExecutor | undefined, workspace: string, filePath: string, content: string): Promise<void> {
  const abs = resolveAgainst(workspace, filePath);
  if (mcp?.hasTool(SERVER, 'write_file') && isInside(workspace, abs)) {
    await mcp.executeTool(SERVER, 'write_file', { path: abs, content });
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}
