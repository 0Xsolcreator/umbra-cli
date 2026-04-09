import {createSignerFromPrivateKeyBytes} from '@umbra-privacy/sdk';

import * as fs from 'node:fs/promises';

export async function createSignerFromKeypairFile(
	filePath: string,
): ReturnType<typeof createSignerFromPrivateKeyBytes> {
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
	const privateKeyBytes = new Uint8Array(parsed as number[]);
	return createSignerFromPrivateKeyBytes(privateKeyBytes);
}
