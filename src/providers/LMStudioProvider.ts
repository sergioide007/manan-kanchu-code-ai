import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

export class LMStudioProvider implements AIProvider {
  readonly name = 'LM Studio (Local)';
  readonly type = 'lmstudio' as const;
  readonly modelName = 'local-model';

  constructor(
    private readonly endpoint: string,
    private readonly timeout: number
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    const body = {
      messages: options.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.1,
    };

    const resp = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`LM Studio ${resp.status}: ${err}`);
    }

    const data = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
      model?: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model ?? 'local',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const resp = await this.chat([{ role: 'user', content: prompt }], options);
    return resp.content;
  }
}
