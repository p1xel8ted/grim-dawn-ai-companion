import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backupsToPrune } from '../scripts/deploy-win.mjs';

const APP = 'Grim Dawn AI Companion';

describe('backupsToPrune', () => {
  it('keeps the newest and returns the rest oldest first', () => {
    const names = [
      `${APP}.backup-20260829-153206`,
      `${APP}.backup-20260901-204211`,
      `${APP}.backup-20260830-113823`,
      `${APP}.backup-20260829-170706`,
    ];
    expect(backupsToPrune(names, APP, 2)).toEqual([
      `${APP}.backup-20260829-153206`,
      `${APP}.backup-20260829-170706`,
    ]);
  });

  it('prunes nothing when there are no more than the keep count', () => {
    const names = [`${APP}.backup-20260829-153206`, `${APP}.backup-20260830-113823`];
    expect(backupsToPrune(names, APP, 3)).toEqual([]);
  });

  // The install itself sits in the same directory as its backups, and so does
  // every other app on the drive. Only this app's timestamped folders may go.
  it('ignores the live install and anything that is not a backup of it', () => {
    const names = [
      APP,
      'Some Other App',
      `${APP}.backup-20260829-153206`,
      `${APP}.backup-notatimestamp`,
      'Another App.backup-20260829-153206',
      `${APP}.backup-20260830-113823`,
    ];
    expect(backupsToPrune(names, APP, 1)).toEqual([`${APP}.backup-20260829-153206`]);
  });

  it('refuses to prune when asked to keep none, rather than deleting every backup', () => {
    const names = [`${APP}.backup-20260829-153206`, `${APP}.backup-20260830-113823`];
    expect(() => backupsToPrune(names, APP, 0)).toThrow(/at least one/i);
  });
});

/**
 * The CLI, driven as a subprocess over throwaway trees. A packaged build is a
 * third of a gigabyte; what these prove is which directory the script chooses
 * and what it refuses, so a few bytes standing in for `app.asar` is enough.
 */
describe('deploy-win CLI', () => {
  const SCRIPT = fileURLToPath(new URL('../scripts/deploy-win.mjs', import.meta.url));
  let root: string;

  const build = (name: string, marker: string): string => {
    const dir = join(root, name);
    mkdirSync(join(dir, 'resources'), { recursive: true });
    writeFileSync(join(dir, 'resources', 'app.asar'), marker);
    return dir;
  };

  const install = (name: string, marker = 'old'): string => {
    const dir = join(root, name);
    mkdirSync(join(dir, 'resources'), { recursive: true });
    writeFileSync(join(dir, 'resources', 'app.asar'), marker);
    return dir;
  };

  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: root,
      env: { ...process.env, GD_DEPLOY_DIR: '', GD_BUILD_DIR: '', ...env },
    });

  const installed = (dir: string): string => readFileSync(join(dir, 'resources', 'app.asar'), 'utf8');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gd-deploy-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('installs from the source given as the second argument', () => {
    const src = build('built', 'new');
    const dest = install('App');
    const r = run([dest, src]);
    expect(r.status).toBe(0);
    expect(installed(dest)).toBe('new');
  });

  it('prefers the argument over GD_BUILD_DIR', () => {
    const wanted = build('wanted', 'wanted');
    build('other', 'other');
    const dest = install('App');
    expect(run([dest, wanted], { GD_BUILD_DIR: join(root, 'other') }).status).toBe(0);
    expect(installed(dest)).toBe('wanted');
  });

  it('falls back to GD_BUILD_DIR when no argument is given', () => {
    const src = build('fromEnv', 'fromEnv');
    const dest = install('App');
    expect(run([dest], { GD_BUILD_DIR: src }).status).toBe(0);
    expect(installed(dest)).toBe('fromEnv');
  });

  it('still reads release/win-unpacked when given neither', () => {
    const src = build(join('release', 'win-unpacked'), 'default');
    expect(src).toContain('win-unpacked');
    const dest = install('App');
    expect(run([dest]).status).toBe(0);
    expect(installed(dest)).toBe('default');
  });

  it('names the directory it looked in, and leaves the install alone', () => {
    const dest = install('App');
    const r = run([dest, join(root, 'nothing-here')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('nothing-here');
    expect(installed(dest)).toBe('old');
    expect(readdirSync(root).filter((n) => n.includes('.backup-'))).toEqual([]);
  });

  it('refuses a source inside the target, which the backup rename would carry off', () => {
    const dest = install('App');
    const src = build(join('App', 'inner'), 'doomed');
    const r = run([dest, src]);
    expect(r.status).toBe(1);
    expect(installed(dest)).toBe('old');
    expect(readdirSync(root).filter((n) => n.includes('.backup-'))).toEqual([]);
    expect(existsSync(src)).toBe(true);
  });

  it('refuses a target inside the source, which the copy would recurse into', () => {
    const src = build('built', 'new');
    const dest = install(join('built', 'App'));
    const r = run([dest, src]);
    expect(r.status).toBe(1);
    expect(installed(dest)).toBe('old');
  });

  it('refuses a source that is the target itself, however it is spelled', () => {
    const dest = install('App', 'same');
    const r = run([dest, join(root, 'app')]);
    expect(r.status).toBe(1);
    expect(installed(dest)).toBe('same');
  });
});
