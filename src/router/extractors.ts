import { extractRepoSignals } from './extract.js';

/** A named, deterministic extractor: (snapshotYaml, signalsToPull) -> signal map. */
export type Extractor = (snapshotYaml: string, signals: string[]) => Record<string, unknown>;

// The single seam where a new site's "how to read signals" plugs in. Add a site
// = register one extractor here + seed its Goal record (which names this key).
const REGISTRY: Record<string, Extractor> = {
  'github-repo-signals': extractRepoSignals,
};

export const EXTRACTOR_NAMES = Object.keys(REGISTRY);

/** Resolve an extractor by name; throws on an unknown name (misconfigured goal). */
export function getExtractor(name: string): Extractor {
  const fn = REGISTRY[name];
  if (!fn) throw new Error(`unknown extractor: ${name} (known: ${EXTRACTOR_NAMES.join(', ')})`);
  return fn;
}
