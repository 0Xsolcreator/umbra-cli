import {Command} from '@oclif/core';

export class PluginListCommand extends Command {
	static override description = 'List installed plugins';

	static override examples = [
		'<%= config.bin %> plugin list',
	];

	async run(): Promise<void> {
		await this.config.runCommand('plugins', []);
	}
}
