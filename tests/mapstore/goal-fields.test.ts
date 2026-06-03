import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { MapStore } from '../../src/mapstore/store.js';

const GOAL = {
  name: 'github-repos', site: 'github.com',
  entry: 'https://github.com/search?q={query}&type=repositories',
  extractor: 'github-repo-signals',
  visit: ['detail'], surface: { detail: ['stars'] }, candidateLimit: 5,
};

describe('Goal record site/entry/extractor', () => {
  it('round-trips the new fields through upsert/get', () => {
    const store = new MapStore(':memory:');
    store.upsertGoal(GOAL);
    const got = store.getGoal('github-repos');
    expect(got?.site).toBe('github.com');
    expect(got?.entry).toContain('{query}');
    expect(got?.extractor).toBe('github-repo-signals');
  });

  it('migrates a legacy goals table that lacks the new columns', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE goals (name TEXT PRIMARY KEY, visit TEXT NOT NULL,
      surface TEXT NOT NULL, candidate_limit INTEGER NOT NULL);`);
    db.prepare('INSERT INTO goals VALUES (?,?,?,?)').run(
      'old', '["detail"]', '{"detail":["stars"]}', 5);
    const store = MapStore.fromDatabase(db);
    const got = store.getGoal('old');
    expect(got).not.toBeNull();
    expect(got?.site == null).toBe(true);
  });
});
