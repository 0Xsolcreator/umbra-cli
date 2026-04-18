import {Args, Command} from '@oclif/core';

import {
	CONFIG_KEYS,
	isConfigKey,
	parseConfigValue,
	updateConfig,
} from '../../lib/config.js';

export class ConfigSetCommand extends Command {
	static override description = 'Set a CLI-wide config value';

	static override args = {
		key: Args.string({
			description: `Config key. One of: ${CONFIG_KEYS.join(', ')}`,
			required: true,
		}),
		value: Args.string({
			description: 'Value to assign to the key',
			required: true,
		}),
	};

	static override examples = [
		'<%= config.bin %> config set network mainnet',
		'<%= config.bin %> config set rpcUrl https://api.mainnet-beta.solana.com',
		'<%= config.bin %> config set deferMasterSeedSignature true',
	];

	async run() {
		const {args} = await this.parse(ConfigSetCommand);

		if (!isConfigKey(args.key)) {
			this.error(
				`Unknown config key "${args.key}". Valid keys: ${CONFIG_KEYS.join(
					', ',
				)}`,
			);
		}

		let parsed: unknown;
		try {
			parsed = parseConfigValue(args.key, args.value);
		} catch (err) {
			this.error(err instanceof Error ? err.message : String(err));
		}

		await updateConfig({[args.key]: parsed});
		this.log(`✓ ${args.key} = ${args.value}`);
	}
}
