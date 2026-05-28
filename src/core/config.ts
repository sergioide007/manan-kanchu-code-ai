import * as vscode from 'vscode';
import { MananKanchuConfig } from './interfaces';

export class MananKanchuConfigManager {
  private get cfg() {
    return vscode.workspace.getConfiguration('manan-kanchu');
  }

  get preferredProvider(): string {
    return this.cfg.get<string>('preferredProvider', 'auto');
  }

  get maxTokens(): number {
    return this.cfg.get<number>('maxTokens', 4096);
  }

  get temperature(): number {
    return this.cfg.get<number>('temperature', 0.1);
  }

  get requestTimeout(): number {
    return this.cfg.get<number>('requestTimeout', 120000);
  }

  get detectionThreshold(): number {
    return this.cfg.get<number>('detection.threshold', 0.65);
  }

  get heuristicWeight(): number {
    return this.cfg.get<number>('detection.heuristicWeight', 0.4);
  }

  get aiWeight(): number {
    return this.cfg.get<number>('detection.aiWeight', 0.6);
  }

  get excludePatterns(): string[] {
    return this.cfg.get<string[]>('scan.excludePatterns', [
      'node_modules', 'dist', 'out', '.git', '*.min.js', '*.min.css'
    ]);
  }

  get maxFileSizeKB(): number {
    return this.cfg.get<number>('scan.maxFileSizeKB', 512);
  }

  get activePolicies(): string[] {
    return this.cfg.get<string[]>('policies', [
      'no-hardcoded-secrets', 'no-eval', 'no-innerHTML', 'license-compliance'
    ]);
  }

  get privacyTelemetry(): boolean {
    return this.cfg.get<boolean>('privacy.telemetry', false);
  }

  get anthropicModel(): string {
    return this.cfg.get<string>('anthropic.model', 'claude-sonnet-4-6');
  }

  get anthropicBaseUrl(): string {
    return this.cfg.get<string>('anthropic.baseUrl', 'https://api.anthropic.com/v1');
  }

  get openaiModel(): string {
    return this.cfg.get<string>('openai.model', 'gpt-4o');
  }

  get openaiBaseUrl(): string {
    return this.cfg.get<string>('openai.baseUrl', 'https://api.openai.com/v1');
  }

  get geminiModel(): string {
    return this.cfg.get<string>('gemini.model', 'gemini-1.5-pro');
  }

  get geminiBaseUrl(): string {
    return this.cfg.get<string>('gemini.baseUrl', 'https://generativelanguage.googleapis.com/v1beta');
  }

  get ollamaEndpoint(): string {
    return this.cfg.get<string>('ollama.endpoint', 'http://localhost:11434');
  }

  get ollamaModel(): string {
    return this.cfg.get<string>('ollama.model', 'codellama');
  }

  get lmstudioEndpoint(): string {
    return this.cfg.get<string>('lmstudio.endpoint', 'http://localhost:1234');
  }

  toConfig(): MananKanchuConfig {
    return {
      preferredProvider: this.preferredProvider,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      requestTimeout: this.requestTimeout,
      detectionThreshold: this.detectionThreshold,
      heuristicWeight: this.heuristicWeight,
      aiWeight: this.aiWeight,
      excludePatterns: this.excludePatterns,
      maxFileSizeKB: this.maxFileSizeKB,
      activePolicies: this.activePolicies,
      privacyTelemetry: this.privacyTelemetry,
    };
  }

  async updateSetting(key: string, value: unknown): Promise<void> {
    await this.cfg.update(key, value, vscode.ConfigurationTarget.Global);
  }
}
