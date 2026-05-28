import { SecretManager } from '../../../core/SecretManager';

describe('SecretManager', () => {
  let mockSecrets: {
    get: jest.Mock;
    store: jest.Mock;
    delete: jest.Mock;
  };
  let manager: SecretManager;

  beforeEach(() => {
    mockSecrets = {
      get: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    manager = new SecretManager(mockSecrets as never);
  });

  it('returns undefined when no key stored', async () => {
    mockSecrets.get.mockResolvedValue(undefined);
    const key = await manager.getApiKey('anthropic');
    expect(key).toBeUndefined();
  });

  it('returns key when stored', async () => {
    mockSecrets.get.mockResolvedValue('sk-test-key-123');
    const key = await manager.getApiKey('anthropic');
    expect(key).toBe('sk-test-key-123');
  });

  it('stores key correctly', async () => {
    await manager.setApiKey('openai', 'sk-openai-456');
    expect(mockSecrets.store).toHaveBeenCalledWith('manan-kanchu.apikey.openai', 'sk-openai-456');
  });

  it('deletes key correctly', async () => {
    await manager.deleteApiKey('gemini');
    expect(mockSecrets.delete).toHaveBeenCalledWith('manan-kanchu.apikey.gemini');
  });

  it('hasApiKey returns false when no key', async () => {
    mockSecrets.get.mockResolvedValue(undefined);
    const has = await manager.hasApiKey('anthropic');
    expect(has).toBe(false);
  });

  it('hasApiKey returns true when key exists', async () => {
    mockSecrets.get.mockResolvedValue('my-key');
    const has = await manager.hasApiKey('anthropic');
    expect(has).toBe(true);
  });

  it('hasApiKey returns false for empty string', async () => {
    mockSecrets.get.mockResolvedValue('');
    const has = await manager.hasApiKey('anthropic');
    expect(has).toBe(false);
  });
});
