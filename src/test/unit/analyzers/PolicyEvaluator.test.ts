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

  describe('rules documented in the README', () => {
    it('no-debugger flags debugger statements and Python breakpoints', () => {
      for (const [code, file] of [['function f() {\n  debugger;\n}', 'a.ts'], ['breakpoint()', 'a.py'], ['import pdb; pdb.set_trace()', 'a.py']]) {
        expect(evaluator.evaluate(code, file, ['no-debugger']).violations).toHaveLength(1);
      }
    });

    it('no-debugger ignores the word in strings and prose', () => {
      const code = 'const msg = "use the debugger here";\n// how to attach a debugger\n';
      expect(evaluator.evaluate(code, 'a.ts', ['no-debugger']).violations).toHaveLength(0);
    });

    it('no-todo-comments flags TODO/FIXME in comments only', () => {
      expect(evaluator.evaluate('// TODO: refactor', 'a.ts', ['no-todo-comments']).violations).toHaveLength(1);
      expect(evaluator.evaluate('# FIXME later', 'a.py', ['no-todo-comments']).violations).toHaveLength(1);
      expect(evaluator.evaluate('/* TODO */', 'a.ts', ['no-todo-comments']).violations).toHaveLength(1);
      expect(evaluator.evaluate('const s = "TODO list";', 'a.ts', ['no-todo-comments']).violations).toHaveLength(0);
    });

    it('no-sql-injection flags concatenated and interpolated SQL', () => {
      const bad = [
        'db.query("SELECT * FROM users WHERE id = " + id);',
        "db.execute('DELETE FROM t WHERE a = ' + a);",
        'db.query(`SELECT * FROM users WHERE id = ${id}`);',
        'cursor.execute(f"SELECT * FROM users WHERE id = {uid}")',
      ];
      for (const code of bad) {
        expect(evaluator.evaluate(code, 'a.ts', ['no-sql-injection']).violations).toHaveLength(1);
      }
    });

    it('no-sql-injection accepts parameterized queries', () => {
      const ok = ['db.query("SELECT * FROM users WHERE id = $1", [id]);', "cursor.execute('SELECT 1')"];
      for (const code of ok) {
        expect(evaluator.evaluate(code, 'a.ts', ['no-sql-injection']).violations).toHaveLength(0);
      }
    });

    it('no-weak-crypto catches Node, Java and Python MD5/SHA-1 but not SHA-256', () => {
      for (const code of ["crypto.createHash('md5')", 'MessageDigest.getInstance("SHA-1")', 'hashlib.md5(data)', 'hashlib.sha1(data)']) {
        expect(evaluator.evaluate(code, 'a.ts', ['no-weak-crypto']).violations).toHaveLength(1);
      }
      expect(evaluator.evaluate("crypto.createHash('sha256'); hashlib.sha256(x)", 'a.ts', ['no-weak-crypto']).violations).toHaveLength(0);
    });

    it('every rule id listed in the README exists', () => {
      const ids = evaluator.getRules().map(r => r.id);
      for (const id of ['no-hardcoded-secrets', 'no-eval', 'no-innerHTML', 'license-compliance', 'no-weak-crypto',
        'gdpr-personal-data-logging', 'no-console-log', 'no-debugger', 'no-todo-comments', 'no-sql-injection']) {
        expect(ids).toContain(id);
      }
    });
  });
});
