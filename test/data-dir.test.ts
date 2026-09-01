import { join, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';

import { appDataDir } from '../src/core/data-dir.js';

describe('appDataDir', () => {
  it('uses the native roaming app-data directory on Windows', () => {
    expect(
      appDataDir({
        platform: 'win32',
        env: { APPDATA: 'D:\\Profiles\\Player\\AppData\\Roaming' },
        home: 'D:\\Profiles\\Player',
      }),
    ).toBe('D:\\Profiles\\Player\\AppData\\Roaming\\gd-ai-companion');
  });

  it('falls back to the conventional roaming directory when APPDATA is absent', () => {
    expect(appDataDir({ platform: 'win32', env: {}, home: 'C:\\Users\\Player' })).toBe(
      win32.join('C:\\Users\\Player', 'AppData', 'Roaming', 'gd-ai-companion'),
    );
  });

  it('keeps the macOS Application Support directory', () => {
    expect(appDataDir({ platform: 'darwin', env: {}, home: '/Users/player' })).toBe(
      join('/Users/player', 'Library/Application Support/gd-ai-companion'),
    );
  });

  it('lets GD_DATA_DIR override the platform default exactly', () => {
    expect(appDataDir({ platform: 'win32', env: { GD_DATA_DIR: 'X:\\isolated' }, home: 'C:\\Users\\Player' })).toBe(
      'X:\\isolated',
    );
  });
});
