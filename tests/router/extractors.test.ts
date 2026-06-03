import { describe, it, expect } from 'vitest';
import { getExtractor, EXTRACTOR_NAMES } from '../../src/router/extractors.js';

describe('extractor registry', () => {
  it('resolves the github-repo-signals extractor by name', () => {
    const fn = getExtractor('github-repo-signals');
    expect(typeof fn).toBe('function');
  });

  it('lists the known extractor names', () => {
    expect(EXTRACTOR_NAMES).toContain('github-repo-signals');
  });

  it('throws a clear error for an unknown extractor name', () => {
    expect(() => getExtractor('no-such-extractor')).toThrow(/unknown extractor/i);
  });
});
