import { describe, expect, it } from 'vitest';

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
