import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {getPublicBalanceToEncryptedBalanceDirectDepositorFunction} from '@umbra-privacy/sdk';

import {getClient} from '../../lib/umbra/client.js';
import {address} from '@solana/kit';
import {U64} from '@umbra-privacy/sdk/types';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {formatDepositError} from '../../lib/errors.js';
import {type ErrorState} from '../../lib/errors.js';

export const args = zod.tuple([
	zod.string().describe('mint'),
	zod.coerce.bigint().describe('amount'),
]);

export const options = zod.object({
	recipient: zod
		.string()
		.optional()
		.describe('Recipient wallet address (defaults to your own address)'),
});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
};

type State =
	| {status: 'depositing'; stepLabel: string}
	| {status: 'success'; queueSignature: string; callbackSignature?: string}
	| ErrorState;

export default function Deposit({args: [mint, amount], options: opts}: Props) {
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
			} catch (err: unknown) {
				setState({status: 'error', message: formatDepositError(err)});
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
