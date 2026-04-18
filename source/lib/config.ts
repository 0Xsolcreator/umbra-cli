import * as fs from 'node:fs/promises';
import zod from 'zod';

import {CONFIG_DIR, CONFIG_PATH} from './paths.js';

/**
 * CLI-wide configuration. Per-user signer details live in
 * `~/.umbra-cli/users/<name>.json` (see `./users.ts`) — this file only
 * holds network settings, the active user pointer, and global flags.
 *
 * All fields have defaults so that first-run commands (e.g. `umbra config
 * get`) work without requiring an explicit init step. `umbra config set
 * <key> <value>` writes the file lazily on first update.
 */
const CliConfigSchema = zod.object({
	network: zod.enum(['mainnet', 'devnet', 'localnet']).default('devnet'),
	rpcUrl: zod.string().default('https://api.devnet.solana.com'),
	rpcSubscriptionsUrl: zod.string().default('wss://api.devnet.solana.com'),
	indexerApiEndpoint: zod.string().optional(),
	deferMasterSeedSignature: zod.boolean().default(false),
	activeUser: zod.string().optional(),
});

export type CliConfig = zod.infer<typeof CliConfigSchema>;

/**
 * Keys that `umbra config set/get` accepts. Kept explicit so that
 * user-facing error messages can enumerate valid options and so that
 * typos (`rpcurl` vs `rpcUrl`) surface immediately.
 */
export const CONFIG_KEYS = [
	'network',
	'rpcUrl',
	'rpcSubscriptionsUrl',
	'indexerApiEndpoint',
	'deferMasterSeedSignature',
	'activeUser',
] as const satisfies ReadonlyArray<keyof CliConfig>;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export function isConfigKey(value: string): value is ConfigKey {
	return (CONFIG_KEYS as readonly string[]).includes(value);
}

export class NoActiveUserError extends Error {
	constructor() {
		super(
			'No active user is set. Add one with "umbra user add <name> --backend <backend>" ' +
				'and select it with "umbra user use <name>".',
		);
		this.name = 'NoActiveUserError';
	}
}

/**
 * Read the config file, applying defaults for any missing fields. If the
 * file does not exist, returns a fully-defaulted config without writing
 * anything to disk (the file is created lazily on first `writeConfig`).
 */
export async function readConfig(): Promise<CliConfig> {
	let raw: string;
	try {
		raw = await fs.readFile(CONFIG_PATH, 'utf-8');
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return CliConfigSchema.parse({});
		}

		throw err;
	}

	return CliConfigSchema.parse(JSON.parse(raw) as unknown);
}

export async function writeConfig(cfg: CliConfig): Promise<void> {
	const parsed = CliConfigSchema.parse(cfg);
	await fs.mkdir(CONFIG_DIR, {recursive: true});
	await fs.writeFile(CONFIG_PATH, JSON.stringify(parsed, null, 2));
}

/**
 * Merge `patch` into the on-disk config and persist. Unknown keys are
 * rejected by the zod schema. Use this from `config set` so that callers
 * don't have to read-modify-write themselves.
 */
export async function updateConfig(
	patch: Partial<CliConfig>,
): Promise<CliConfig> {
	const current = await readConfig();
	const next = CliConfigSchema.parse({...current, ...patch});
	await writeConfig(next);
	return next;
}

/**
 * Parse a string value from `config set <key> <value>` into the correct
 * runtime type for that key (booleans, enum-validated network, etc).
 * Throws on invalid values so that the command can surface a clear error.
 */
export function parseConfigValue(key: ConfigKey, raw: string): unknown {
	switch (key) {
		case 'deferMasterSeedSignature': {
			if (raw === 'true') return true;
			if (raw === 'false') return false;
			throw new Error(
				`Invalid value for ${key}: "${raw}". Expected "true" or "false".`,
			);
		}

		case 'network': {
			if (raw !== 'mainnet' && raw !== 'devnet' && raw !== 'localnet') {
				throw new Error(
					`Invalid value for ${key}: "${raw}". Expected mainnet, devnet, or localnet.`,
				);
			}

			return raw;
		}

		default:
			return raw;
	}
}
