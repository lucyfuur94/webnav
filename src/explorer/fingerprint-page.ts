import type { SnapNode } from '../playwright/snapshot.js';
import type { DeclaredLink } from '../mapstore/record.js';

/**
 * The structural signature of a page: the sorted, deduped set of element ROLES
 * present. Two pages of the same TYPE (a repo-detail vs another repo-detail)
 * share a fingerprint; instances collapse. Purely mechanical — no judgment.
 */
export function fingerprintPage(nodes: SnapNode[]): string[] {
  return [...new Set(nodes.map((n) => n.role))].sort();
}

/** The navigable links a page declares: role 'link' WITH a url. `via` mirrors
 *  deriveEdges' phrasing so analysed edges read consistently with the rest. */
export function declaredLinks(nodes: SnapNode[]): DeclaredLink[] {
  const out: DeclaredLink[] = [];
  for (const n of nodes) {
    if (n.role !== 'link' || !n.url) continue;
    out.push({ to: n.url, via: `follow link "${n.name ?? n.url}"` });
  }
  return out;
}
