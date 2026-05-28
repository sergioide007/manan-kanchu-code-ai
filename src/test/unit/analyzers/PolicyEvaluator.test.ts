import { PolicyEvaluator } from '../../../analyzers/PolicyEvaluator';

const evaluator = new PolicyEvaluator();

describe('PolicyEvaluator', () => {
  it('detects eval violation', () => {
    const code = `const result = eval(input);`;
    const result = evaluator.evaluate(code, 'test.ts');
    const evalViol = result.violations.find(v => v.ruleId === 'no-eval');
    expect(evalViol).toBeDefined();
  });

  it('passes eval rule on clean code', () => {
    const code = `const result = JSON.parse(input);`;
    const result = evaluator.evaluate(code, 'test.ts', ['no-eval']);
    expect(result.passed).toContain('no-eval');
  });

  it('computes score as percentage of passing rules', () => {
    const code = `eval(x); const a = 1;`;
    const result = evaluator.evaluate(code, 'test.ts', ['no-eval', 'no-innerHTML']);
    const totalRules = 2;
    const passing = result.passed.length;
    expect(result.score).toBe(Math.round(passing / totalRules * 100));
  });

  it('returns 100 score for all passing', () => {
    const code = `const x = 1 + 2;`;
    const result = evaluator.evaluate(code, 'test.ts', ['no-eval', 'no-innerHTML']);
    expect(result.score).toBe(100);
  });

  it('detects innerHTML violation', () => {
    const code = `div.innerHTML = userContent;`;
    const result = evaluator.evaluate(code, 'app.ts', ['no-innerHTML']);
    expect(result.violations.some(v => v.ruleId === 'no-innerHTML')).toBe(true);
  });

  it('detects hardcoded secret', () => {
    const code = `const password = "secretpassword123";`;
    const result = evaluator.evaluate(code, 'config.ts', ['no-hardcoded-secrets']);
    expect(result.violations.some(v => v.ruleId === 'no-hardcoded-secrets')).toBe(true);
  });

  it('uses all built-in rules when no active list provided', () => {
    const code = `const x = 1;`;
    const result = evaluator.evaluate(code, 'test.ts');
    expect(result.passed.length + result.violations.length).toBeGreaterThan(0);
  });

  it('includes violation line numbers', () => {
    const code = `line1\nline2\neval(x)\nline4`;
    const result = evaluator.evaluate(code, 'test.ts', ['no-eval']);
    const v = result.violations.find(x => x.ruleId === 'no-eval');
    expect(v?.line).toBeGreaterThanOrEqual(1);
  });
});
