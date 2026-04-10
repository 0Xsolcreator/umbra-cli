import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction} from '@umbra-privacy/sdk';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../lib/umbra/client.js';
import {Spinner, ErrorMessage} from '../components/index.js';
import {formatWithdrawalError} from '../lib/errors.js';
import {type ErrorState} from '../lib/errors.js';

export const args = zod.tuple([
	zod.string().describe('mint'),
	zod.coerce.bigint().describe('amount'),
]);

export const options = zod.object({
	destination: zod
		.string()
		.optional()
		.describe('Destination wallet address (defaults to your own address)'),
});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
};

type State =
	| {status: 'withdrawing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
	| ErrorState;

export default function Withdraw({args: [mint, amount], options: opts}: Props) {
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
			} catch (err: unknown) {
				setState({status: 'error', message: formatWithdrawalError(err)});
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
