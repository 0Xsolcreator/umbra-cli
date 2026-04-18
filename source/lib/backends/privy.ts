import {createPrivySigner} from '@solana/keychain-privy';

import {getSecret} from '../secrets.js';
import type {BackendDefinition} from './types.js';

const ENV_APP_SECRET = 'PRIVY_APP_SECRET';

export const privyBackend: BackendDefinition = {
	name: 'privy',
	description: 'Privy-managed wallet (requires Privy app credentials)',
	params: [
		{
			name: 'appId',
			required: true,
			description: 'Privy application ID',
		},
		{
			name: 'walletId',
			required: true,
			description: 'Privy wallet ID',
		},
		{
			name: 'apiBaseUrl',
			required: false,
			description:
				'Custom Privy API base URL (default: https://api.privy.io/v1)',
		},
	],
	envSecrets: [
		{
			key: ENV_APP_SECRET,
			description: 'Privy application secret',
		},
	],
	async buildSigner(params, ctx) {
		const appSecret = await getSecret(ctx.userName, ENV_APP_SECRET);
		if (!appSecret) {
			throw new Error(
				`Missing Privy application secret for user "${ctx.userName}". ` +
					`Set it via "umbra user add" (saved to the OS keychain), or export ` +
					`${ENV_APP_SECRET}=... before running commands.`,
			);
		}

		return createPrivySigner({
			appId: params['appId']!,
			walletId: params['walletId']!,
			appSecret,
			apiBaseUrl: params['apiBaseUrl'],
		});
	},
};
