import {createParaSigner} from '@solana/keychain-para';

import {getSecret} from '../secrets.js';
import type {BackendDefinition} from './types.js';

const ENV_API_KEY = 'PARA_API_KEY';

export const paraBackend: BackendDefinition = {
	name: 'para',
	description: 'Para-managed wallet (requires Para API key)',
	params: [
		{
			name: 'walletId',
			required: true,
			description: 'Para wallet UUID',
		},
		{
			name: 'apiBaseUrl',
			required: false,
			description: 'Custom Para API base URL (default: https://api.beta.getpara.com)',
		},
	],
	envSecrets: [
		{
			key: ENV_API_KEY,
			description: 'Para API key (server-side only)',
		},
	],
	async buildSigner(params, ctx) {
		const apiKey = await getSecret(ctx.userName, ENV_API_KEY);
		if (!apiKey) {
			throw new Error(
				`Missing Para API key for user "${ctx.userName}". ` +
					`Set it via "umbra user add" (saved to the OS keychain), or export ` +
					`${ENV_API_KEY}=... before running commands.`,
			);
		}

		return createParaSigner({
			walletId: params['walletId']!,
			apiKey,
			apiBaseUrl: params['apiBaseUrl'] ?? 'https://api.beta.getpara.com',
		});
	},
};
