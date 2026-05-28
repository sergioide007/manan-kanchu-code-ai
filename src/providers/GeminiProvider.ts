import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

export class GeminiProvider implements AIProvider {
  readonly name = 'Google Gemini';
  readonly type = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    readonly modelName: string,
    private readonly baseUrl: string,
    private readonly timeout: number
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const url = `${this.baseUrl}/models?key=${this.apiKey}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.1,
      },
    };

    if (options.systemPrompt) {
      body['systemInstruction'] = { parts: [{ text: options.systemPrompt }] };
    }

    const url = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${err}`);
    }

    const data = await resp.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
    };

    return {
      content: data.candidates[0]?.content?.parts[0]?.text ?? '',
      model: this.modelName,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const resp = await this.chat([{ role: 'user', content: prompt }], options);
    return resp.content;
  }
}
