import {createTurnkeySigner} from '@solana/keychain-turnkey';

import {getSecret} from '../secrets.js';
import type {BackendDefinition} from './types.js';

const ENV_API_PRIVATE_KEY = 'TURNKEY_API_PRIVATE_KEY';

export const turnkeyBackend: BackendDefinition = {
	name: 'turnkey',
	description: 'Turnkey-managed wallet (requires Turnkey API credentials)',
	params: [
		{
			name: 'apiPublicKey',
			required: true,
			description: 'Turnkey API public key (hex-encoded)',
		},
		{
			name: 'organizationId',
			required: true,
			description: 'Turnkey organization ID',
		},
		{
			name: 'privateKeyId',
			required: true,
			description: 'Turnkey private key ID used for signing',
		},
		{
			name: 'publicKey',
			required: true,
			description:
				'Solana public key (base58) corresponding to the Turnkey private key',
		},
		{
			name: 'apiBaseUrl',
			required: false,
			description:
				'Custom Turnkey API base URL (default: https://api.turnkey.com)',
		},
	],
	envSecrets: [
		{
			key: ENV_API_PRIVATE_KEY,
			description: 'Turnkey API private key (hex-encoded, P256)',
		},
	],
	async buildSigner(params, ctx) {
		const apiPrivateKey = await getSecret(ctx.userName, ENV_API_PRIVATE_KEY);
		if (!apiPrivateKey) {
			throw new Error(
				`Missing Turnkey API private key for user "${ctx.userName}". ` +
					`Set it via "umbra user add" (saved to the OS keychain), or export ` +
					`${ENV_API_PRIVATE_KEY}=... before running commands.`,
			);
		}

		return createTurnkeySigner({
			apiPublicKey: params['apiPublicKey']!,
			apiPrivateKey,
			organizationId: params['organizationId']!,
			privateKeyId: params['privateKeyId']!,
			publicKey: params['publicKey']!,
			apiBaseUrl: params['apiBaseUrl'],
		});
	},
};
