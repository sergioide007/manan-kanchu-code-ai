import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FilesystemMCP } from '../../../mcp/FilesystemMCP';
import { MCPManager } from '../../../mcp/MCPManager';

describe('FilesystemMCP', () => {
  let dir: string;
  let mcp: MCPManager;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-mcp-'));
    fs.writeFileSync(path.join(dir, 'hello.txt'), 'hi');
    mcp = new MCPManager();
    mcp.registerServer(new FilesystemMCP(dir));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reads, writes and lists files inside the workspace', async () => {
    expect(await mcp.executeTool('filesystem', 'read_file', { path: 'hello.txt' })).toBe('hi');
    await mcp.executeTool('filesystem', 'write_file', { path: 'sub/new.txt', content: 'x' });
    expect(fs.readFileSync(path.join(dir, 'sub', 'new.txt'), 'utf-8')).toBe('x');
    const files = (await mcp.executeTool('filesystem', 'list_files', {})) as string[];
    expect(files).toEqual(expect.arrayContaining(['hello.txt', path.join('sub', 'new.txt')]));
    expect(await mcp.executeTool('filesystem', 'file_exists', { path: 'hello.txt' })).toEqual({ exists: true });
  });

  it.each(['read_file', 'write_file', 'file_exists', 'list_files'])('%s refuses paths outside the workspace', async tool => {
    await expect(mcp.executeTool('filesystem', tool, { path: '../outside.txt', content: 'x' })).rejects.toThrow(/escapes/);
    await expect(mcp.executeTool('filesystem', tool, { path: path.resolve('/etc/passwd'), content: 'x' })).rejects.toThrow(/escapes/);
  });

  it('rejects unknown servers and tools', async () => {
    await expect(mcp.executeTool('nope', 'read_file', {})).rejects.toThrow(/not found/);
    await expect(mcp.executeTool('filesystem', 'nope', {})).rejects.toThrow(/not found/);
    expect(mcp.getServers()).toHaveLength(1);
  });
});
