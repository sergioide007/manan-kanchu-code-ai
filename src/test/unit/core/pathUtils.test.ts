import * as path from 'path';
import { isInside, resolveAgainst, resolveInside } from '../../../core/pathUtils';

const root = path.resolve('/workspace/project');

describe('pathUtils', () => {
  it('resolves relative paths against the workspace root', () => {
    expect(resolveAgainst(root, 'src/app.ts')).toBe(path.join(root, 'src', 'app.ts'));
  });

  it('keeps absolute paths untouched', () => {
    const abs = path.resolve('/elsewhere/file.ts');
    expect(resolveAgainst(root, abs)).toBe(abs);
  });

  it('isInside accepts the root itself and descendants', () => {
    expect(isInside(root, root)).toBe(true);
    expect(isInside(root, path.join(root, 'a', 'b.ts'))).toBe(true);
  });

  it('isInside rejects siblings, parents and empty roots', () => {
    expect(isInside(root, path.resolve('/workspace/other'))).toBe(false);
    expect(isInside(root, path.resolve('/workspace'))).toBe(false);
    expect(isInside(root, path.resolve('/workspace/project-evil/x'))).toBe(false);
    expect(isInside('', path.join(root, 'a'))).toBe(false);
  });

  it('resolveInside blocks traversal and absolute escapes', () => {
    expect(resolveInside(root, 'a/b.ts')).toBe(path.join(root, 'a', 'b.ts'));
    expect(() => resolveInside(root, '../secrets.txt')).toThrow(/escapes/);
    expect(() => resolveInside(root, path.resolve('/etc/passwd'))).toThrow(/escapes/);
    expect(() => resolveInside(root, 'a/../../x')).toThrow(/escapes/);
  });
});
