import {Args, Command, Flags} from '@oclif/core';

import {readPluginConfig, writePluginConfig} from '../../lib/plugins.js';
import {readUser} from '../../lib/users.js';

export class PluginUseCommand extends Command {
	static override description =
		'Set the active user for a plugin. Mirrors `umbra user use` but scoped to a single plugin.';

	static override args = {
		plugin: Args.string({
			description: 'Plugin package name (e.g. jup-earn)',
			required: true,
		}),
		username: Args.string({
			description: 'Registered user name to use for this plugin',
			required: false,
		}),
	};

	static override flags = {
		global: Flags.boolean({
			description: 'Clear the plugin override and fall back to the global active user',
		}),
	};

	static override examples = [
		'<%= config.bin %> plugin use jup-earn alice',
		'<%= config.bin %> plugin use jup-earn --global  # clears override',
	];

	async run(): Promise<void> {
		const {args, flags} = await this.parse(PluginUseCommand);
		const current = await readPluginConfig(args.plugin);

		if (flags.global || !args.username) {
			await writePluginConfig(args.plugin, {...current, activeUser: undefined});
			this.log(`✓ Plugin "${args.plugin}" will use global active user`);
		} else {
			const user = await readUser(args.username);
			await writePluginConfig(args.plugin, {...current, activeUser: user.name});
			this.log(`✓ Active user for "${args.plugin}": ${user.name} (${user.backend}, ${user.address})`);
		}
	}
}
