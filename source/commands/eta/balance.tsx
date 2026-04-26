import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
import {getEncryptedBalanceQuerierFunction} from '@umbra-privacy/sdk';
import {type QueryEncryptedBalanceResult} from '@umbra-privacy/sdk/interfaces';
import {address, type Address} from '@solana/kit';

import {getClient} from '../../lib/umbra/client.js';
import {fetchSupportedMints} from '../../lib/relayer.js';
import {Spinner, ErrorMessage, MintPicker} from '../../components/index.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	args: string[];
	options: {all: boolean};
};

type BalanceEntry = {mint: Address; result: QueryEncryptedBalanceResult};

type State =
	| {status: 'picking'}
	| {status: 'fetching-all'}
	| {status: 'querying'; mints: string[]}
	| {status: 'success'; entries: BalanceEntry[]}
	| ErrorState;

function BalanceRow({mint, result}: BalanceEntry) {
	const short = `${mint.slice(0, 4)}…${mint.slice(-4)}`;

	if (result.state === 'shared') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text color="green">{String(result.balance)}</Text>
			</Box>
		);
	}

	if (result.state === 'mxe') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text color="yellow">MXE mode (cannot decrypt client-side)</Text>
			</Box>
		);
	}

	if (result.state === 'uninitialized') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text dimColor>uninitialized</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Box width={12}>
				<Text dimColor>{short}</Text>
			</Box>
			<Text dimColor>no balance — deposit first</Text>
		</Box>
	);
}

export default function Balance({args: initialMints, options: {all}}: Props) {
	const {exit} = useApp();

	const initialState: State = all
		? {status: 'fetching-all'}
		: initialMints.length > 0
			? {status: 'querying', mints: initialMints}
			: {status: 'picking'};

	const [state, setState] = useState<State>(initialState);

	useEffect(() => {
		if (state.status !== 'fetching-all') return;
		fetchSupportedMints()
			.then(mints => setState({status: 'querying', mints: [...mints]}))
			.catch((err: unknown) => {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
				exit();
			});
	}, [state.status]);

	useEffect(() => {
		if (state.status !== 'querying') return;
		const {mints} = state;
		async function run() {
			try {
				const client = await getClient();
				const query = getEncryptedBalanceQuerierFunction({client});
				const balances = await query(mints.map(m => address(m)));
				const entries: BalanceEntry[] = [...balances.entries()].map(
					([mint, result]) => ({mint, result}),
				);
				setState({status: 'success', entries});
				exit();
			} catch (err: unknown) {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
				exit();
			}
		}

		void run();
	}, [state.status]);

	if (state.status === 'picking')
		return (
			<MintPicker
				onSelect={mint => setState({status: 'querying', mints: [mint]})}
				onError={message => {
					setState({status: 'error', message});
					exit();
				}}
			/>
		);

	if (state.status === 'fetching-all' || state.status === 'querying')
		return <Spinner label="Fetching encrypted balances..." />;

	if (state.status === 'error')
		return <ErrorMessage title="Balance query failed" detail={state.message} />;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Encrypted balances</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				{state.entries.map((entry: BalanceEntry) => (
					<BalanceRow key={entry.mint} {...entry} />
				))}
			</Box>
		</Box>
	);
}

export class BalanceCommand extends Command {
	static override description = 'Check your encrypted token ETA balances';

	static override strict = false;

	static override args = {
		mints: Args.string({
			description: 'Mint address(es) to query — omit to pick interactively',
			required: false,
		}),
	};

	static override flags = {
		all: Flags.boolean({
			description: 'Query all tokens supported by the relayer',
			default: false,
		}),
	};

	async run() {
		const {argv, flags} = await this.parse(BalanceCommand);
		const {waitUntilExit} = render(
			<Balance args={argv as string[]} options={{all: flags.all}} />,
		);
		await waitUntilExit();
	}
}
