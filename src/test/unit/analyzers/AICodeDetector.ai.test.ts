import { AICodeDetector } from '../../../analyzers/AICodeDetector';
import { AIProvider } from '../../../core/interfaces';

const CODE = `// helper\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n`;

const provider = (reply: string | Error): AIProvider => ({
  name: 'stub', type: 'ollama', modelName: 'stub-model',
  isAvailable: async () => true,
  chat: async () => ({ content: '', model: 'stub-model', usage: { promptTokens: 0, completionTokens: 0 } }),
  complete: async () => { if (reply instanceof Error) throw reply; return reply; },
});

describe('AICodeDetector — AI analysis path', () => {
  it('blends heuristic and AI scores using the configured weights', async () => {
    const heuristicOnly = await new AICodeDetector(null).analyzeCode(CODE, 'a.ts');
    const r = await new AICodeDetector(provider('{"score":1,"reason":"looks generated"}'), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    const expected = heuristicOnly.heuristicScore * 0.4 + 1 * 0.6;
    expect(r.aiAnalysisScore).toBe(1);
    expect(r.analysisModel).toBe('stub-model');
    expect(r.aiScore).toBeCloseTo(Math.min(1, Math.max(0, expected + (r.aiScore - expected))), 5);
    expect(r.aiScore).toBeGreaterThan(heuristicOnly.aiScore);
  });

  it('normalises weights that do not sum to 1', async () => {
    const a = await new AICodeDetector(provider('{"score":0.9}'), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    const b = await new AICodeDetector(provider('{"score":0.9}'), 4, 6).analyzeCode(CODE, 'a.ts');
    expect(b.aiScore).toBeCloseTo(a.aiScore, 10);
  });

  it('falls back to the heuristic score when both weights are 0', async () => {
    const r = await new AICodeDetector(provider('{"score":1}'), 0, 0).analyzeCode(CODE, 'a.ts');
    const h = await new AICodeDetector(null).analyzeCode(CODE, 'a.ts');
    expect(r.aiScore).toBeCloseTo(h.aiScore, 10);
  });

  it.each([
    ['a JSON reply without a numeric score', '{"reason":"no score here"}'],
    ['a non-numeric score', '{"score":"high"}'],
    ['free text', 'I cannot determine that.'],
    ['a provider error', new Error('network down')],
  ])('never produces NaN and reports heuristic-only for %s', async (_label, reply) => {
    const r = await new AICodeDetector(provider(reply as string | Error), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    expect(Number.isNaN(r.aiScore)).toBe(false);
    expect(r.analysisModel).toBe('heuristic-only');
    expect(r.aiAnalysisScore).toBe(r.heuristicScore);
  });

  it('accepts a numeric string score and clamps out-of-range values', async () => {
    const r = await new AICodeDetector(provider('{"score":"0.7"}'), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    expect(r.aiAnalysisScore).toBe(0.7);
    const hi = await new AICodeDetector(provider('{"score":7}'), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    expect(hi.aiAnalysisScore).toBe(1);
  });

  it('falls back to a bare number when the JSON is malformed', async () => {
    const r = await new AICodeDetector(provider('{score: 0.8}'), 0.4, 0.6).analyzeCode(CODE, 'a.ts');
    expect(r.aiAnalysisScore).toBe(0.8);
  });
});
