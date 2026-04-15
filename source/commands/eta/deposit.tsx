import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
import {getPublicBalanceToEncryptedBalanceDirectDepositorFunction} from '@umbra-privacy/sdk';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {bigintArg} from '../../lib/flags.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatDepositError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	args: [string, bigint];
	options: {recipient?: string};
};

type State =
	| {status: 'depositing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
	| ErrorState;

export default function Deposit({args: [mint, amount], options: opts}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		status: 'depositing',
		stepLabel: 'Preparing deposit...',
	});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const destination = opts.recipient ?? client.signer.address;

				setState({status: 'depositing', stepLabel: 'Submitting deposit...'});

				const deposit =
					getPublicBalanceToEncryptedBalanceDirectDepositorFunction({client});

				const result = await deposit(
					address(destination),
					address(mint),
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
	}, []);

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
		mint: Args.string({description: 'Mint address', required: true}),
		amount: bigintArg({description: 'Amount in base units', required: true}),
	};

	static override flags = {
		recipient: Flags.string({
			description:
				'Recipient wallet address (defaults to your own address)',
			required: false,
		}),
	};

	async run() {
		const {args, flags} = await this.parse(DepositCommand);
		const {waitUntilExit} = render(
			<Deposit
				args={[args.mint, args.amount]}
				options={{recipient: flags.recipient}}
			/>,
		);
		await waitUntilExit();
	}
}
