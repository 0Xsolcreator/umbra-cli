import * as fs from 'node:fs/promises';

import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {Spinner, ErrorMessage, Row} from '../components/index.js';

import {type CliConfig, writeConfig} from '../lib/config.js';
import {createSignerFromKeypairFile} from '../lib/umbra/signer.js';
import {DEFAULT_INDEXER_ENDPOINT, NETWORK_DEFAULTS} from '../lib/constants.js';
import {CONFIG_PATH, DEFAULT_KEYPAIR_PATH} from '../lib/paths.js';
import {shortenPath} from '../lib/format.js';
import {type ErrorState} from '../lib/errors.js';

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
	| {status: 'success'; config: CliConfig}
	| ErrorState;

export default function Init({options: opts}: Props) {
	const [state, setState] = useState<State>({status: 'running'});

	useEffect(() => {
		async function run() {
			try {
				await fs.access(opts.keypair);
			} catch {
				setState({
					status: 'error',
					message: `Keypair file not found: ${opts.keypair}`,
				});
				return;
			}

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
			const config: CliConfig = {
				network: opts.network,
				rpcUrl: opts.rpcUrl ?? networkDefaults.rpcUrl,
				rpcSubscriptionsUrl:
					opts.rpcSubscriptionsUrl ?? networkDefaults.rpcSubscriptionsUrl,
				walletPath: opts.keypair,
				indexerApiEndpoint: opts.indexerEndpoint,
				deferMasterSeedSignature: opts.deferMasterSeed,
			};

			await writeConfig(config);
			setState({status: 'success', config});
		}

		void run();
	}, []);

	if (state.status === 'running')
		return <Spinner label="Initializing Umbra CLI..." />;
	if (state.status === 'error')
		return (
			<ErrorMessage title="Initialization failed" detail={state.message} />
		);

	const {config} = state;
	return (
		<Box flexDirection="column">
			<Text color="green">✓ Umbra CLI initialized</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				<Row label="Network" value={config.network} />
				<Row label="RPC" value={config.rpcUrl} />
				<Row label="WebSocket" value={config.rpcSubscriptionsUrl} />
				<Row label="Wallet" value={shortenPath(config.walletPath)} />
				{config.indexerApiEndpoint && (
					<Row label="Indexer" value={config.indexerApiEndpoint} />
				)}
				<Row label="Config" value={shortenPath(CONFIG_PATH)} />
			</Box>
		</Box>
	);
}
