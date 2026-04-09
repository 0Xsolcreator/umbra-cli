import * as fs from 'node:fs/promises';
import {createSignerFromPrivateKeyBytes} from '@umbra-privacy/sdk';

export async function createSignerFromKeypairFile(
	filePath: string,
): ReturnType<typeof createSignerFromPrivateKeyBytes> {
	const raw = await fs.readFile(filePath, 'utf-8');
	const parsed: unknown = JSON.parse(raw);

	if (
		!Array.isArray(parsed) ||
		parsed.length !== 64 ||
		!(parsed as unknown[]).every(
			(b) => typeof b === 'number' && b >= 0 && b <= 255,
		)
	) {
		throw new Error(
			`Invalid keypair file at "${filePath}": expected Solana keypair (64-byte array)`,
		);
	}

	// Solana keypair files are [privateKeySeed (32 bytes) | publicKey (32 bytes)].
	// createSignerFromPrivateKeyBytes expects only the 32-byte private key seed.
	const privateKeyBytes = new Uint8Array(parsed as number[]).slice(0, 32);
	return createSignerFromPrivateKeyBytes(privateKeyBytes);
}
