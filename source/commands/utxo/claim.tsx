import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Command, Flags} from '@oclif/core';
import {
	getSelfClaimableUtxoToEncryptedBalanceClaimerFunction,
	getSelfClaimableUtxoToPublicBalanceClaimerFunction,
	getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
	getUmbraRelayer,
} from '@umbra-privacy/sdk';
import {isFetchUtxosError} from '@umbra-privacy/sdk/errors';
import {
	getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
	getClaimSelfClaimableUtxoIntoPublicBalanceProver,
} from '@umbra-privacy/web-zk-prover';

import {getClient} from '../../lib/umbra/client.js';
import {scanAcrossTrees} from '../../lib/umbra/scanner.js';
import {bigintFlag} from '../../lib/flags.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatFetchUtxosError, formatClaimUtxoError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	options: {
		tree?: bigint;
		endTree?: bigint;
		allTrees: boolean;
		start?: bigint;
		end?: bigint;
		pageSize?: bigint;
		to: string;
		relayer: string;
	};
};

type BatchInfo = {
	batchIndex: string;
	txSignature?: string;
	status: string;
};

type State =
	| {status: 'scanning'; stepLabel: string}
	| {status: 'claiming'; stepLabel: string}
	| {status: 'nothing'}
	| {status: 'success'; claimedCount: number; batches: BatchInfo[]}
	| ErrorState;

function collectBatches(
	batchMap: Map<bigint, {status: string; txSignature?: string}>,
): BatchInfo[] {
	return [...batchMap.entries()].map(([index, batch]) => ({
		batchIndex: index.toString(),
		txSignature: batch.txSignature,
		status: batch.status,
	}));
}

export default function Claim({options: opts}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		status: 'scanning',
		stepLabel: 'Scanning for claimable UTXOs...',
	});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				if (!client.fetchBatchMerkleProof) {
					throw new Error(
						'Indexer not configured — set indexerApiEndpoint in your config.',
					);
				}

				// --- Scan ---
				const startTree = opts.tree ?? 0n;
				const endTree = opts.allTrees ? undefined : opts.endTree ?? startTree;

				const scanResult = await scanAcrossTrees(
					client,
					startTree,
					endTree,
					opts.start ?? 0n,
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

				const selfBurnableAll = [
					...scanResult.selfBurnable,
					...scanResult.publicSelfBurnable,
				];
				const receivedAll = [
					...scanResult.received,
					...scanResult.publicReceived,
				];
				const totalFound = selfBurnableAll.length + receivedAll.length;

				if (totalFound === 0) {
					setState({status: 'nothing'});
					exit();
					return;
				}

				setState({
					status: 'claiming',
					stepLabel: `Found ${totalFound} UTXO${
						totalFound === 1 ? '' : 's'
					} — generating proofs and claiming...`,
				});

				// --- Claim ---
				const {fetchBatchMerkleProof} = client;
				const relayer = getUmbraRelayer({apiEndpoint: opts.relayer});
				const allBatches: BatchInfo[] = [];

				if (selfBurnableAll.length > 0) {
					if (opts.to === 'public') {
						const zkProver =
							getClaimSelfClaimableUtxoIntoPublicBalanceProver();
						const claim = getSelfClaimableUtxoToPublicBalanceClaimerFunction(
							{client},
							{fetchBatchMerkleProof, zkProver, relayer},
						);
						const result = await claim(selfBurnableAll);
						allBatches.push(...collectBatches(result.batches));
					} else {
						const zkProver =
							getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
						const claim =
							getSelfClaimableUtxoToEncryptedBalanceClaimerFunction(
								{client},
								{fetchBatchMerkleProof, zkProver, relayer},
							);
						const result = await claim(selfBurnableAll);
						allBatches.push(...collectBatches(result.batches));
					}
				}

				if (receivedAll.length > 0) {
					const zkProver =
						getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
					const claim =
						getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
							{client},
							{fetchBatchMerkleProof, zkProver, relayer},
						);
					const result = await claim(receivedAll);
					allBatches.push(...collectBatches(result.batches));
				}

				setState({
					status: 'success',
					claimedCount: totalFound,
					batches: allBatches,
				});
				exit();
			} catch (err: unknown) {
				const message = isFetchUtxosError(err)
					? formatFetchUtxosError(err)
					: formatClaimUtxoError(err);
				setState({status: 'error', message});
				exit();
			}
		}

		void run();
	}, []);

	if (state.status === 'scanning' || state.status === 'claiming')
		return <Spinner label={state.stepLabel} />;
	if (state.status === 'error')
		return <ErrorMessage title="Claim failed" detail={state.message} />;

	if (state.status === 'nothing') {
		return <Text color="yellow">No claimable UTXOs found in this range</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text color="green">
				✓ Claimed {state.claimedCount} UTXO
				{state.claimedCount === 1 ? '' : 's'}
			</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				{state.batches.map(b => (
					<Box key={b.batchIndex} flexDirection="column">
						<Text dimColor>
							Batch {b.batchIndex}: {b.status}
							{b.txSignature ? ` — ${b.txSignature}` : ''}
						</Text>
					</Box>
				))}
			</Box>
		</Box>
	);
}

export class ClaimCommand extends Command {
	static override description = 'Claim scanned UTXOs to your wallet';

	static override flags = {
		tree: bigintFlag({
			description: 'First Merkle tree index to scan (default: 0)',
			required: false,
		}),
		endTree: bigintFlag({
			description:
				'Last Merkle tree index to scan, inclusive (default: same as --tree)',
			required: false,
		}),
		allTrees: Flags.boolean({
			description: 'Scan all trees from --tree until no more are found',
			default: false,
		}),
		start: bigintFlag({
			description: 'Start insertion index, inclusive (default: 0)',
			required: false,
		}),
		end: bigintFlag({
			description: 'End insertion index, inclusive (default: end of tree)',
			required: false,
		}),
		pageSize: bigintFlag({
			description:
				'Number of indices to cover per request for paginated scanning (default: entire range)',
			required: false,
		}),
		to: Flags.string({
			description:
				'Claim destination for self-claimable UTXOs: "encrypted" balance or "public" ATA (default: encrypted). Received UTXOs always go to encrypted.',
			options: ['encrypted', 'public'],
			default: 'encrypted',
		}),
		relayer: Flags.string({
			description: 'Relayer API endpoint',
			default: 'https://relayer.api-devnet.umbraprivacy.com',
		}),
	};

	async run() {
		const {flags} = await this.parse(ClaimCommand);
		const {waitUntilExit} = render(
			<Claim
				options={{
					tree: flags.tree,
					endTree: flags.endTree,
					allTrees: flags.allTrees,
					start: flags.start,
					end: flags.end,
					pageSize: flags.pageSize,
					to: flags.to,
					relayer: flags.relayer,
				}}
			/>,
		);
		await waitUntilExit();
	}
}
