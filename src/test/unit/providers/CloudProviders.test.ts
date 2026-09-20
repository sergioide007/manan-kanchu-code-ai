import { AnthropicProvider } from '../../../providers/AnthropicProvider';
import { GeminiProvider } from '../../../providers/GeminiProvider';
import { OllamaProvider } from '../../../providers/OllamaProvider';

type FetchArgs = [string, RequestInit];
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const fail = (status: number, text: string) => ({ ok: false, status, json: async () => ({}), text: async () => text });

describe('provider request shape', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as never; });
  afterEach(() => { global.fetch = realFetch; });

  const anthropicReply = { content: [{ text: 'ok' }], model: 'm', usage: { input_tokens: 1, output_tokens: 1 } };

  it('Anthropic forwards the requested temperature (used to be dropped → API default 1.0)', async () => {
    fetchMock.mockResolvedValue(okJson(anthropicReply));
    const p = new AnthropicProvider('key', 'claude-sonnet-4-6', 'https://api.anthropic.com/v1', 1000);
    await p.complete('hi', { temperature: 0, maxTokens: 80 });
    const body = JSON.parse((fetchMock.mock.calls[0] as FetchArgs)[1].body as string);
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(80);
  });

  it('Anthropic retries once without temperature if the model rejects it', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(400, '{"error":{"message":"temperature is not supported for this model"}}'))
      .mockResolvedValueOnce(okJson(anthropicReply));
    const p = new AnthropicProvider('key', 'm', 'https://api.anthropic.com/v1', 1000);
    await expect(p.complete('hi', { temperature: 0.1 })).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchMock.mock.calls[1] as FetchArgs)[1].body as string)).not.toHaveProperty('temperature');
  });

  it('Anthropic surfaces unrelated 400 errors without retrying', async () => {
    fetchMock.mockResolvedValue(fail(400, 'invalid model'));
    const p = new AnthropicProvider('key', 'm', 'https://api.anthropic.com/v1', 1000);
    await expect(p.complete('hi')).rejects.toThrow(/Anthropic 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Gemini sends the API key in a header, never in the URL', async () => {
    fetchMock.mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: {} }));
    const p = new GeminiProvider('SECRET-KEY', 'gemini-3.1-flash-lite', 'https://generativelanguage.googleapis.com/v1beta', 1000);
    await p.complete('hi');
    await p.isAvailable();
    for (const call of fetchMock.mock.calls as FetchArgs[]) {
      expect(call[0]).not.toContain('SECRET-KEY');
      expect(call[0]).not.toContain('key=');
      expect((call[1].headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET-KEY');
    }
  });

  it('Ollama honours systemPrompt', async () => {
    fetchMock.mockResolvedValue(okJson({ message: { content: 'ok' }, model: 'm' }));
    await new OllamaProvider('codellama', 'http://localhost:11434', 1000).chat([{ role: 'user', content: 'hi' }], { systemPrompt: 'be brief' });
    const body = JSON.parse((fetchMock.mock.calls[0] as FetchArgs)[1].body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' });
  });
});
