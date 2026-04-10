import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {isFetchUtxosError} from '@umbra-privacy/sdk/errors';
import {type U32} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {createUtxoScanner} from '../../lib/umbra/scanner.js';

export const options = zod.object({
	tree: zod.coerce
		.bigint()
		.optional()
		.describe('Merkle tree index to scan (default: 0)'),
	start: zod.coerce
		.bigint()
		.optional()
		.describe('Start insertion index, inclusive (default: 0)'),
	end: zod.coerce
		.bigint()
		.optional()
		.describe('End insertion index, inclusive (default: end of tree)'),
});

type Props = {
	options: zod.infer<typeof options>;
};

type UtxoEntry = {amount: bigint; insertionIndex: bigint};

type State =
	| {status: 'scanning'; stepLabel: string}
	| {
			status: 'success';
			selfBurnable: UtxoEntry[];
			received: UtxoEntry[];
			publicSelfBurnable: UtxoEntry[];
			publicReceived: UtxoEntry[];
			nextScanStartIndex: bigint;
	  }
	| {status: 'error'; message: string};

function toEntries(utxos: {amount: bigint; insertionIndex: bigint}[]): UtxoEntry[] {
	return utxos.map(u => ({amount: u.amount, insertionIndex: u.insertionIndex}));
}

export default function Scan({options: opts}: Props) {
	const [state, setState] = useState<State>({
		status: 'scanning',
		stepLabel: 'Scanning for UTXOs...',
	});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const tree = opts.tree ?? 0n;
				const start = opts.start ?? 0n;

				setState({
					status: 'scanning',
					stepLabel: `Scanning tree ${tree}...`,
				});

				const scan = createUtxoScanner(client);
				const result = await scan(
					tree as U32,
					start as U32,
					opts.end !== undefined ? (opts.end as U32) : undefined,
				);

				setState({
					status: 'success',
					selfBurnable: toEntries(result.selfBurnable),
					received: toEntries(result.received),
					publicSelfBurnable: toEntries(result.publicSelfBurnable),
					publicReceived: toEntries(result.publicReceived),
					nextScanStartIndex: result.nextScanStartIndex,
				});
			} catch (err: unknown) {
				let message: string;

				if (isFetchUtxosError(err)) {
					switch (err.stage) {
						case 'initialization': {
							message = `Indexer not configured — set indexerApiEndpoint in your config: ${err.message}`;
							break;
						}

						case 'validation': {
							message = `Invalid scan parameters: ${err.message}`;
							break;
						}

						case 'key-derivation': {
							message = `Key derivation failed: ${err.message}`;
							break;
						}

						case 'indexer-fetch': {
							message = `Indexer unreachable — check your connection: ${err.message}`;
							break;
						}

						case 'proof-fetch': {
							message = `Merkle proof fetch failed: ${err.message}`;
							break;
						}

						default: {
							message = `Scan failed at stage "${err.stage}": ${err.message}`;
						}
					}
				} else {
					message = err instanceof Error ? err.message : String(err);
				}

				setState({status: 'error', message});
			}
		}

		void run();
	}, []);

	if (state.status === 'scanning') {
		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> {state.stepLabel}</Text>
			</Box>
		);
	}

	if (state.status === 'error') {
		return (
			<Box flexDirection="column">
				<Text color="red">✗ Scan failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

	const total =
		state.selfBurnable.length +
		state.received.length +
		state.publicSelfBurnable.length +
		state.publicReceived.length;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Scan complete</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				{total === 0 ? (
					<Text dimColor>No UTXOs found in this range</Text>
				) : (
					<>
						{state.selfBurnable.length > 0 && (
							<UtxoGroup
								label="Self-claimable (encrypted)"
								utxos={state.selfBurnable}
							/>
						)}
						{state.publicSelfBurnable.length > 0 && (
							<UtxoGroup
								label="Self-claimable (public)"
								utxos={state.publicSelfBurnable}
							/>
						)}
						{state.received.length > 0 && (
							<UtxoGroup label="Received (encrypted)" utxos={state.received} />
						)}
						{state.publicReceived.length > 0 && (
							<UtxoGroup
								label="Received (public)"
								utxos={state.publicReceived}
							/>
						)}
					</>
				)}
				<Box marginTop={1}>
					<Text dimColor>Next scan start: {state.nextScanStartIndex.toString()}</Text>
				</Box>
			</Box>
		</Box>
	);
}

function UtxoGroup({label, utxos}: {label: string; utxos: UtxoEntry[]}) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text>
				{label}{' '}
				<Text color="cyan">{utxos.length}</Text>
			</Text>
			{utxos.map(u => (
				<Box key={u.insertionIndex.toString()} marginLeft={2}>
					<Text dimColor>
						· {u.amount.toString()} (index {u.insertionIndex.toString()})
					</Text>
				</Box>
			))}
		</Box>
	);
}
