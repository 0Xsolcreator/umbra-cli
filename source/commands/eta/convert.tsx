import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, render} from 'ink';
import {Command, Flags} from '@oclif/core';
import {getNetworkEncryptionToSharedEncryptionConverterFunction} from '@umbra-privacy/sdk';
import {address, type Address} from '@solana/kit';

import {getClient} from '../../lib/umbra/client.js';
import {fetchSupportedMints} from '../../lib/relayer.js';
import {Spinner, ErrorMessage, SubmittedMessage, MintPicker} from '../../components/index.js';
import {
	type ErrorState,
	type SubmittedState,
	formatConversionError,
	isBlockheightExceededError,
} from '../../lib/errors.js';

type SkipReason =
	| 'non_existent'
	| 'not_initialised'
	| 'already_shared'
	| 'balance_not_initialised';

type ConvertResult = {
	converted: Map<Address, string>;
	skipped: Map<Address, SkipReason>;
};

type Props = {
	args: string[];
	options: {all: boolean; user?: string};
};

type State =
	| {status: 'picking'}
	| {status: 'fetching-all'}
	| {status: 'converting'; mints: string[]}
	| {status: 'success'; result: ConvertResult}
	| SubmittedState
	| ErrorState;

function skipReasonLabel(reason: SkipReason): string {
	switch (reason) {
		case 'already_shared':
			return 'already in shared mode';
		case 'non_existent':
			return 'ETA account does not exist';
		case 'not_initialised':
			return 'ETA account not initialised';
		case 'balance_not_initialised':
			return 'balance not initialised';
	}
}

function shortMint(mint: Address): string {
	return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export default function Convert({args: initialMints, options: {all, user}}: Props) {
	const {exit} = useApp();

	const initialState: State = all
		? {status: 'fetching-all'}
		: initialMints.length > 0
			? {status: 'converting', mints: initialMints}
			: {status: 'picking'};

	const [state, setState] = useState<State>(initialState);

	useEffect(() => {
		if (state.status !== 'fetching-all') return;
		fetchSupportedMints()
			.then(mints => setState({status: 'converting', mints: [...mints]}))
			.catch((err: unknown) => {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
				exit();
			});
	}, [state.status]);

	useEffect(() => {
		if (state.status !== 'converting') return;
		const {mints} = state;

		async function run() {
			try {
				const client = await getClient(user);
				const convert =
					getNetworkEncryptionToSharedEncryptionConverterFunction({client});
				const result = await convert(mints.map(m => address(m)));
				setState({status: 'success', result: result as ConvertResult});
				exit();
			} catch (err: unknown) {
				if (isBlockheightExceededError(err)) {
					setState({
						status: 'submitted',
						message:
							"Confirmation timed out — the transaction likely landed. Verify with 'umbra eta balance'.",
					});
				} else {
					setState({status: 'error', message: formatConversionError(err)});
				}

				exit();
			}
		}

		void run();
	}, [state.status]);

	if (state.status === 'picking')
		return (
			<MintPicker
				label="Select a token to convert to shared mode:"
				onSelect={mint => setState({status: 'converting', mints: [mint]})}
				onError={message => {
					setState({status: 'error', message});
					exit();
				}}
			/>
		);

	if (state.status === 'fetching-all' || state.status === 'converting')
		return <Spinner label="Converting MXE balance to shared mode..." />;

	if (state.status === 'submitted')
		return (
			<SubmittedMessage
				title="Conversion submitted"
				detail={state.message}
			/>
		);

	if (state.status === 'error')
		return (
			<ErrorMessage title="Conversion failed" detail={state.message} />
		);

	const {converted, skipped} = state.result;
	const convertedCount = converted.size;
	const alreadyShared = [...skipped.entries()].filter(
		([, r]) => r === 'already_shared',
	);
	const otherSkipped = [...skipped.entries()].filter(
		([, r]) => r !== 'already_shared',
	);

	if (convertedCount === 0 && alreadyShared.length > 0 && otherSkipped.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="green">✓ Already in shared mode — no conversion needed</Text>
				<Box flexDirection="column" marginTop={1} marginLeft={2}>
					{alreadyShared.map(([mint]) => (
						<Text key={mint} dimColor>
							{shortMint(mint)}
						</Text>
					))}
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{convertedCount > 0 && (
				<>
					<Text color="green">
						✓ Converted {convertedCount} ETA
						{convertedCount === 1 ? '' : 's'} to shared mode
					</Text>
					<Box flexDirection="column" marginTop={1} marginLeft={2}>
						{[...converted.entries()].map(([mint, sig]) => (
							<Box key={mint} flexDirection="column">
								<Text dimColor>
									{shortMint(mint)}: {sig}
								</Text>
							</Box>
						))}
					</Box>
				</>
			)}
			{alreadyShared.length > 0 && (
				<Box flexDirection="column" marginTop={convertedCount > 0 ? 1 : 0}>
					<Text dimColor>
						Already shared: {alreadyShared.map(([m]) => shortMint(m)).join(', ')}
					</Text>
				</Box>
			)}
			{otherSkipped.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">Skipped:</Text>
					{otherSkipped.map(([mint, reason]) => (
						<Text key={mint} color="yellow" dimColor>
							{'  '}
							{shortMint(mint)}: {skipReasonLabel(reason)}
						</Text>
					))}
				</Box>
			)}
		</Box>
	);
}

export class ConvertCommand extends Command {
	static override description =
		'Convert MXE-encrypted ETA balance(s) to shared mode so they can be withdrawn';

	static override strict = false;

	static override args = {};

	static override flags = {
		all: Flags.boolean({
			description: 'Convert all tokens supported by the relayer',
			default: false,
		}),
		user: Flags.string({
			description:
				'User to act as (defaults to the active user). Useful for running concurrent operations without switching the global active user.',
			required: false,
		}),
	};

	static override examples = [
		'<%= config.bin %> eta convert EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
		'<%= config.bin %> eta convert --all',
	];

	async run() {
		const {argv, flags} = await this.parse(ConvertCommand);
		const {waitUntilExit} = render(
			<Convert
				args={argv as string[]}
				options={{all: flags.all, user: flags.user}}
			/>,
		);
		await waitUntilExit();
	}
}
