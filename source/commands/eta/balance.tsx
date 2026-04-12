import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {getEncryptedBalanceQuerierFunction} from '@umbra-privacy/sdk';
import {type QueryEncryptedBalanceResult} from '@umbra-privacy/sdk/interfaces';
import {address, type Address} from '@solana/kit';

import {getClient} from '../../lib/umbra/client.js';
import {Spinner, ErrorMessage} from '../../components/index.js';
import {type ErrorState} from '../../lib/errors.js';

export const args = zod.array(zod.string()).describe('mint addresses to query');

type Props = {
	args: zod.infer<typeof args>;
};

type BalanceEntry = {mint: Address; result: QueryEncryptedBalanceResult};

type State =
	| {status: 'querying'}
	| {status: 'success'; entries: BalanceEntry[]}
	| ErrorState;

function BalanceRow({mint, result}: BalanceEntry) {
	const short = `${mint.slice(0, 4)}…${mint.slice(-4)}`;

	if (result.state === 'shared') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text color="green">{String(result.balance)}</Text>
			</Box>
		);
	}

	if (result.state === 'mxe') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text color="yellow">MXE mode (cannot decrypt client-side)</Text>
			</Box>
		);
	}

	if (result.state === 'uninitialized') {
		return (
			<Box>
				<Box width={12}>
					<Text dimColor>{short}</Text>
				</Box>
				<Text dimColor>uninitialized</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Box width={12}>
				<Text dimColor>{short}</Text>
			</Box>
			<Text dimColor>no balance — deposit first</Text>
		</Box>
	);
}

export default function Balance({args: mints}: Props) {
	const [state, setState] = useState<State>({status: 'querying'});

	useEffect(() => {
		async function run() {
			try {
				const client = await getClient();

				const query = getEncryptedBalanceQuerierFunction({client});
				const balances = await query(mints.map(m => address(m)));

				const entries: BalanceEntry[] = [...balances.entries()].map(
					([mint, result]) => ({mint, result}),
				);

				setState({status: 'success', entries});
			} catch (err: unknown) {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			}
		}

		void run();
	}, []);

	if (state.status === 'querying')
		return <Spinner label="Fetching encrypted balances..." />;
	if (state.status === 'error')
		return <ErrorMessage title="Balance query failed" detail={state.message} />;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ Encrypted balances</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				{state.entries.map((entry: BalanceEntry) => (
					<BalanceRow key={entry.mint} {...entry} />
				))}
			</Box>
		</Box>
	);
}
