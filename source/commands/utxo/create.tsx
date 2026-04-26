import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
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
import {bigintArg, bigintFlag} from '../../lib/flags.js';
import {Spinner, ErrorMessage, MintPicker} from '../../components/index.js';
import {formatCreateUtxoError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	args: [string | undefined, bigint];
	options: {from: string; receiver?: string};
};

type State =
	| {status: 'picking'}
	| {status: 'creating'; stepLabel: string}
	| {
			status: 'success';
			createProofAccountSignature: string;
			createUtxoSignature?: string;
			queueSignature?: string;
			callbackSignature?: string;
	  }
	| ErrorState;

export default function Create({
	args: [initialMint, amount],
	options: opts,
}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>(
		initialMint === undefined
			? {status: 'picking'}
			: {status: 'creating', stepLabel: 'Preparing UTXO...'},
	);
	const [mint, setMint] = useState<string | undefined>(initialMint);

	useEffect(() => {
		if (state.status !== 'creating' || mint === undefined) return;

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
					mint: address(mint!),
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

				exit();
			} catch (err: unknown) {
				setState({status: 'error', message: formatCreateUtxoError(err)});
				exit();
			}
		}

		void run();
	}, [state.status, mint]);

	if (state.status === 'picking')
		return (
			<MintPicker
				onSelect={selected => {
					setMint(selected);
					setState({status: 'creating', stepLabel: 'Preparing UTXO...'});
				}}
				onError={message => {
					setState({status: 'error', message});
					exit();
				}}
			/>
		);

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

export class CreateCommand extends Command {
	static override description = 'Create a new stealth UTXO';

	static override args = {
		mint: Args.string({
			description: 'Mint address — omit to pick interactively',
			required: false,
		}),
		amount: bigintArg({description: 'Amount in base units', required: false}),
	};

	static override flags = {
		amount: bigintFlag({
			description: 'Amount in base units (alternative to positional arg)',
			required: false,
		}),
		from: Flags.string({
			description:
				'Token source: "public" (ATA) or "encrypted" (ETA) balance',
			options: ['public', 'encrypted'],
			default: 'public',
		}),
		receiver: Flags.string({
			description:
				'Recipient wallet address — creates a receiver claimable UTXO (defaults to self-claimable)',
			required: false,
		}),
	};

	async run() {
		const {args, flags} = await this.parse(CreateCommand);
		const amount = args.amount ?? flags.amount;
		if (amount === undefined) {
			this.error('Missing amount. Pass it as a positional arg or with --amount <n>');
		}

		const {waitUntilExit} = render(
			<Create
				args={[args.mint, amount]}
				options={{from: flags.from, receiver: flags.receiver}}
			/>,
		);
		await waitUntilExit();
	}
}
