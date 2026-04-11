import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {
	getEncryptedBalanceToSelfClaimableUtxoCreatorFunction,
	getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
	getPublicBalanceToSelfClaimableUtxoCreatorFunction,
	getPublicBalanceToReceiverClaimableUtxoCreatorFunction,
} from '@umbra-privacy/sdk';
import {
	getCreateSelfClaimableUtxoFromEncryptedBalanceProver,
	getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
	getCreateSelfClaimableUtxoFromPublicBalanceProver,
	getCreateReceiverClaimableUtxoFromPublicBalanceProver,
} from '@umbra-privacy/web-zk-prover';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatCreateUtxoError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

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
	| ErrorState;

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

				const createArgs = {
					destinationAddress: address(destination),
					mint: address(mint),
					amount: amount as U64,
				};

				if (isEncrypted) {
					if (isSelf) {
						const zkProver =
							getCreateSelfClaimableUtxoFromEncryptedBalanceProver();
						const createUtxo =
							getEncryptedBalanceToSelfClaimableUtxoCreatorFunction(
								{client},
								{zkProver},
							);
						const result = await createUtxo(createArgs);
						setState({
							status: 'success',
							createProofAccountSignature: result.createProofAccountSignature,
							queueSignature: result.queueSignature,
							callbackSignature: result.callbackSignature,
						});
					} else {
						const zkProver =
							getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
						const createUtxo =
							getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
								{client},
								{zkProver},
							);
						const result = await createUtxo(createArgs);
						setState({
							status: 'success',
							createProofAccountSignature: result.createProofAccountSignature,
							queueSignature: result.queueSignature,
							callbackSignature: result.callbackSignature,
						});
					}
				} else if (isSelf) {
					const zkProver = getCreateSelfClaimableUtxoFromPublicBalanceProver();
					const createUtxo = getPublicBalanceToSelfClaimableUtxoCreatorFunction(
						{client},
						{zkProver},
					);
					const result = await createUtxo(createArgs);
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
					const result = await createUtxo(createArgs);
					setState({
						status: 'success',
						createProofAccountSignature: result.createProofAccountSignature,
						createUtxoSignature: result.createUtxoSignature,
					});
				}
			} catch (err: unknown) {
				setState({status: 'error', message: formatCreateUtxoError(err)});
			}
		}

		void run();
	}, []);

	if (state.status === 'creating') return <Spinner label={state.stepLabel} />;
	if (state.status === 'error')
		return <ErrorMessage title="UTXO creation failed" detail={state.message} />;

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
