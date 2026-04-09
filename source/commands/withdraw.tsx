import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction} from '@umbra-privacy/sdk';
import {isEncryptedWithdrawalError} from '@umbra-privacy/sdk/errors';
import {address} from '@solana/kit';
import {type U64} from '@umbra-privacy/sdk/types';

import {getClient} from '../lib/umbra/client.js';

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
	| {status: 'error'; message: string};

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
				let message: string;

				if (isEncryptedWithdrawalError(err)) {
					switch (err.stage) {
						case 'validation': {
							message = `Invalid arguments: ${err.message}`;
							break;
						}

						case 'mint-fetch': {
							message = `Could not fetch mint account — check RPC connectivity and mint address: ${err.message}`;
							break;
						}

						case 'instruction-build': {
							message = `Could not construct instruction — protocol state mismatch: ${err.message}`;
							break;
						}

						case 'transaction-sign': {
							message = 'Transaction signing cancelled.';
							break;
						}

						case 'transaction-send': {
							message = `${err.message} — check on-chain state before retrying.`;
							break;
						}

						default: {
							message = `Withdrawal failed at stage "${err.stage}": ${err.message}`;
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

	if (state.status === 'withdrawing') {
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
				<Text color="red">✗ Withdrawal failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

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
