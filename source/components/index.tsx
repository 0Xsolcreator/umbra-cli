import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import InkSpinner from 'ink-spinner';
import SelectInput from 'ink-select-input';

import {fetchSupportedMints} from '../lib/relayer.js';
import {KNOWN_MINT_SYMBOLS} from '../lib/constants.js';

/** Loading indicator */
export function Spinner({label}: {readonly label: string}) {
	return (
		<Box>
			<Text color="cyan">
				<InkSpinner type="dots" />
			</Text>
			<Text> {label}</Text>
		</Box>
	);
}

/** Error heading. */
export function ErrorMessage({
	title,
	detail,
}: {
	readonly title: string;
	readonly detail: string;
}) {
	return (
		<Box flexDirection="column">
			<Text color="red">✗ {title}</Text>
			<Box marginTop={1} marginLeft={2}>
				<Text dimColor>{detail}</Text>
			</Box>
		</Box>
	);
}

/** Fixed-width label column next to a value — used in summary views. */
export function Row({
	label,
	value,
	width = 14,
}: {
	readonly label: string;
	readonly value: string;
	readonly width?: number;
}) {
	return (
		<Box>
			<Box width={width}>
				<Text dimColor>{label}</Text>
			</Box>
			<Text>{value}</Text>
		</Box>
	);
}

type MintPickerState =
	| {status: 'loading'}
	| {status: 'ready'; mints: readonly string[]}
	| {status: 'error'; message: string};

function mintLabel(mint: string): string {
	const symbol = KNOWN_MINT_SYMBOLS[mint];
	const short = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
	return symbol ? `${symbol}  (${short})` : short;
}

/**
 * Fetches supported mints from the relayer and presents an interactive
 * selector. Calls `onSelect` with the chosen mint address, or `onError`
 * if the relayer is unreachable.
 */
export function MintPicker({
	label = 'Select a token:',
	onSelect,
	onError,
}: {
	readonly label?: string;
	readonly onSelect: (mint: string) => void;
	readonly onError: (message: string) => void;
}) {
	const [state, setState] = useState<MintPickerState>({status: 'loading'});

	useEffect(() => {
		fetchSupportedMints()
			.then(mints => setState({status: 'ready', mints}))
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				setState({status: 'error', message});
				onError(message);
			});
	}, []);

	if (state.status === 'loading')
		return <Spinner label="Fetching supported tokens..." />;
	if (state.status === 'error') return null;

	const items = state.mints.map(mint => ({
		label: mintLabel(mint),
		value: mint,
	}));

	return (
		<Box flexDirection="column">
			<Text dimColor>{label}</Text>
			<SelectInput items={items} onSelect={item => onSelect(item.value)} />
		</Box>
	);
}

export type UtxoEntry = {amount: bigint; insertionIndex: bigint};

/** Labelled group of UTXOs with amounts and insertion indices. */
export function UtxoGroup({
	label,
	utxos,
}: {
	readonly label: string;
	readonly utxos: UtxoEntry[];
}) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text>
				{label} <Text color="cyan">{utxos.length}</Text>
			</Text>
			{utxos.map(u => (
				<Box key={u.insertionIndex.toString()} marginLeft={2}>
					<Text dimColor>
						· {u.amount.toString()} (index {u.insertionIndex.toString()})
					</Text>
				</Box>
			))}
		</Box>
	);
}
