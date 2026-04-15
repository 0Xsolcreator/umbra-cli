import {Help} from '@oclif/core';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const CY = '\x1b[36m';
const WH = '\x1b[37m';

const LOGO = [
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
].join('\n');

export default class UmbraHelp extends Help {
	override async showRootHelp(): Promise<void> {
		process.stdout.write('\n');
		process.stdout.write(LOGO + '\n');
		process.stdout.write('\n');
		process.stdout.write(
			`   ${B}${CY}umbra${R}  ${D}privacy-preserving transfers on Solana${R}\n`,
		);
		process.stdout.write('\n');
		await super.showRootHelp();
	}
}
