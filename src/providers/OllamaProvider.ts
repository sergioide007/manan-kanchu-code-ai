import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama (Local)';
  readonly type = 'ollama' as const;

  constructor(
    readonly modelName: string,
    private readonly endpoint: string,
    private readonly timeout: number
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    const body = {
      model: this.modelName,
      messages,
      stream: false,
      options: {
        num_predict: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.1,
      },
    };

    const resp = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Ollama ${resp.status}: ${err}`);
    }

    const data = await resp.json() as {
      message: { content: string };
      model: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content ?? '',
      model: data.model,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
      },
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const resp = await this.chat([{ role: 'user', content: prompt }], options);
    return resp.content;
  }
}
