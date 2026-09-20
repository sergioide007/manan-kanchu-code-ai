import { AIProvider, AIResponse, ChatOptions, Message } from '../core/interfaces';

/** The two user settings that shape every AI request. Read on each call so edits apply immediately. */
export interface RequestSettings {
  readonly maxTokens: number;
  readonly temperature: number;
}

/**
 * Applies `manan-kanchu.maxTokens` and `manan-kanchu.temperature` to every request made through a provider.
 *  - maxTokens is a ceiling: a feature may ask for fewer tokens (e.g. 80 for a score), never more.
 *  - temperature is the single sampling knob for all analyses (clamped to 0–1, the range every provider accepts).
 */
export class ConfiguredProvider implements AIProvider {
  constructor(
    private readonly inner: AIProvider,
    private readonly settings: RequestSettings
  ) {}

  get name(): string { return this.inner.name; }
  get type(): AIProvider['type'] { return this.inner.type; }
  get modelName(): string { return this.inner.modelName; }

  isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  chat(messages: Message[], options: ChatOptions = {}): Promise<AIResponse> {
    return this.inner.chat(messages, this.apply(options));
  }

  complete(prompt: string, options: ChatOptions = {}): Promise<string> {
    return this.inner.complete(prompt, this.apply(options));
  }

  /** Exposed for tests. */
  apply(options: ChatOptions): ChatOptions {
    const merged: ChatOptions = { ...options };

    const cap = Math.floor(Number(this.settings.maxTokens));
    if (Number.isFinite(cap) && cap > 0) {
      merged.maxTokens = Math.min(options.maxTokens ?? cap, cap);
    }

    const temperature = Number(this.settings.temperature);
    if (Number.isFinite(temperature)) {
      merged.temperature = Math.min(1, Math.max(0, temperature));
    }
    return merged;
  }
}
