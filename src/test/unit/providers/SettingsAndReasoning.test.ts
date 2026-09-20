import { ConfiguredProvider } from '../../../providers/ConfiguredProvider';
import { OpenAIProvider } from '../../../providers/OpenAIProvider';
import { AIProvider, ChatOptions } from '../../../core/interfaces';

const recorder = () => {
  const calls: ChatOptions[] = [];
  const inner: AIProvider = {
    name: 'inner', type: 'ollama', modelName: 'm',
    isAvailable: async () => true,
    chat: async (_m, o) => { calls.push(o ?? {}); return { content: 'x', model: 'm', usage: { promptTokens: 0, completionTokens: 0 } }; },
    complete: async (_p, o) => { calls.push(o ?? {}); return 'x'; },
  };
  return { inner, calls };
};

describe('ConfiguredProvider (maxTokens / temperature settings)', () => {
  it('caps requests at the maxTokens setting but lets features ask for less', async () => {
    const { inner, calls } = recorder();
    const p = new ConfiguredProvider(inner, { maxTokens: 500, temperature: 0.1 });
    await p.complete('a', { maxTokens: 80 });
    await p.complete('b', { maxTokens: 4000 });
    await p.complete('c');
    expect(calls.map(c => c.maxTokens)).toEqual([80, 500, 500]);
  });

  it('applies the temperature setting to every request, clamped to 0–1', async () => {
    const { inner, calls } = recorder();
    await new ConfiguredProvider(inner, { maxTokens: 100, temperature: 0.3 }).complete('a', { temperature: 0 });
    await new ConfiguredProvider(inner, { maxTokens: 100, temperature: 7 }).complete('a');
    await new ConfiguredProvider(inner, { maxTokens: 100, temperature: -2 }).complete('a');
    expect(calls.map(c => c.temperature)).toEqual([0.3, 1, 0]);
  });

  it('reads the settings on every call so edits apply immediately', async () => {
    const { inner, calls } = recorder();
    const settings = { maxTokens: 100, temperature: 0.1 };
    const p = new ConfiguredProvider(inner, settings);
    await p.chat([{ role: 'user', content: 'x' }]);
    settings.maxTokens = 50; settings.temperature = 0.9;
    await p.chat([{ role: 'user', content: 'x' }]);
    expect(calls.map(c => [c.maxTokens, c.temperature])).toEqual([[100, 0.1], [50, 0.9]]);
  });

  it('ignores invalid settings and keeps the caller values', () => {
    const { inner } = recorder();
    const p = new ConfiguredProvider(inner, { maxTokens: Number.NaN, temperature: Number.NaN });
    expect(p.apply({ maxTokens: 80, temperature: 0 })).toEqual({ maxTokens: 80, temperature: 0 });
    expect(new ConfiguredProvider(inner, { maxTokens: 0, temperature: 0 }).apply({ maxTokens: 80 }).maxTokens).toBe(80);
  });

  it('delegates identity and availability', async () => {
    const { inner } = recorder();
    const p = new ConfiguredProvider(inner, { maxTokens: 1, temperature: 0 });
    expect([p.name, p.type, p.modelName]).toEqual(['inner', 'ollama', 'm']);
    expect(await p.isAvailable()).toBe(true);
  });
});

describe('OpenAIProvider request shape', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as never; });
  afterEach(() => { global.fetch = realFetch; });

  const ok = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'hi' } }], model: 'm', usage: { prompt_tokens: 1, completion_tokens: 1 } }), text: async () => '' };
  const bad = (text: string) => ({ ok: false, status: 400, json: async () => ({}), text: async () => text });
  const bodyOf = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);

  it('classic chat models get temperature and max_completion_tokens', async () => {
    fetchMock.mockResolvedValue(ok);
    await new OpenAIProvider('k', 'gpt-4o', 'https://o', 100).complete('x', { maxTokens: 80, temperature: 0.2 });
    expect(bodyOf(0)).toMatchObject({ max_completion_tokens: 80, temperature: 0.2 });
    expect(bodyOf(0)).not.toHaveProperty('reasoning_effort');
  });

  it.each(['gpt-6-astra', 'gpt-5.5', 'o3'])('reasoning model %s: no temperature, low effort, reasoning headroom', async model => {
    fetchMock.mockResolvedValue(ok);
    await new OpenAIProvider('k', model, 'https://o', 100).complete('x', { maxTokens: 80, temperature: 0.2 });
    const body = bodyOf(0);
    expect(body).not.toHaveProperty('temperature');
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_completion_tokens).toBeGreaterThan(80 + 500);
  });

  it('falls back to max_tokens for servers that reject max_completion_tokens', async () => {
    fetchMock.mockResolvedValueOnce(bad('Unrecognized request argument: max_completion_tokens')).mockResolvedValueOnce(ok);
    await expect(new OpenAIProvider('k', 'llama', 'http://compat', 100).complete('x', { maxTokens: 50 })).resolves.toBe('hi');
    expect(bodyOf(1)).toMatchObject({ max_tokens: 50 });
    expect(bodyOf(1)).not.toHaveProperty('max_completion_tokens');
  });

  it('drops temperature or reasoning_effort when the API refuses them, then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(bad("'temperature' does not support 0.2")).mockResolvedValueOnce(ok);
    await new OpenAIProvider('k', 'gpt-4o', 'https://o', 100).complete('x', { temperature: 0.2 });
    expect(bodyOf(1)).not.toHaveProperty('temperature');

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(bad('Unknown parameter: reasoning_effort')).mockResolvedValueOnce(ok);
    await new OpenAIProvider('k', 'gpt-6-astra', 'https://o', 100).complete('x');
    expect(bodyOf(1)).not.toHaveProperty('reasoning_effort');
  });

  it('surfaces unrelated 400s immediately', async () => {
    fetchMock.mockResolvedValue(bad('invalid api key format'));
    await expect(new OpenAIProvider('k', 'gpt-4o', 'https://o', 100).complete('x')).rejects.toThrow(/OpenAI 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
