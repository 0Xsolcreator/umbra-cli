#!/usr/bin/env node
import {Command} from 'commander';
import Pastel from 'pastel';

const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const orig = Command.prototype.helpInformation;
Command.prototype.helpInformation = function () {
	return orig
		.call(this)
		.replace(/^(Usage:|Options:|Commands:|Arguments:)/gm, `${BOLD}$1${RESET}`)
		.replace(/(--[\w-]+|-[a-zA-Z](?=,| ))/g, `${CYAN}$1${RESET}`)
		.replace(/(\((?:default|choices):.*?\))/g, `${DIM}$1${RESET}`);
};

const app = new Pastel({
	importMeta: import.meta,
});

await app.run();
