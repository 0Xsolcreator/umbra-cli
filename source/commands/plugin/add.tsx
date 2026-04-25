import {Args, Command, Flags} from '@oclif/core';

export class PluginAddCommand extends Command {
	static override description = 'Install a plugin from npm';

	static override args = {
		plugin: Args.string({description: 'npm package name to install', required: true}),
	};

	static override flags = {
		force: Flags.boolean({description: 'Force reinstall if already installed'}),
	};

	static override examples = [
		'<%= config.bin %> plugin add jup-earn',
		'<%= config.bin %> plugin add @myorg/umbra-plugin-defi',
	];

	async run(): Promise<void> {
		const {args, flags} = await this.parse(PluginAddCommand);
		await this.config.runCommand('plugins:install', [
			args.plugin,
			...(flags.force ? ['--force'] : []),
		]);
	}
}
