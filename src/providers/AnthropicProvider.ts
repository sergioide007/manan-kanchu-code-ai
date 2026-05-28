import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

export class AnthropicProvider implements AIProvider {
  readonly name = 'Anthropic Claude';
  readonly type = 'anthropic' as const;

  constructor(
    private readonly apiKey: string,
    readonly modelName: string,
    private readonly baseUrl: string,
    private readonly timeout: number
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    const system = options.systemPrompt ?? messages.find(m => m.role === 'system')?.content;
    const filtered = messages.filter(m => m.role !== 'system');
    const body: Record<string, unknown> = {
      model: this.modelName,
      max_tokens: options.maxTokens ?? 4096,
      messages: filtered,
    };
    if (system) body['system'] = system;

    const resp = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic ${resp.status}: ${err}`);
    }

    const data = await resp.json() as {
      content: Array<{ text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text ?? '',
      model: data.model,
      usage: { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens },
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const resp = await this.chat([{ role: 'user', content: prompt }], options);
    return resp.content;
  }
}
