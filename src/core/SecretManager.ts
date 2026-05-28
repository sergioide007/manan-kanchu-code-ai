import * as vscode from 'vscode';
import { ProviderType } from './interfaces';

const KEY_PREFIX = 'manan-kanchu.apikey.';

export class SecretManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getApiKey(provider: ProviderType): Promise<string | undefined> {
    return this.secrets.get(`${KEY_PREFIX}${provider}`);
  }

  async setApiKey(provider: ProviderType, key: string): Promise<void> {
    await this.secrets.store(`${KEY_PREFIX}${provider}`, key);
  }

  async deleteApiKey(provider: ProviderType): Promise<void> {
    await this.secrets.delete(`${KEY_PREFIX}${provider}`);
  }

  async hasApiKey(provider: ProviderType): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key !== undefined && key.length > 0;
  }
}
