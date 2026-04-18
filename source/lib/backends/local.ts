import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {createKeyPairSignerFromBytes} from '@solana/kit';
import type {SolanaSigner} from '@solana/keychain-core';

import type {BackendDefinition} from './types.js';

const DEFAULT_KEYPAIR_PATH = path.join(
	os.homedir(),
	'.config',
	'solana',
	'id.json',
);

async function readKeypairFile(filePath: string): Promise<Uint8Array> {
	const raw = await fs.readFile(filePath, 'utf-8');
	const parsed: unknown = JSON.parse(raw);

	if (
		!Array.isArray(parsed) ||
		parsed.length !== 64 ||
		!(parsed as unknown[]).every(
			b => typeof b === 'number' && b >= 0 && b <= 255,
		)
	) {
		throw new Error(
			`Invalid keypair file at "${filePath}": expected Solana keypair (64-byte array)`,
		);
	}

	return new Uint8Array(parsed as number[]);
}

export const localBackend: BackendDefinition = {
	name: 'local',
	description:
		'Local Solana keypair file (same format as solana-keygen / solana-cli)',
	params: [
		{
			name: 'keypair',
			required: false,
			description: `Path to keypair JSON file (default: ${DEFAULT_KEYPAIR_PATH})`,
		},
	],
	envSecrets: [],
	async buildSigner(params, _ctx): Promise<SolanaSigner> {
		const keypairPath = params['keypair'] ?? DEFAULT_KEYPAIR_PATH;
		const bytes = await readKeypairFile(keypairPath);
		const kps = await createKeyPairSignerFromBytes(bytes);

		return {
			address: kps.address,
			async isAvailable() {
				return true;
			},
			signTransactions: kps.signTransactions.bind(kps),
			signMessages: kps.signMessages.bind(kps),
		};
	},
};
