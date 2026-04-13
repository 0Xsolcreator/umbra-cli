#!/usr/bin/env node

// ANSI escape codes — no deps needed here
const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const CY = '\x1b[36m';
const WH = '\x1b[37m';
const GR = '\x1b[32m';

const cloud = [
	`${WH}      ╭────────────────────────────╮${R}`,
	`${WH}   ╭──╯                            ╰──╮${R}`,
	`${WH}   │                                  │${R}`,
	`${WH}   │         ${CY}▄████▄    ▄████▄${WH}         │${R}`,
	`${WH}   │         ${CY}██████    ██████${WH}         │${R}`,
	`${WH}   │         ${CY}██████    ██████${WH}         │${R}`,
	`${WH}   │         ${CY}██████    ██████${WH}         │${R}`,
	`${WH}   │         ${CY}▀████▀    ▀████▀${WH}         │${R}`,
	`${WH}   │                                  │${R}`,
	`${WH}   ╰──────────────────────────────────╯${R}`,
];

const lines = [
	'',
	...cloud,
	'',
	`   ${B}${CY}umbra${R}  ${D}privacy-preserving transfers on Solana${R}`,
	'',
	`   ${GR}✓${R} Installation complete!`,
	'',
	`   ${D}Quick start:${R}`,
	`   ${CY}umbra init${R}          ${D}1. set up a new wallet${R}`,
	`   ${CY}umbra register${R}      ${D}2. register your stealth address${R}`,
	'',
	`   ${D}Then refer to the docs for private deposits, withdrawals, and more:${R}`,
	`   ${CY}https://umbra.0xcreator.dev${R}`,
	'',
];

process.stdout.write(lines.join('\n') + '\n');
