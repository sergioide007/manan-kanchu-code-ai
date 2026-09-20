import { OpenAIProvider } from '../../../providers/OpenAIProvider';
import { LMStudioProvider } from '../../../providers/LMStudioProvider';
import { OllamaProvider } from '../../../providers/OllamaProvider';
import { GeminiProvider } from '../../../providers/GeminiProvider';
import { AnthropicProvider } from '../../../providers/AnthropicProvider';
import * as vscode from 'vscode';
import { MananKanchuConfigManager } from '../../../core/config';

const getConfiguration = vscode.workspace.getConfiguration as unknown as jest.Mock;

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

describe('provider availability and error handling', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as never; });
  afterEach(() => { global.fetch = realFetch; });

  const cloud = () => [
    new AnthropicProvider('k', 'm', 'https://a', 100),
    new OpenAIProvider('k', 'm', 'https://o', 100),
    new GeminiProvider('k', 'm', 'https://g', 100),
  ];
  const local = () => [new OllamaProvider('m', 'http://localhost:11434', 100), new LMStudioProvider('http://localhost:1234', 100)];

  it('isAvailable is true on HTTP 200 and false on errors or network failures', async () => {
    for (const p of [...cloud(), ...local()]) {
      fetchMock.mockResolvedValueOnce(json({}));
      expect(await p.isAvailable()).toBe(true);
      fetchMock.mockResolvedValueOnce(json({}, false, 401));
      expect(await p.isAvailable()).toBe(false);
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      expect(await p.isAvailable()).toBe(false);
    }
  });

  it('cloud providers without a key are never available and make no request', async () => {
    for (const p of [new AnthropicProvider('', 'm', 'https://a', 1), new OpenAIProvider('', 'm', 'https://o', 1), new GeminiProvider('', 'm', 'https://g', 1)]) {
      expect(await p.isAvailable()).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('OpenAI and LM Studio return content and usage', async () => {
    const reply = { choices: [{ message: { content: 'hello' } }], model: 'm', usage: { prompt_tokens: 3, completion_tokens: 4 } };
    for (const p of [new OpenAIProvider('k', 'm', 'https://o', 100), new LMStudioProvider('http://localhost:1234', 100)]) {
      fetchMock.mockResolvedValueOnce(json(reply));
      const r = await p.chat([{ role: 'user', content: 'hi' }], { systemPrompt: 'sys', maxTokens: 10, temperature: 0 });
      expect(r.content).toBe('hello');
      expect(r.usage).toEqual({ promptTokens: 3, completionTokens: 4 });
      const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    }
  });

  it('every provider throws a descriptive error on HTTP failure', async () => {
    for (const p of [...cloud(), ...local()]) {
      fetchMock.mockResolvedValue(json({ error: 'nope' }, false, 500));
      await expect(p.complete('hi')).rejects.toThrow(/500/);
    }
  });

  it('providers tolerate empty or partial replies', async () => {
    fetchMock.mockResolvedValue(json({ choices: [], usage: undefined }));
    expect(await new LMStudioProvider('http://x', 100).complete('hi')).toBe('');
    fetchMock.mockResolvedValue(json({ candidates: [], usageMetadata: undefined }));
    expect(await new GeminiProvider('k', 'm', 'https://g', 100).complete('hi')).toBe('');
    fetchMock.mockResolvedValue(json({ content: [], model: 'm', usage: { input_tokens: 0, output_tokens: 0 } }));
    expect(await new AnthropicProvider('k', 'm', 'https://a', 100).complete('hi')).toBe('');
    fetchMock.mockResolvedValue(json({}));
    expect(await new OllamaProvider('m', 'http://x', 100).complete('hi')).toBe('');
  });

  it('Gemini maps assistant messages to the model role and sets systemInstruction', async () => {
    fetchMock.mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } }));
    const r = await new GeminiProvider('k', 'm', 'https://g', 100).chat(
      [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], { systemPrompt: 'sys' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model']);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(r.usage).toEqual({ promptTokens: 1, completionTokens: 2 });
  });
});

describe('MananKanchuConfigManager', () => {
  it('exposes documented defaults for every setting', () => {
    getConfiguration.mockReturnValue({
      get: jest.fn((_k: string, def?: unknown) => def),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const c = new MananKanchuConfigManager();
    const cfg = c.toConfig();
    expect(cfg).toMatchObject({ preferredProvider: 'auto', maxTokens: 4096, temperature: 0.1, requestTimeout: 120000,
      detectionThreshold: 0.65, heuristicWeight: 0.4, aiWeight: 0.6, maxFileSizeKB: 512, privacyTelemetry: false });
    expect(cfg.activePolicies).toEqual(['no-hardcoded-secrets', 'no-eval', 'no-innerHTML', 'license-compliance']);
    expect(c.geminiModel).toBe('gemini-3.1-flash-lite');
    expect([c.anthropicModel, c.openaiModel, c.ollamaModel]).toEqual(['claude-sonnet-4-6', 'gpt-6-astra', 'codellama']);
    expect([c.anthropicBaseUrl, c.openaiBaseUrl, c.geminiBaseUrl, c.ollamaEndpoint, c.lmstudioEndpoint].every(u => u.startsWith('http'))).toBe(true);
    expect(c.excludePatterns).toContain('node_modules');
  });

  it('updateSetting writes to the global scope', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getConfiguration.mockReturnValue({ get: jest.fn(), update });
    await new MananKanchuConfigManager().updateSetting('detection.threshold', 0.7);
    expect(update).toHaveBeenCalledWith('detection.threshold', 0.7, 1);
  });
});
