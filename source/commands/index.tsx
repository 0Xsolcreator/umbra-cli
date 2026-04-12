import React, {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {COMMANDS} from '../lib/commands.js';

const C = 'white' as const; // cloud outline
const E = 'cyan' as const; // eye pills

function EyeRow({cap}: {readonly cap: '▄' | '█' | '▀'}) {
	const block = cap === '█' ? '██████' : `${cap}████${cap}`;
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
	return (
		<Box flexDirection="column">
			<Text color={C}>{'      ╭────────────────────────────╮'}</Text>
			<Text color={C}>{'   ╭──╯                            ╰──╮'}</Text>
			<Text color={C}>{'   │                                  │'}</Text>
			<EyeRow cap="▄" />
			<EyeRow cap="█" />
			<EyeRow cap="█" />
			<EyeRow cap="█" />
			<EyeRow cap="▀" />
			<Text color={C}>{'   │                                  │'}</Text>
			<Text color={C}>{'   ╰──────────────────────────────────╯'}</Text>
		</Box>
	);
}

export default function Index() {
	const {exit} = useApp();

	useEffect(() => {
		exit();
	}, []);

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
