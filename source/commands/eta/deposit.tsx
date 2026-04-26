import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
import {getPublicBalanceToEncryptedBalanceDirectDepositorFunction} from '@umbra-privacy/sdk';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {bigintArg, bigintFlag} from '../../lib/flags.js';
import {Spinner, ErrorMessage, MintPicker} from '../../components/index.js';
import {formatDepositError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	args: [string | undefined, bigint];
	options: {recipient?: string};
};

type State =
	| {status: 'picking'; amount: bigint | undefined}
	| {status: 'depositing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
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
				const client = await getClient();
				const destination = opts.recipient ?? client.signer.address;
				setState({status: 'depositing', stepLabel: 'Submitting deposit...'});
				const deposit =
					getPublicBalanceToEncryptedBalanceDirectDepositorFunction({client});
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
				setState({status: 'error', message: formatDepositError(err)});
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
				options={{recipient: flags.recipient}}
			/>,
		);
		await waitUntilExit();
	}
}
