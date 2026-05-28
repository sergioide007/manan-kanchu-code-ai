import { AIProvider, ProviderType } from '../core/interfaces';
import { MananKanchuConfigManager } from '../core/config';
import { SecretManager } from '../core/SecretManager';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { OllamaProvider } from './OllamaProvider';
import { LMStudioProvider } from './LMStudioProvider';

const LOCAL_PRIORITY: ProviderType[] = ['ollama', 'lmstudio'];
const CLOUD_PRIORITY: ProviderType[] = ['anthropic', 'gemini', 'openai'];

export class AIProviderManager {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private active: AIProvider | null = null;

  constructor(
    private readonly config: MananKanchuConfigManager,
    private readonly secrets: SecretManager
  ) {}

  async initialize(): Promise<void> {
    const timeout = this.config.requestTimeout;

    this.providers.set('ollama', new OllamaProvider(
      this.config.ollamaModel, this.config.ollamaEndpoint, timeout
    ));
    this.providers.set('lmstudio', new LMStudioProvider(
      this.config.lmstudioEndpoint, timeout
    ));

    const anthropicKey = await this.secrets.getApiKey('anthropic');
    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(
        anthropicKey, this.config.anthropicModel, this.config.anthropicBaseUrl, timeout
      ));
    }

    const openaiKey = await this.secrets.getApiKey('openai');
    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider(
        openaiKey, this.config.openaiModel, this.config.openaiBaseUrl, timeout
      ));
    }

    const geminiKey = await this.secrets.getApiKey('gemini');
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(
        geminiKey, this.config.geminiModel, this.config.geminiBaseUrl, timeout
      ));
    }

    this.active = await this.selectProvider();
  }

  private async selectProvider(): Promise<AIProvider | null> {
    const preferred = this.config.preferredProvider as ProviderType | 'auto';

    if (preferred !== 'auto') {
      const p = this.providers.get(preferred);
      if (p && await p.isAvailable()) return p;
    }

    for (const type of LOCAL_PRIORITY) {
      const p = this.providers.get(type);
      if (p && await p.isAvailable()) return p;
    }

    for (const type of CLOUD_PRIORITY) {
      const p = this.providers.get(type);
      if (p && await p.isAvailable()) return p;
    }

    return null;
  }

  getActive(): AIProvider | null {
    return this.active;
  }

  getAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  async switchTo(type: ProviderType): Promise<boolean> {
    const p = this.providers.get(type);
    if (!p) return false;
    const available = await p.isAvailable();
    if (!available) return false;
    this.active = p;
    return true;
  }

  async refreshProvider(type: ProviderType, apiKey?: string): Promise<void> {
    const timeout = this.config.requestTimeout;
    if (type === 'anthropic' && apiKey) {
      await this.secrets.setApiKey('anthropic', apiKey);
      this.providers.set('anthropic', new AnthropicProvider(
        apiKey, this.config.anthropicModel, this.config.anthropicBaseUrl, timeout
      ));
    } else if (type === 'openai' && apiKey) {
      await this.secrets.setApiKey('openai', apiKey);
      this.providers.set('openai', new OpenAIProvider(
        apiKey, this.config.openaiModel, this.config.openaiBaseUrl, timeout
      ));
    } else if (type === 'gemini' && apiKey) {
      await this.secrets.setApiKey('gemini', apiKey);
      this.providers.set('gemini', new GeminiProvider(
        apiKey, this.config.geminiModel, this.config.geminiBaseUrl, timeout
      ));
    }
    this.active = await this.selectProvider();
  }

  getActiveInfo(): { name: string; model: string; type: string } | null {
    if (!this.active) return null;
    return { name: this.active.name, model: this.active.modelName, type: this.active.type };
  }
}
