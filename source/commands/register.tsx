import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Command, Flags} from '@oclif/core';
import {
	getUserAccountQuerierFunction,
	getUserRegistrationFunction,
} from '@umbra-privacy/sdk';
import {getUserRegistrationProver} from '@umbra-privacy/web-zk-prover';

import {getClient} from '../lib/umbra/client.js';
import {Spinner, ErrorMessage} from '../components/index.js';
import {formatRegistrationError} from '../lib/errors.js';
import {type ErrorState} from '../lib/errors.js';

type Props = {
	options: {
		confidential: boolean;
		anonymous: boolean;
	};
};

type State =
	| {status: 'checking'}
	| {status: 'registering'; stepLabel: string}
	| {status: 'already-registered'}
	| {status: 'success'; signatureCount: number}
	| ErrorState;

export default function Register({options: opts}: Props) {
	const {exit} = useApp();
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
					exit();
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
				exit();
			} catch (err: unknown) {
				setState({status: 'error', message: formatRegistrationError(err)});
				exit();
			}
		}

		void run();
	}, []);

	if (state.status === 'checking' || state.status === 'registering') {
		const label =
			state.status === 'checking'
				? 'Checking registration status...'
				: state.stepLabel;
		return <Spinner label={label} />;
	}

	if (state.status === 'error')
		return <ErrorMessage title="Registration failed" detail={state.message} />;

	if (state.status === 'already-registered') {
		return <Text color="green">✓ User already registered</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Registration complete</Text>
			<Box marginTop={1} marginLeft={2}>
				<Text dimColor>
					{state.signatureCount}{' '}
					{state.signatureCount === 1 ? 'transaction' : 'transactions'} submitted
				</Text>
			</Box>
		</Box>
	);
}

export class RegisterCommand extends Command {
	static override description = 'Publish your stealth meta-address on-chain';

	static override flags = {
		confidential: Flags.boolean({
			description: 'Register X25519 key for encrypted balance (Shared mode)',
			default: true,
			allowNo: true,
		}),
		anonymous: Flags.boolean({
			description: 'Register user commitment for anonymous transfers',
			default: true,
			allowNo: true,
		}),
	};

	async run() {
		const {flags} = await this.parse(RegisterCommand);
		const {waitUntilExit} = render(
			<Register
				options={{
					confidential: flags.confidential,
					anonymous: flags.anonymous,
				}}
			/>,
		);
		await waitUntilExit();
	}
}
