import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

/**
 * Reasoning-family models (GPT-5 and later, o-series, e.g. `gpt-6-astra`) differ from classic chat models:
 *  - they take `max_completion_tokens`, and hidden reasoning tokens count against it
 *  - they reject a custom `temperature`
 *  - they accept `reasoning_effort`
 */
const REASONING_MODEL = /^(?:gpt-(?:[5-9]|\d{2,})|o\d)/i;

/** Extra budget so hidden reasoning tokens don't consume the whole visible answer. */
const REASONING_HEADROOM = 1024;

export class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';
  readonly type = 'openai' as const;

  constructor(
    private readonly apiKey: string,
    readonly modelName: string,
    private readonly baseUrl: string,
    private readonly timeout: number
  ) {}

  private get isReasoningModel(): boolean {
    return REASONING_MODEL.test(this.modelName);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private buildBody(messages: Message[], options: ChatOptions): Record<string, unknown> {
    const requested = options.maxTokens ?? 4096;
    const body: Record<string, unknown> = {
      model: this.modelName,
      messages: options.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages,
    };

    if (this.isReasoningModel) {
      body['max_completion_tokens'] = requested + REASONING_HEADROOM;
      body['reasoning_effort'] = 'low'; // analyses are short; keep latency and cost down
    } else {
      body['max_completion_tokens'] = requested;
      body['temperature'] = options.temperature ?? 0.1;
    }
    return body;
  }

  private send(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    let body = this.buildBody(messages, options);
    let resp = await this.send(body);

    // Compatible servers and older/newer models disagree on parameters: drop or swap the one
    // the API names in a 400, at most twice.
    for (let attempt = 0; attempt < 2 && resp.status === 400; attempt++) {
      const detail = await resp.text();
      const adjusted = this.adjustForError(body, detail);
      if (!adjusted) throw new Error(`OpenAI 400: ${detail}`);
      body = adjusted;
      resp = await this.send(body);
    }

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${err}`);
    }

    const data = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private adjustForError(body: Record<string, unknown>, detail: string): Record<string, unknown> | null {
    const next = { ...body };
    if (/temperature/i.test(detail) && 'temperature' in next) {
      delete next['temperature'];
      return next;
    }
    if (/reasoning_effort/i.test(detail) && 'reasoning_effort' in next) {
      delete next['reasoning_effort'];
      return next;
    }
    if (/max_completion_tokens/i.test(detail) && 'max_completion_tokens' in next) {
      next['max_tokens'] = next['max_completion_tokens'];
      delete next['max_completion_tokens'];
      return next;
    }
    return null;
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const resp = await this.chat([{ role: 'user', content: prompt }], options);
    return resp.content;
  }
}
