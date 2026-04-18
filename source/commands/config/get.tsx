import {Args, Command} from '@oclif/core';
import chalk from 'chalk';

import {
	CONFIG_KEYS,
	isConfigKey,
	readConfig,
	type CliConfig,
} from '../../lib/config.js';
import {CONFIG_PATH} from '../../lib/paths.js';

function formatValue(v: unknown): string {
	if (v === undefined) return '(unset)';
	return String(v);
}

export class ConfigGetCommand extends Command {
	static override description =
		'Print a single config value, or all values when called with no key';

	static override args = {
		key: Args.string({
			description: `Optional config key. One of: ${CONFIG_KEYS.join(', ')}`,
			required: false,
		}),
	};

	async run() {
		const {args} = await this.parse(ConfigGetCommand);
		const config: CliConfig = await readConfig();

		if (args.key === undefined) {
			this.log(`${chalk.bold.cyan('Config file')}: ${CONFIG_PATH}`);
			for (const key of CONFIG_KEYS) {
				this.log(`${chalk.bold.cyan(key)}: ${formatValue(config[key])}`);
			}

			return;
		}

		if (!isConfigKey(args.key)) {
			this.error(
				`Unknown config key "${args.key}". Valid keys: ${CONFIG_KEYS.join(
					', ',
				)}`,
			);
		}

		this.log(formatValue(config[args.key]));
	}
}
