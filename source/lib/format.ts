import * as os from 'node:os';

/** Replace the current user's home directory prefix with `~`. */
export function shortenPath(p: string): string {
	return p.replace(os.homedir(), '~');
}
