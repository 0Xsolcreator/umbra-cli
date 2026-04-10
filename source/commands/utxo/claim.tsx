import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {
	getSelfClaimableUtxoToEncryptedBalanceClaimerFunction,
	getSelfClaimableUtxoToPublicBalanceClaimerFunction,
	getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
	getUmbraRelayer,
} from '@umbra-privacy/sdk';
import {isClaimUtxoError, isFetchUtxosError} from '@umbra-privacy/sdk/errors';
import {
	getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
	getClaimSelfClaimableUtxoIntoPublicBalanceProver,
} from '@umbra-privacy/web-zk-prover';
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
	| {status: 'error'; message: string};

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
				const scan = createUtxoScanner(client);
				const scanResult = await scan(
					(opts.tree ?? 0n) as U32,
					(opts.start ?? 0n) as U32,
					opts.end !== undefined ? (opts.end as U32) : undefined,
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
					stepLabel: `Found ${totalFound} UTXO${totalFound === 1 ? '' : 's'} — generating proofs and claiming...`,
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
			} catch (err: unknown) {
				let message: string;

				if (isFetchUtxosError(err)) {
					switch (err.stage) {
						case 'initialization': {
							message = `Indexer not configured — set indexerApiEndpoint in your config: ${err.message}`;
							break;
						}

						case 'indexer-fetch': {
							message = `Indexer unreachable — check your connection: ${err.message}`;
							break;
						}

						default: {
							message = `Scan failed at stage "${err.stage}": ${err.message}`;
						}
					}
				} else if (isClaimUtxoError(err)) {
					switch (err.stage) {
						case 'zk-proof-generation': {
							message = `ZK proof generation failed — try again: ${err.message}`;
							break;
						}

						case 'transaction-sign': {
							message = 'Transaction signing cancelled.';
							break;
						}

						case 'transaction-validate': {
							message = `Pre-flight simulation failed — Merkle proof may be stale, re-scan and retry: ${err.message}`;
							break;
						}

						case 'transaction-send': {
							message = `${err.message} — verify on-chain before retrying, nullifier may already be burned.`;
							break;
						}

						default: {
							message = `Claim failed at stage "${err.stage}": ${err.message}`;
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

	if (state.status === 'scanning' || state.status === 'claiming') {
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
				<Text color="red">✗ Claim failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

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
