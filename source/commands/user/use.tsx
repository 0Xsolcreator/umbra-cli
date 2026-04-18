import {Args, Command} from '@oclif/core';

import {updateConfig} from '../../lib/config.js';
import {readUser} from '../../lib/users.js';

export class UserUseCommand extends Command {
	static override description = 'Set the active user used by all other commands';

	static override args = {
		name: Args.string({
			description: 'Name of the user to activate',
			required: true,
		}),
	};

	async run() {
		const {args} = await this.parse(UserUseCommand);

		// Surface UserNotFoundError early with a friendly message rather than
		// silently pointing `activeUser` at a nonexistent file.
		const user = await readUser(args.name);

		await updateConfig({activeUser: user.name});

		this.log(`✓ Active user: ${user.name} (${user.backend}, ${user.address})`);
	}
}
