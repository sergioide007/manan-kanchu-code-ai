import { MCPExecutor, MCPServer } from '../core/interfaces';

export class MCPManager implements MCPExecutor {
  private servers: Map<string, MCPServer> = new Map();

  registerServer(server: MCPServer): void {
    this.servers.set(server.id, server);
  }

  async executeTool(serverId: string, toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`MCP server '${serverId}' not found`);

    const tool = server.tools.find(t => t.name === toolName);
    if (!tool) throw new Error(`Tool '${toolName}' not found in server '${serverId}'`);

    return tool.execute(params);
  }

  getServers(): MCPServer[] {
    return [...this.servers.values()];
  }
}
