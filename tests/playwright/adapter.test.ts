import { describe, it, expect, vi } from 'vitest';
import { PlaywrightAdapter } from '../../src/playwright/adapter.js';

describe('PlaywrightAdapter', () => {
  it('builds session-scoped commands and counts calls', async () => {
    const calls: string[][] = [];
    const fakeRun = vi.fn(async (args: string[]) => { calls.push(args); return 'ok'; });
    const a = new PlaywrightAdapter('test-session', fakeRun);

    await a.goto('https://github.com');
    await a.click('e9');

    expect(calls[0]).toEqual(['-s=test-session', 'goto', 'https://github.com']);
    expect(calls[1]).toEqual(['-s=test-session', 'click', 'e9']);
    expect(a.callCount).toBe(2);
  });

  it('snapshot reads the YAML file path from stdout', async () => {
    const fakeRun = vi.fn(async () =>
      '### Page\n- Page URL: https://x\n### Snapshot\n- [Snapshot](.playwright-cli/page-1.yml)');
    const fakeReadFile = vi.fn((_p: string) => '- searchbox "Search" [ref=e8]');
    const a = new PlaywrightAdapter('s', fakeRun, fakeReadFile);
    const snap = await a.snapshot();
    expect(snap).toContain('searchbox');
    expect(fakeReadFile).toHaveBeenCalledWith('.playwright-cli/page-1.yml');
  });
});
