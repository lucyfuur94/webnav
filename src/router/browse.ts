import { PlaywrightAdapter } from '../playwright/adapter.js';

// Minimal structural type so these helpers accept either a real PlaywrightAdapter
// or a fake (for tests). Only the methods we use are required.
export interface BrowseAdapter {
  open(url: string): Promise<string>;
  evalJs?(func: string): Promise<string>;
  network?(): Promise<string>;
  goBack?(): Promise<string>;
  reload?(): Promise<string>;
  close(): Promise<string>;
}

export type EvalResponse =
  | { status: 'done'; url: string; value: string }
  | { status: 'failed'; url: string; reason: string };

export type NetworkResponse =
  | { status: 'done'; url: string; requests: string }
  | { status: 'failed'; url: string; reason: string };

function newAdapter(): BrowseAdapter {
  return new PlaywrightAdapter(`browse-${Date.now()}`);
}

/** Open url, run a `() => value` JS expression in the page, return the value. */
export async function runEval(
  url: string,
  func: string,
  adapter: BrowseAdapter = newAdapter(),
): Promise<EvalResponse> {
  try {
    await adapter.open(url);
    const value = (await adapter.evalJs!(func)).trim();
    return { status: 'done', url, value };
  } catch (e) {
    return { status: 'failed', url, reason: String(e) };
  } finally {
    await adapter.close().catch(() => {});
  }
}

/** Open url, return the network requests the page issued (the API calls behind the DOM). */
export async function runNetwork(
  url: string,
  adapter: BrowseAdapter = newAdapter(),
): Promise<NetworkResponse> {
  try {
    await adapter.open(url);
    const requests = (await adapter.network!()).trim();
    return { status: 'done', url, requests };
  } catch (e) {
    return { status: 'failed', url, reason: String(e) };
  } finally {
    await adapter.close().catch(() => {});
  }
}
