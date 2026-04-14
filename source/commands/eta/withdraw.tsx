import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Args, Command, Flags} from '@oclif/core';
import {getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction} from '@umbra-privacy/sdk';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../../lib/umbra/client.js';
import {bigintArg} from '../../lib/flags.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatWithdrawalError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	args: [string, bigint];
	options: {destination?: string};
};

type State =
	| {status: 'withdrawing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
	| ErrorState;

export default function Withdraw({args: [mint, amount], options: opts}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		status: 'withdrawing',
		stepLabel: 'Preparing withdrawal...',
	});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const destination = opts.destination ?? client.signer.address;

				setState({
					status: 'withdrawing',
					stepLabel: `Withdrawing to ${destination}...`,
				});

				const withdraw =
					getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({client});

				const result = await withdraw(
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
				setState({status: 'error', message: formatWithdrawalError(err)});
				exit();
			}
		}

		void run();
	}, []);

	if (state.status === 'withdrawing')
		return <Spinner label={state.stepLabel} />;
	if (state.status === 'error')
		return <ErrorMessage title="Withdrawal failed" detail={state.message} />;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Withdrawal complete</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				<Text dimColor>Queue: {state.queueSignature}</Text>
				{state.callbackSignature && (
					<Text dimColor>Callback: {state.callbackSignature}</Text>
				)}
			</Box>
		</Box>
	);
}

export class WithdrawCommand extends Command {
	static override description =
		'Move tokens from your encrypted ETA back to a public wallet';

	static override args = {
		mint: Args.string({description: 'Mint address', required: true}),
		amount: bigintArg({description: 'Amount in base units', required: true}),
	};

	static override flags = {
		destination: Flags.string({
			description:
				'Destination wallet address (defaults to your own address)',
			required: false,
		}),
	};

	async run() {
		const {args, flags} = await this.parse(WithdrawCommand);
		const {waitUntilExit} = render(
			<Withdraw
				args={[args.mint, args.amount]}
				options={{destination: flags.destination}}
			/>,
		);
		await waitUntilExit();
	}
}
