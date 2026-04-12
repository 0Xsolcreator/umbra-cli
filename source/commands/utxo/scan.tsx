import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';

import {scanAcrossTrees} from '../../lib/umbra/scanner.js';
import {getClient} from '../../lib/umbra/client.js';
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
		.describe('First Merkle tree index to scan (default: 0)'),
	endTree: zod.coerce
		.bigint()
		.optional()
		.describe('Last Merkle tree index to scan, inclusive (default: same as --tree)'),
	allTrees: zod
		.boolean()
		.default(false)
		.describe('Scan all trees from --tree until no more are found'),
	start: zod.coerce
		.bigint()
		.optional()
		.describe('Start insertion index in the first tree, inclusive (default: 0)'),
	end: zod.coerce
		.bigint()
		.optional()
		.describe('End insertion index within each tree, inclusive (default: end of tree)'),
	pageSize: zod.coerce
		.bigint()
		.optional()
		.describe(
			'Number of insertion indices to cover per request (default: entire range)',
		),
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
			nextScanTreeIndex: bigint;
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

				const startTree = opts.tree ?? 0n;
				const endTree = opts.allTrees
					? undefined
					: (opts.endTree ?? startTree);
				const start = opts.start ?? 0n;

				const isMultiTree =
					opts.allTrees || (opts.endTree !== undefined && opts.endTree > startTree);

				setState({
					status: 'scanning',
					stepLabel: isMultiTree
						? `Scanning trees from ${startTree}...`
						: `Scanning tree ${startTree}...`,
				});

				const result = await scanAcrossTrees(
					client,
					startTree,
					endTree,
					start,
					opts.end,
					{
						pageSize: opts.pageSize,
						onProgress({treeIndex, page, nextStart}) {
							const treeLabel =
								endTree !== undefined
									? `tree ${treeIndex} of ${endTree}`
									: `tree ${treeIndex}`;
							const pageLabel =
								opts.pageSize !== undefined
									? ` — page ${page + 1} done, next index ${nextStart}`
									: '';
							setState({
								status: 'scanning',
								stepLabel: `Scanning ${treeLabel}${pageLabel}...`,
							});
						},
					},
				);

				setState({
					status: 'success',
					selfBurnable: toEntries(result.selfBurnable),
					received: toEntries(result.received),
					publicSelfBurnable: toEntries(result.publicSelfBurnable),
					publicReceived: toEntries(result.publicReceived),
					nextScanTreeIndex: result.nextScanTreeIndex,
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
						Next scan start: tree {state.nextScanTreeIndex.toString()}, index{' '}
						{state.nextScanStartIndex.toString()}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}
