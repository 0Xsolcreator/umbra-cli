import * as fs from 'node:fs/promises';

import type {GetUmbraClientDeps, MasterSeed} from '@umbra-privacy/sdk';

import {CONFIG_DIR, SEED_PATH} from '../paths.js';

type SeedStorage = NonNullable<GetUmbraClientDeps['masterSeedStorage']>;

export function createFileSeedStorage(): SeedStorage {
	return {
		load: async () => {
			try {
				const bytes = await fs.readFile(SEED_PATH);
				return {exists: true, seed: bytes as unknown as MasterSeed};
			} catch (err: unknown) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return {exists: false};
				}

				throw err;
			}
		},
		store: async (seed: MasterSeed) => {
			await fs.mkdir(CONFIG_DIR, {recursive: true});
			await fs.writeFile(SEED_PATH, seed as unknown as Uint8Array);
			await fs.chmod(SEED_PATH, 0o600);
			return {success: true};
		},
	};
}
