import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
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
import {scanAllUtxos} from '../../lib/umbra/scanner.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatFetchUtxosError, formatClaimUtxoError} from '../../lib/errors.js';
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
	pageSize: zod.coerce
		.bigint()
		.optional()
		.describe(
			'Number of indices to cover per request for paginated scanning (default: entire range)',
		),
	to: zod
		.enum(['encrypted', 'public'])
		.default('encrypted')
		.describe(
			'Claim destination for self-claimable UTXOs: "encrypted" balance or "public" ATA (default: encrypted). Received UTXOs always go to encrypted.',
		),
	relayer: zod
		.string()
		.default('https://relayer.api.umbraprivacy.com')
		.describe('Relayer API endpoint'),
});

type Props = {
	options: zod.infer<typeof options>;
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
				const tree = opts.tree ?? 0n;
				const scanResult = await scanAllUtxos(
					client,
					tree,
					opts.start ?? 0n,
					opts.end,
					{
						pageSize: opts.pageSize,
						onProgress({page, nextStart}) {
							if (opts.pageSize !== undefined) {
								setState({
									status: 'scanning',
									stepLabel: `Scanning tree ${tree} — page ${page + 1} done, next index ${nextStart}...`,
								});
							}
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
						const zkProver = getClaimSelfClaimableUtxoIntoPublicBalanceProver();
						const claim = getSelfClaimableUtxoToPublicBalanceClaimerFunction(
							{client},
							{fetchBatchMerkleProof, zkProver, relayer},
						);
						const result = await claim(selfBurnableAll);
						allBatches.push(...collectBatches(result.batches));
					} else {
						const zkProver =
							getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
						const claim = getSelfClaimableUtxoToEncryptedBalanceClaimerFunction(
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
			} catch (err: unknown) {
				const message = isFetchUtxosError(err)
					? formatFetchUtxosError(err)
					: formatClaimUtxoError(err);
				setState({status: 'error', message});
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
