import * as fs from 'node:fs/promises';

import React, {useEffect, useState} from 'react';
import {Text} from 'ink';
import zod from 'zod';

import {writeConfig} from '../lib/config.js';
import {createSignerFromKeypairFile} from '../lib/umbra/signer.js';
import {DEFAULT_INDEXER_ENDPOINT, NETWORK_DEFAULTS} from '../lib/constants.js';
import {DEFAULT_KEYPAIR_PATH} from '../lib/paths.js';

export const options = zod.object({
	keypair: zod
		.string()
		.default(DEFAULT_KEYPAIR_PATH)
		.describe('Path to Solana keypair JSON file'),
	network: zod
		.enum(['mainnet', 'devnet', 'localnet'])
		.default('devnet')
		.describe('Solana network'),
	rpcUrl: zod.string().optional().describe('HTTP RPC endpoint URL'),
	rpcSubscriptionsUrl: zod
		.string()
		.optional()
		.describe('WebSocket RPC endpoint URL'),
	indexerEndpoint: zod
		.string()
		.default(DEFAULT_INDEXER_ENDPOINT)
		.describe('Umbra indexer API base URL'),
	deferMasterSeed: zod
		.boolean()
		.default(false)
		.describe('Defer master seed signature to first operation'),
});

type Props = {
	options: zod.infer<typeof options>;
};

type State =
	| {status: 'running'}
	| {status: 'success'}
	| {status: 'error'; message: string};

export default function Init({options: opts}: Props) {
	const [state, setState] = useState<State>({status: 'running'});

	useEffect(() => {
		async function run() {
			// Verify the keypair file exists
			try {
				await fs.access(opts.keypair);
			} catch {
				setState({
					status: 'error',
					message: `Keypair file not found: ${opts.keypair}`,
				});
				return;
			}

			// Validate it is a Solana keypair
			try {
				await createSignerFromKeypairFile(opts.keypair);
			} catch (err: unknown) {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
				return;
			}

			const networkDefaults = NETWORK_DEFAULTS[opts.network];

			await writeConfig({
				network: opts.network,
				rpcUrl: opts.rpcUrl ?? networkDefaults.rpcUrl,
				rpcSubscriptionsUrl:
					opts.rpcSubscriptionsUrl ?? networkDefaults.rpcSubscriptionsUrl,
				walletPath: opts.keypair,
				indexerApiEndpoint: opts.indexerEndpoint,
				deferMasterSeedSignature: opts.deferMasterSeed,
			});

			setState({status: 'success'});
		}

		void run();
	}, []);

	if (state.status === 'running') {
		return <Text>Initializing...</Text>;
	}

	if (state.status === 'error') {
		return <Text color="red">Error: {state.message}</Text>;
	}

	return (
		<Text color="green">
			Umbra CLI initialized. Config saved to ~/.umbra-cli/config.json
		</Text>
	);
}
