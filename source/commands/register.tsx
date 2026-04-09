import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import zod from 'zod';
import {
	getUserAccountQuerierFunction,
	getUserRegistrationFunction,
} from '@umbra-privacy/sdk';
import {isRegistrationError} from '@umbra-privacy/sdk/errors';
import {getUserRegistrationProver} from '@umbra-privacy/web-zk-prover';

import {getClient} from '../lib/umbra/client.js';

export const options = zod.object({
	confidential: zod
		.boolean()
		.default(true)
		.describe('Register X25519 key for encrypted balance (Shared mode)'),
	anonymous: zod
		.boolean()
		.default(true)
		.describe('Register user commitment for anonymous transfers'),
});

type Props = {
	options: zod.infer<typeof options>;
};

type State =
	| {status: 'checking'}
	| {status: 'registering'; stepLabel: string}
	| {status: 'already-registered'}
	| {status: 'success'; signatureCount: number}
	| {status: 'error'; message: string};

export default function Register({options: opts}: Props) {
	const [state, setState] = useState<State>({status: 'checking'});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const query = getUserAccountQuerierFunction({client});
				const result = await query(client.signer.address);

				const isFullyRegistered =
					result.state === 'exists' &&
					result.data.isUserAccountX25519KeyRegistered &&
					result.data.isUserCommitmentRegistered;

				if (isFullyRegistered) {
					setState({status: 'already-registered'});
					return;
				}

				setState({
					status: 'registering',
					stepLabel: 'Starting registration...',
				});

				const zkProver = getUserRegistrationProver();
				const register = getUserRegistrationFunction({client}, {zkProver});
				const signatures = await register({
					confidential: opts.confidential,
					anonymous: opts.anonymous,
					callbacks: {
						userAccountInitialisation: {
							pre: async () => {
								setState({
									status: 'registering',
									stepLabel: 'Creating user account...',
								});
							},
						},
						registerX25519PublicKey: {
							pre: async () => {
								setState({
									status: 'registering',
									stepLabel: 'Registering encryption key...',
								});
							},
						},
						registerUserForAnonymousUsage: {
							pre: async () => {
								setState({
									status: 'registering',
									stepLabel: 'Registering user commitment...',
								});
							},
						},
					},
				});

				setState({status: 'success', signatureCount: signatures.length});
			} catch (err: unknown) {
				let message: string;

				if (isRegistrationError(err)) {
					switch (err.stage) {
						case 'master-seed-derivation': {
							message = 'Sign the master seed message to proceed.';
							break;
						}

						case 'transaction-sign': {
							message = 'Transaction signing cancelled.';
							break;
						}

						case 'zk-proof-generation': {
							message = `ZK proof generation failed: ${err.message}`;
							break;
						}

						case 'account-fetch': {
							message = `RPC error while checking account state: ${err.message}`;
							break;
						}

						case 'transaction-send': {
							message = `${err.message} — check on-chain state before retrying.`;
							break;
						}

						default: {
							message = `Registration failed at stage "${err.stage}": ${err.message}`;
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

	if (state.status === 'checking' || state.status === 'registering') {
		const label =
			state.status === 'checking'
				? 'Checking registration status...'
				: state.stepLabel;

		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> {label}</Text>
			</Box>
		);
	}

	if (state.status === 'error') {
		return (
			<Box flexDirection="column">
				<Text color="red">✗ Registration failed</Text>
				<Box marginTop={1} marginLeft={2}>
					<Text dimColor>{state.message}</Text>
				</Box>
			</Box>
		);
	}

	if (state.status === 'already-registered') {
		return <Text color="green">✓ User already registered</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Registration complete</Text>
			<Box marginTop={1} marginLeft={2}>
				<Text dimColor>
					{state.signatureCount}{' '}
					{state.signatureCount === 1 ? 'transaction' : 'transactions'}{' '}
					submitted
				</Text>
			</Box>
		</Box>
	);
}
