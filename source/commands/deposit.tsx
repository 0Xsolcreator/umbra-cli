import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {getPublicBalanceToEncryptedBalanceDirectDepositorFunction} from '@umbra-privacy/sdk';
import {isEncryptedDepositError} from '@umbra-privacy/sdk/errors';

import {getClient} from '../lib/umbra/client.js';
import {address} from '@solana/kit';
import {U64} from '@umbra-privacy/sdk/types';

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
	| {status: 'error'; message: string};

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
				let message: string;

				if (isEncryptedDepositError(err)) {
					switch (err.stage) {
						case 'validation': {
							message = `Invalid arguments: ${err.message}`;
							break;
						}

						case 'mint-fetch': {
							message = `Could not fetch mint account — check RPC connectivity and mint address: ${err.message}`;
							break;
						}

						case 'account-fetch': {
							message = `Could not fetch destination account: ${err.message}`;
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
							message = `Deposit failed at stage "${err.stage}": ${err.message}`;
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

	if (state.status === 'depositing') {
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
				<Text color="red">✗ Deposit failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

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
