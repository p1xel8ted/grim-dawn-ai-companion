/**
 * Copy the packaged Windows build over an installed copy of the app.
 *
 * `npm run dist:win` leaves `release/win-unpacked/`; this puts it where the app
 * is actually run from. The old install is renamed to a timestamped backup
 * first, so a bad build is one rename away from being undone, and the oldest
 * backups are pruned so they do not grow by 330 MB a deploy forever.
 *
 * The target is `GD_DEPLOY_DIR`, or the first argument. There is no default:
 * where somebody keeps their apps is theirs, and a path baked in here would be
 * wrong for everyone but the machine it was written on.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** How many timestamped backups survive a deploy. */
const KEEP_BACKUPS = 3;

const BUILD_DIR = 'release/win-unpacked';

/**
 * Which of `names` are this app's backups and are old enough to delete, oldest
 * first.
 *
 * The install lives beside its own backups and beside every other app on the
 * drive, so the match is deliberately narrow: the app's exact name, then
 * `.backup-`, then a timestamp shaped the way `stamp()` writes one. Anything
 * else is somebody else's folder.
 */
export function backupsToPrune(names, appName, keep = KEEP_BACKUPS) {
  if (keep < 1) throw new Error('refusing to prune: keep at least one backup');
  const prefix = `${appName}.backup-`;
  const dated = names
    .filter((n) => n.startsWith(prefix) && /^\d{8}-\d{6}$/.test(n.slice(prefix.length)))
    .sort();
  return dated.slice(0, Math.max(0, dated.length - keep));
}

/** `20260901-204211`, sortable as a string, which is what the pruning relies on. */
function stamp(now = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

function fail(message) {
  console.error(`deploy: ${message}`);
  process.exit(1);
}

function main() {
  const target = process.argv[2] ?? process.env.GD_DEPLOY_DIR;
  if (!target) {
    fail(
      'no target. Set GD_DEPLOY_DIR to the folder the app is installed in, or pass it as an argument:\n' +
        '  $env:GD_DEPLOY_DIR = "G:\\Applications\\Grim Dawn AI Companion"\n' +
        '  npm run deploy:win',
    );
  }

  const source = resolve(BUILD_DIR);
  if (!existsSync(join(source, 'resources', 'app.asar'))) {
    fail(`no packaged build at ${BUILD_DIR}. Run \`npm run dist:win\` first.`);
  }

  const dest = resolve(target);
  const appName = basename(dest);
  const parent = dirname(dest);
  if (!existsSync(parent)) fail(`${parent} does not exist, so ${appName} cannot be installed into it.`);

  const built = statSync(join(source, 'resources', 'app.asar')).mtime;
  console.log(`deploying build of ${built.toLocaleString()}`);

  if (existsSync(dest)) {
    const backup = join(parent, `${appName}.backup-${stamp()}`);
    renameSync(dest, backup);
    console.log(`backed up  ${basename(backup)}`);
  } else {
    mkdirSync(parent, { recursive: true });
  }

  cpSync(source, dest, { recursive: true });
  console.log(`installed  ${dest}`);

  for (const old of backupsToPrune(readdirSync(parent), appName)) {
    rmSync(join(parent, old), { recursive: true, force: true });
    console.log(`pruned     ${old}`);
  }
}

// Only run when invoked directly, so the test can import the pruning rule.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) main();
