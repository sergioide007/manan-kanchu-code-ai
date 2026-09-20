import * as path from 'path';

/**
 * Resolves `target` against `root` when it is relative, and returns an absolute path.
 * Scan results store project files relative to the workspace root, so every consumer
 * that reads or writes those files must resolve them first.
 */
export function resolveAgainst(root: string, target: string): string {
  if (path.isAbsolute(target)) return path.normalize(target);
  return path.resolve(root || process.cwd(), target);
}

/** True when `child` is `root` itself or lives somewhere below it. */
export function isInside(root: string, child: string): boolean {
  if (!root) return false;
  const rel = path.relative(path.resolve(root), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolves `target` against `root` and throws if the result escapes `root`
 * (path traversal via `..` or an absolute path).
 */
export function resolveInside(root: string, target: string): string {
  const abs = resolveAgainst(root, target);
  if (!isInside(root, abs)) {
    throw new Error(`Path escapes the workspace: ${target}`);
  }
  return abs;
}
