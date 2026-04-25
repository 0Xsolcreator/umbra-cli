import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {createSolanaRpc, createSolanaRpcSubscriptions} from '@solana/kit';
import zod from 'zod';

import {NoActiveUserError, readConfig} from './config.js';
import {PLUGINS_CONFIG_DIR} from './paths.js';
import {readUser, type UserRecord} from './users.js';

const PluginConfigSchema = zod.object({
	activeUser: zod.string().optional(),
});

export type PluginConfig = zod.infer<typeof PluginConfigSchema>;

/**
 * Converts a plugin name to a safe filename segment.
 * Scoped package names like `@scope/name` become `scope__name`.
 */
export function pluginConfigPath(pluginName: string): string {
	const safe = pluginName.replace(/^@/, '').replace(/\//g, '__');
	return path.join(PLUGINS_CONFIG_DIR, `${safe}.json`);
}

/**
 * Read per-plugin config. Returns an empty config (no overrides) if the
 * file does not exist — first install has no wallet set yet.
 */
export async function readPluginConfig(pluginName: string): Promise<PluginConfig> {
	try {
		const raw = await fs.readFile(pluginConfigPath(pluginName), 'utf-8');
		return PluginConfigSchema.parse(JSON.parse(raw) as unknown);
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return PluginConfigSchema.parse({});
		}

		throw err;
	}
}

export async function writePluginConfig(
	pluginName: string,
	cfg: PluginConfig,
): Promise<void> {
	const parsed = PluginConfigSchema.parse(cfg);
	await fs.mkdir(PLUGINS_CONFIG_DIR, {recursive: true});
	await fs.writeFile(pluginConfigPath(pluginName), JSON.stringify(parsed, null, 2));
}

/**
 * Return the active user for a plugin, or undefined if no override is set.
 * The caller should fall back to the global `activeUser` from config when
 * this returns undefined.
 */
export async function getPluginActiveUser(
	pluginName: string,
): Promise<string | undefined> {
	const cfg = await readPluginConfig(pluginName);
	return cfg.activeUser;
}

/**
 * Resolve the user record for a plugin's active wallet.
 *
 * Resolution order:
 *   1. ~/.umbra-cli/plugins/<pluginName>.json  activeUser override
 *   2. ~/.umbra-cli/config.json                global activeUser
 *   3. throws NoActiveUserError
 */
export async function resolvePluginUser(pluginName: string): Promise<UserRecord> {
	const [pluginCfg, cliCfg] = await Promise.all([
		readPluginConfig(pluginName),
		readConfig(),
	]);
	const userName = pluginCfg.activeUser ?? cliCfg.activeUser;
	if (!userName) throw new NoActiveUserError();
	return readUser(userName);
}

/**
 * Build a Solana RPC client pair from the CLI's network config.
 * Plugins should use this so that `umbra config set rpcUrl ...` is respected.
 */
export async function getPluginRpc(): Promise<{
	rpc: ReturnType<typeof createSolanaRpc>;
	rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
}> {
	const cfg = await readConfig();
	return {
		rpc: createSolanaRpc(cfg.rpcUrl),
		rpcSubscriptions: createSolanaRpcSubscriptions(cfg.rpcSubscriptionsUrl),
	};
}
