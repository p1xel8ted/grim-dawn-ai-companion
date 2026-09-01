/**
 * The deploy script is plain JS like the other scripts here, but its pruning
 * rule decides which directories get deleted, so it is unit tested. That test
 * compiles under the same strict settings as everything else and needs a type
 * for what it imports.
 */
export declare function backupsToPrune(names: readonly string[], appName: string, keep?: number): string[];
