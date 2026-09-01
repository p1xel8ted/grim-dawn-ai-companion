/**
 * This app's own data directory:
 *
 * - macOS: `~/Library/Application Support/gd-ai-companion/`
 * - Windows: `%APPDATA%\gd-ai-companion`
 *
 * ```
 *   settings.json
 *   window.json                   geometry, written on every drag
 *   advice/<character>/*.json     stored advice runs
 * ```
 *
 * Deliberately *not* where the game database cache lives. That cache is keyed by
 * a fingerprint of the install's archives, costs half a minute to build and says
 * nothing about which app asked for it, so it sits under a shared root
 * (`defaultCacheRoot` in `db/cache.ts`) that a sibling tool can hit warm. What is
 * left here is what this app chose or wrote, and nothing else has any business
 * reading it.
 *
 * `GD_DATA_DIR` exists so tests can run against a throwaway directory. It steers
 * the cache too — one variable isolates an entire run.
 *
 * The directory was `gd-companion` before the app was named, and the old one is
 * deliberately **not** read or moved: everything in it is either a preference
 * worth setting again in a pane that now exists, or a cache that rebuilds itself
 * from the install in half a minute. Migrating a pre-1.0 cache is a code path
 * that would be wrong exactly once and never exercised again.
 *
 * Windows builds before this fix also wrote this app's data below the macOS-shaped
 * directory in the user's home. That directory is deliberately not migrated:
 * the platform fix starts at the native path, while the old files remain on
 * disk for manual recovery if wanted. The shared game-data cache likewise
 * rebuilds once at its native Windows location.
 */

import { homedir, platform as hostPlatform } from 'node:os';
import { join, win32 } from 'node:path';

export interface AppDataDirOptions {
  /** Injectable so every platform path is testable on every host. */
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
}

export function appDataDir(opts: AppDataDirOptions = {}): string {
  const env = opts.env ?? process.env;
  if (env.GD_DATA_DIR !== undefined) return env.GD_DATA_DIR;

  const host = opts.platform ?? hostPlatform();
  const home = opts.home ?? homedir();
  if (host === 'win32') {
    const roaming = env.APPDATA || win32.join(home, 'AppData', 'Roaming');
    return win32.join(roaming, 'gd-ai-companion');
  }
  return join(home, 'Library/Application Support/gd-ai-companion');
}
