import * as fs from 'node:fs/promises';

import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Command, Flags} from '@oclif/core';

import {Spinner, ErrorMessage, Row} from '../components/index.js';
import {type CliConfig, writeConfig} from '../lib/config.js';
import {createSignerFromKeypairFile} from '../lib/umbra/signer.js';
import {DEFAULT_INDEXER_ENDPOINT, NETWORK_DEFAULTS} from '../lib/constants.js';
import {CONFIG_PATH, DEFAULT_KEYPAIR_PATH} from '../lib/paths.js';
import {shortenPath} from '../lib/format.js';
import {type ErrorState} from '../lib/errors.js';

type Props = {
	options: {
		keypair: string;
		network: 'mainnet' | 'devnet' | 'localnet';
		rpcUrl?: string;
		rpcSubscriptionsUrl?: string;
		indexerEndpoint: string;
		deferMasterSeed: boolean;
	};
};

type State =
	| {status: 'running'}
	| {status: 'success'; config: CliConfig}
	| ErrorState;

export default function Init({options: opts}: Props) {
	const {exit} = useApp();
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
				exit();
				return;
			}

			try {
				await createSignerFromKeypairFile(opts.keypair);
			} catch (err: unknown) {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
				exit();
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
			exit();
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

export class InitCommand extends Command {
	static override description = 'Link your keypair and configure the CLI';

	static override flags = {
		keypair: Flags.string({
			description: 'Path to Solana keypair JSON file',
			default: DEFAULT_KEYPAIR_PATH,
		}),
		network: Flags.string({
			description: 'Solana network',
			options: ['mainnet', 'devnet', 'localnet'],
			default: 'devnet',
		}),
		rpcUrl: Flags.string({
			description: 'HTTP RPC endpoint URL',
			required: false,
		}),
		rpcSubscriptionsUrl: Flags.string({
			description: 'WebSocket RPC endpoint URL',
			required: false,
		}),
		indexerEndpoint: Flags.string({
			description: 'Umbra indexer API base URL',
			default: DEFAULT_INDEXER_ENDPOINT,
		}),
		deferMasterSeed: Flags.boolean({
			description: 'Defer master seed signature to first operation',
			default: false,
		}),
	};

	async run() {
		const {flags} = await this.parse(InitCommand);
		const {waitUntilExit} = render(
			<Init
				options={{
					keypair: flags.keypair,
					network: flags.network as 'mainnet' | 'devnet' | 'localnet',
					rpcUrl: flags.rpcUrl,
					rpcSubscriptionsUrl: flags.rpcSubscriptionsUrl,
					indexerEndpoint: flags.indexerEndpoint,
					deferMasterSeed: flags.deferMasterSeed,
				}}
			/>,
		);
		await waitUntilExit();
	}
}
