import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli.js';

describe('parseArgs — use dispatcher', () => {
  it('use recall parses the same as bare recall', () => {
    expect(parseArgs(['use', 'recall', 'python retry'])).toEqual(parseArgs(['recall', 'python retry']));
  });
  it('use search parses the same as bare search', () => {
    expect(parseArgs(['use', 'search', 'rust orm'])).toEqual(parseArgs(['search', 'rust orm']));
  });
  it('use --help shows use help', () => {
    expect(parseArgs(['use', '--help'])).toEqual({ cmd: 'use-help' });
  });
});
