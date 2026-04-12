import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';

const C = 'white' as const; // cloud outline
const E = 'cyan' as const; // eye pills

type EyeCap = '▄' | '█' | '▀' | ' ';
type EyeState = readonly [EyeCap, EyeCap, EyeCap, EyeCap, EyeCap];

const OPEN: EyeState = ['▄', '█', '█', '█', '▀'];

// Blink: eyes squeeze inward symmetrically from top + bottom, then reopen
const BLINK_SEQ: ReadonlyArray<readonly [EyeState, number]> = [
	[[' ', '▄', '█', '▀', ' '], 70],
	[[' ', ' ', '█', ' ', ' '], 60],
	[[' ', ' ', ' ', ' ', ' '], 100],
	[[' ', ' ', '█', ' ', ' '], 60],
	[[' ', '▄', '█', '▀', ' '], 70],
];

function EyeRow({cap}: {readonly cap: EyeCap}) {
	const block =
		cap === '█'
			? '██████'
			: cap === ' '
				? '      '
				: `${cap}████${cap}`;
	return (
		<Box>
			<Text color={C}>{'   │         '}</Text>
			<Text color={E}>{block}</Text>
			<Text color={C}>{'    '}</Text>
			<Text color={E}>{block}</Text>
			<Text color={C}>{'         │'}</Text>
		</Box>
	);
}

function Logo() {
	// -1 = idle/open; 0..N-1 = current blink frame
	const [blinkStep, setBlinkStep] = useState(-1);

	useEffect(() => {
		if (blinkStep === -1) {
			const id = setTimeout(
				() => setBlinkStep(0),
				2000 + Math.random() * 2000,
			);
			return () => clearTimeout(id);
		}

		if (blinkStep >= BLINK_SEQ.length) {
			setBlinkStep(-1);
			return;
		}

		const [, duration] = BLINK_SEQ[blinkStep]!;
		const id = setTimeout(() => setBlinkStep(s => s + 1), duration);
		return () => clearTimeout(id);
	}, [blinkStep]);

	const caps =
		blinkStep >= 0 && blinkStep < BLINK_SEQ.length
			? BLINK_SEQ[blinkStep]![0]
			: OPEN;

	return (
		<Box flexDirection="column">
			<Text color={C}>{'      ╭────────────────────────────╮'}</Text>
			<Text color={C}>{'   ╭──╯                            ╰──╮'}</Text>
			<Text color={C}>{'   │                                  │'}</Text>
			<EyeRow cap={caps[0]} />
			<EyeRow cap={caps[1]} />
			<EyeRow cap={caps[2]} />
			<EyeRow cap={caps[3]} />
			<EyeRow cap={caps[4]} />
			<Text color={C}>{'   │                                  │'}</Text>
			<Text color={C}>{'   ╰──────────────────────────────────╯'}</Text>
		</Box>
	);
}

type CommandInfo = {name: string; description: string};

const COMMANDS: CommandInfo[] = [
	{name: 'init', description: 'Link your keypair and configure the CLI'},
	{name: 'register', description: 'Publish your stealth meta-address on-chain'},
	{name: 'deposit', description: 'Send a private token transfer to a stealth address'},
	{name: 'withdraw', description: 'Withdraw tokens from your stealth wallet'},
	{name: 'balance', description: 'Query your encrypted token balances'},
	{name: 'utxo scan', description: 'Scan the chain for unspent stealth UTXOs'},
	{name: 'utxo claim', description: 'Claim scanned UTXOs to your wallet'},
	{name: 'utxo create', description: 'Create a new stealth UTXO'},
];

export default function Index() {
	return (
		<Box flexDirection="column" paddingTop={1}>
			<Logo />
			<Box marginLeft={3} marginTop={1}>
				<Text bold color="cyan">
					umbra{'  '}
				</Text>
				<Text dimColor>privacy-preserving transfers on Solana</Text>
			</Box>
			<Box flexDirection="column" marginLeft={3} marginTop={1}>
				{COMMANDS.map(cmd => (
					<Box key={cmd.name}>
						<Box width={16}>
							<Text color="cyan">{cmd.name}</Text>
						</Box>
						<Text dimColor>{cmd.description}</Text>
					</Box>
				))}
			</Box>
			<Box marginLeft={3} marginTop={1} marginBottom={1}>
				<Text dimColor>{'Run '}</Text>
				<Text color="cyan">{'umbra <command> --help'}</Text>
				<Text dimColor>{' for details.'}</Text>
			</Box>
		</Box>
	);
}
