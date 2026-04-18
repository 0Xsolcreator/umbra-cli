import * as fs from 'node:fs/promises';

import type {GetUmbraClientDeps, MasterSeed} from '@umbra-privacy/sdk';

import {SEEDS_DIR, seedFilePath} from '../paths.js';
import {assertValidUserName} from '../users.js';

type SeedStorage = NonNullable<GetUmbraClientDeps['masterSeedStorage']>;

/**
 * Per-user master-seed storage. Seeds live at `~/.umbra-cli/seeds/<name>.seed`
 * with mode 0o600 so that multiple users configured on the same machine
 * do not share a single seed file.
 *
 * The previous single-file layout (`~/.umbra-cli/master.seed`) has been
 * removed — there is no automatic migration because this project is
 * pre-1.0 and the new multi-user model makes the old path ambiguous.
 */
export function createFileSeedStorage(userName: string): SeedStorage {
	assertValidUserName(userName);
	const seedPath = seedFilePath(userName);

	return {
		load: async () => {
			try {
				const bytes = await fs.readFile(seedPath);
				return {exists: true, seed: bytes as unknown as MasterSeed};
			} catch (err: unknown) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return {exists: false};
				}

				throw err;
			}
		},
		store: async (seed: MasterSeed) => {
			await fs.mkdir(SEEDS_DIR, {recursive: true});
			await fs.writeFile(seedPath, seed as unknown as Uint8Array);
			await fs.chmod(seedPath, 0o600);
			return {success: true};
		},
	};
}
