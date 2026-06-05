import { describe, it, expect } from 'vitest';
import { fingerprintPage, declaredLinks } from '../../src/explorer/fingerprint-page.js';
import type { SnapNode } from '../../src/playwright/snapshot.js';

function n(role: string, name: string | null = null, url: string | null = null, ref: string | null = null): SnapNode {
  return { role, name, url, ref, raw: '' } as SnapNode;
}

describe('fingerprintPage', () => {
  it('returns the sorted, deduped set of role tokens', () => {
    const fp = fingerprintPage([n('heading'), n('link', 'A'), n('link', 'B'), n('searchbox')]);
    expect(fp).toEqual(['heading', 'link', 'searchbox']);
  });
  it('two pages with the same role set produce the same fingerprint', () => {
    const a = fingerprintPage([n('heading'), n('link', 'X')]);
    const b = fingerprintPage([n('link', 'Y'), n('heading')]);
    expect(a).toEqual(b);
  });
});

describe('declaredLinks', () => {
  it('extracts link nodes that carry a url, as {to, via}', () => {
    const links = declaredLinks([
      n('link', 'Issues', 'https://github.com/o/r/issues'),
      n('link', null, 'https://github.com/o/r/pulls'),
      n('button', 'Star'), // not a link → ignored
      n('link', 'NoUrl'),  // link without url → ignored
    ]);
    expect(links).toEqual([
      { to: 'https://github.com/o/r/issues', via: 'follow link "Issues"' },
      { to: 'https://github.com/o/r/pulls', via: 'follow link "https://github.com/o/r/pulls"' },
    ]);
  });
});
