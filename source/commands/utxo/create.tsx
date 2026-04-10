import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {
	getEncryptedBalanceToSelfClaimableUtxoCreatorFunction,
	getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
	getPublicBalanceToSelfClaimableUtxoCreatorFunction,
	getPublicBalanceToReceiverClaimableUtxoCreatorFunction,
} from '@umbra-privacy/sdk';
import {isCreateUtxoError} from '@umbra-privacy/sdk/errors';
import {
	getCreateSelfClaimableUtxoFromEncryptedBalanceProver,
	getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
	getCreateSelfClaimableUtxoFromPublicBalanceProver,
	getCreateReceiverClaimableUtxoFromPublicBalanceProver,
} from '@umbra-privacy/web-zk-prover';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';

export const args = zod.tuple([
	zod.string().describe('mint'),
	zod.coerce.bigint().describe('amount'),
]);

export const options = zod.object({
	from: zod
		.enum(['public', 'encrypted'])
		.default('public')
		.describe('Token source: "public" (ATA) or "encrypted" (ETA) balance'),
	receiver: zod
		.string()
		.optional()
		.describe(
			'Recipient wallet address — creates a receiver claimable UTXO (defaults to self-claimable)',
		),
});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
};

type State =
	| {status: 'creating'; stepLabel: string}
	| {
			status: 'success';
			createProofAccountSignature: string;
			createUtxoSignature?: string;
			queueSignature?: string;
			callbackSignature?: string;
	  }
	| {status: 'error'; message: string};

export default function Create({args: [mint, amount], options: opts}: Props) {
	const [state, setState] = useState<State>({
		status: 'creating',
		stepLabel: 'Preparing UTXO...',
	});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const destination = opts.receiver ?? client.signer.address;
				const isEncrypted = opts.from === 'encrypted';
				const isSelf = !opts.receiver;

				setState({
					status: 'creating',
					stepLabel: 'Generating ZK proof and submitting...',
				});

				if (isEncrypted && isSelf) {
					const zkProver =
						getCreateSelfClaimableUtxoFromEncryptedBalanceProver();
					const createUtxo =
						getEncryptedBalanceToSelfClaimableUtxoCreatorFunction(
							{client},
							{zkProver},
						);
					const result = await createUtxo({
						destinationAddress: address(destination),
						mint: address(mint),
						amount: amount as U64,
					});
					setState({
						status: 'success',
						createProofAccountSignature: result.createProofAccountSignature,
						queueSignature: result.queueSignature,
						callbackSignature: result.callbackSignature,
					});
				} else if (isEncrypted && !isSelf) {
					const zkProver =
						getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
					const createUtxo =
						getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
							{client},
							{zkProver},
						);
					const result = await createUtxo({
						destinationAddress: address(destination),
						mint: address(mint),
						amount: amount as U64,
					});
					setState({
						status: 'success',
						createProofAccountSignature: result.createProofAccountSignature,
						queueSignature: result.queueSignature,
						callbackSignature: result.callbackSignature,
					});
				} else if (!isEncrypted && isSelf) {
					const zkProver = getCreateSelfClaimableUtxoFromPublicBalanceProver();
					const createUtxo = getPublicBalanceToSelfClaimableUtxoCreatorFunction(
						{client},
						{zkProver},
					);
					const result = await createUtxo({
						destinationAddress: address(destination),
						mint: address(mint),
						amount: amount as U64,
					});
					setState({
						status: 'success',
						createProofAccountSignature: result.createProofAccountSignature,
						createUtxoSignature: result.createUtxoSignature,
					});
				} else {
					const zkProver =
						getCreateReceiverClaimableUtxoFromPublicBalanceProver();
					const createUtxo =
						getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
							{client},
							{zkProver},
						);
					const result = await createUtxo({
						destinationAddress: address(destination),
						mint: address(mint),
						amount: amount as U64,
					});
					setState({
						status: 'success',
						createProofAccountSignature: result.createProofAccountSignature,
						createUtxoSignature: result.createUtxoSignature,
					});
				}
			} catch (err: unknown) {
				let message: string;

				if (isCreateUtxoError(err)) {
					switch (err.stage) {
						case 'validation': {
							message = `Invalid arguments: ${err.message}`;
							break;
						}

						case 'account-fetch': {
							message = `Could not fetch recipient account — check RPC and recipient address: ${err.message}`;
							break;
						}

						case 'mint-fetch': {
							message = `Could not fetch mint account — check RPC and mint address: ${err.message}`;
							break;
						}

						case 'zk-proof-generation': {
							message = `ZK proof generation failed — try again: ${err.message}`;
							break;
						}

						case 'transaction-sign': {
							message = 'Transaction signing cancelled.';
							break;
						}

						case 'transaction-validate': {
							message = `Pre-flight simulation failed — check funds and account state: ${err.message}`;
							break;
						}

						case 'transaction-send': {
							message = `${err.message} — check on-chain state before retrying.`;
							break;
						}

						default: {
							message = `UTXO creation failed at stage "${err.stage}": ${err.message}`;
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

	if (state.status === 'creating') {
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
				<Text color="red">✗ UTXO creation failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="green">✓ UTXO created</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				<Text dimColor>Proof account: {state.createProofAccountSignature}</Text>
				{state.createUtxoSignature && (
					<Text dimColor>Create: {state.createUtxoSignature}</Text>
				)}
				{state.queueSignature && (
					<Text dimColor>Queue: {state.queueSignature}</Text>
				)}
				{state.callbackSignature && (
					<Text dimColor>Callback: {state.callbackSignature}</Text>
				)}
			</Box>
		</Box>
	);
}
