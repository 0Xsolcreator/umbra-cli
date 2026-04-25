import {Args, Command} from '@oclif/core';

export class PluginRemoveCommand extends Command {
	static override description = 'Uninstall a plugin';

	static override args = {
		plugin: Args.string({description: 'Plugin package name to remove', required: true}),
	};

	static override examples = [
		'<%= config.bin %> plugin remove jup-earn',
	];

	async run(): Promise<void> {
		const {args} = await this.parse(PluginRemoveCommand);
		await this.config.runCommand('plugins:uninstall', [args.plugin]);
	}
}
