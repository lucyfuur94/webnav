import { describe, it, expect } from 'vitest';
import { analyseObservations } from '../../src/explorer/analyse.js';
import type { StoredObservation } from '../../src/mapstore/record.js';

function obs(url: string, fingerprint: string[], links: { to: string; via: string }[] = [], seq = 0): StoredObservation {
  return { url, fingerprint, declaredLinks: links, seq, capturedAt: 0 };
}

describe('analyseObservations', () => {
  it('clusters same-fingerprint pages of one site into one state-type', () => {
    const r = analyseObservations([
      obs('https://github.com/a/x', ['heading', 'link'], [], 0),
      obs('https://github.com/b/y', ['heading', 'link'], [], 1),
      obs('https://github.com/search', ['searchbox'], [], 2),
    ]);
    expect(r.sites).toHaveLength(1);
    const gh = r.sites[0];
    expect(gh.node).toBe('github.com');
    expect(gh.states).toHaveLength(2); // detail-type (x2 pages) + search-type
    const detail = gh.states.find((s) => s.fingerprint.join(',') === 'heading,link')!;
    expect(detail.pageCount).toBe(2);
    expect(detail.sampleUrls).toContain('https://github.com/a/x');
    expect(detail.label).toMatch(/state-type-\d+/);
    // mechanical only — no prose field
    expect(Object.keys(detail)).not.toContain('description');
  });

  it('derives an intra-site edge when one observed page links to another observed type', () => {
    const r = analyseObservations([
      obs('https://github.com/search', ['searchbox', 'link'],
        [{ to: 'https://github.com/o/r', via: 'follow link "o/r"' }], 0),
      obs('https://github.com/o/r', ['heading'], [], 1),
    ]);
    const gh = r.sites[0];
    expect(gh.edges).toHaveLength(1);
    const from = gh.states.find((s) => s.fingerprint.includes('searchbox'))!.label;
    const to = gh.states.find((s) => s.fingerprint.join(',') === 'heading')!.label;
    expect(gh.edges[0]).toMatchObject({ from, to, via: 'follow link "o/r"' });
  });

  it('drops links whose target page was never observed', () => {
    const r = analyseObservations([
      obs('https://github.com/search', ['searchbox'],
        [{ to: 'https://github.com/never/seen', via: 'follow link "x"' }], 0),
    ]);
    expect(r.sites[0].edges).toHaveLength(0);
  });

  it('groups multiple sites separately and records cross-site edges', () => {
    const r = analyseObservations([
      obs('https://github.com/o/r', ['heading'],
        [{ to: 'https://pypi.org/project/r', via: 'follow link "PyPI"' }], 0),
      obs('https://pypi.org/project/r', ['heading', 'table'], [], 1),
    ]);
    expect(r.sites.map((s) => s.node).sort()).toEqual(['github.com', 'pypi.org']);
    expect(r.crossSiteEdges).toEqual([
      { from: 'github.com', to: 'pypi.org', via: 'follow link "PyPI"' },
    ]);
  });
});
