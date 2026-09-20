import { friendlyModelName } from '../../../core/modelNames';

describe('friendlyModelName', () => {
  it.each([
    ['gpt-6-astra', 'GPT-6 Astra'],
    ['GPT-4o', 'GPT-4o'],
    ['claude-sonnet-4-6', 'Claude Sonnet 4.6'],
    ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5'],
    ['claude-opus-5', 'Claude Opus 5'],
    ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite'],
    ['codellama', 'codellama'],
    ['', ''],
  ])('%s → %s', (id, label) => {
    expect(friendlyModelName(id)).toBe(label);
  });
});
