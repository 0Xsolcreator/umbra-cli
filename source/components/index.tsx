import React from 'react';
import {Box, Text} from 'ink';
import InkSpinner from 'ink-spinner';

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
