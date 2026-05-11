import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
import {getPublicBalanceToEncryptedBalanceDirectDepositorFunction} from '@umbra-privacy/sdk';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {bigintArg, bigintFlag} from '../../lib/flags.js';
import {Spinner, ErrorMessage, SubmittedMessage, MintPicker} from '../../components/index.js';
import {
	formatDepositError,
	isBlockheightExceededError,
	type ErrorState,
	type SubmittedState,
} from '../../lib/errors.js';

type Props = {
	args: [string | undefined, bigint];
	options: {recipient?: string; user?: string; noAwaitCallback: boolean};
};

type State =
	| {status: 'picking'; amount: bigint | undefined}
	| {status: 'depositing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
	| SubmittedState
	| ErrorState;

export default function Deposit({args: [initialMint, amount], options: opts}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>(
		initialMint === undefined
			? {status: 'picking', amount}
			: {status: 'depositing', stepLabel: 'Preparing deposit...'},
	);
	const [mint, setMint] = useState<string | undefined>(initialMint);

	useEffect(() => {
		if (state.status !== 'depositing' || mint === undefined) return;

		async function run() {
			try {
				const client = await getClient(opts.user);
				const destination = opts.recipient ?? client.signer.address;
				setState({status: 'depositing', stepLabel: 'Submitting deposit...'});
				const deposit =
					getPublicBalanceToEncryptedBalanceDirectDepositorFunction(
						{client},
						opts.noAwaitCallback
							? {arcium: {awaitComputationFinalization: false}}
							: undefined,
					);
				const result = await deposit(
					address(destination),
					address(mint!),
					amount as U64,
				);
				setState({
					status: 'success',
					queueSignature: result.queueSignature,
					callbackSignature: result.callbackSignature,
				});
				exit();
			} catch (err: unknown) {
				if (isBlockheightExceededError(err)) {
					setState({
						status: 'submitted',
						message:
							"Confirmation timed out — the transaction likely landed. Verify with 'umbra eta balance'.",
					});
				} else {
					setState({status: 'error', message: formatDepositError(err)});
				}

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
					setState({status: 'depositing', stepLabel: 'Preparing deposit...'});
				}}
				onError={message => {
					setState({status: 'error', message});
					exit();
				}}
			/>
		);

	if (state.status === 'depositing') return <Spinner label={state.stepLabel} />;
	if (state.status === 'submitted')
		return (
			<SubmittedMessage title="Deposit submitted" detail={state.message} />
		);
	if (state.status === 'error')
		return <ErrorMessage title="Deposit failed" detail={state.message} />;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Deposit complete</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				<Text dimColor>Queue: {state.queueSignature}</Text>
				{state.callbackSignature && (
					<Text dimColor>Callback: {state.callbackSignature}</Text>
				)}
			</Box>
		</Box>
	);
}

export class DepositCommand extends Command {
	static override description =
		'Move tokens from your public wallet into an encrypted ETA';

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
		recipient: Flags.string({
			description:
				'Recipient wallet address (defaults to your own address)',
			required: false,
		}),
		user: Flags.string({
			description:
				'User to act as (defaults to the active user). Useful for running concurrent operations without switching the global active user.',
			required: false,
		}),
		'no-await-callback': Flags.boolean({
			description:
				'Return immediately after the queue transaction confirms without waiting for the Arcium MPC callback. Use this if the CLI hangs after the on-chain transaction already landed.',
			default: false,
		}),
	};

	async run() {
		const {args, flags} = await this.parse(DepositCommand);
		const amount = args.amount ?? flags.amount;
		if (amount === undefined) {
			this.error('Missing amount. Pass it as a positional arg or with --amount <n>');
		}

		const {waitUntilExit} = render(
			<Deposit
				args={[args.mint, amount]}
				options={{
					recipient: flags.recipient,
					user: flags.user,
					noAwaitCallback: flags['no-await-callback'],
				}}
			/>,
		);
		await waitUntilExit();
	}
}
