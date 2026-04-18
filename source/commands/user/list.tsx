import {Command} from '@oclif/core';

import {readConfig} from '../../lib/config.js';
import {listUsers} from '../../lib/users.js';

export class UserListCommand extends Command {
	static override description = 'List configured users';

	async run() {
		const [users, config] = await Promise.all([listUsers(), readConfig()]);

		if (users.length === 0) {
			this.log('No users configured.');
			this.log('Add one with: umbra user add <name> --backend <backend>');
			return;
		}

		const namePad = Math.max(4, ...users.map(u => u.name.length));
		const backendPad = Math.max(7, ...users.map(u => u.backend.length));

		this.log(
			`  ${'NAME'.padEnd(namePad)}  ${'BACKEND'.padEnd(backendPad)}  ADDRESS`,
		);

		for (const u of users) {
			const marker = u.name === config.activeUser ? '*' : ' ';
			this.log(
				`${marker} ${u.name.padEnd(namePad)}  ${u.backend.padEnd(
					backendPad,
				)}  ${u.address}`,
			);
		}

		if (!config.activeUser) {
			this.log('');
			this.log('No active user. Select one with: umbra user use <name>');
		}
	}
}
