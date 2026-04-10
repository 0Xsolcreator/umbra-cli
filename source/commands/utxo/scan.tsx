import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {type U32} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {createUtxoScanner} from '../../lib/umbra/scanner.js';
import {
	Spinner,
	ErrorMessage,
	UtxoGroup,
	type UtxoEntry,
} from '../../components/index.js';
import {formatFetchUtxosError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

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
	| ErrorState;

function toEntries(
	utxos: {amount: bigint; insertionIndex: bigint}[],
): UtxoEntry[] {
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
				setState({status: 'error', message: formatFetchUtxosError(err)});
			}
		}

		void run();
	}, []);

	if (state.status === 'scanning') return <Spinner label={state.stepLabel} />;
	if (state.status === 'error')
		return <ErrorMessage title="Scan failed" detail={state.message} />;

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
					<Text dimColor>
						Next scan start: {state.nextScanStartIndex.toString()}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}
