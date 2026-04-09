import * as fs from 'node:fs/promises';
import zod from 'zod';
import {CONFIG_DIR, CONFIG_PATH} from './paths.js';

const CliConfigSchema = zod.object({
	network: zod.enum(['mainnet', 'devnet', 'localnet']),
	rpcUrl: zod.string(),
	rpcSubscriptionsUrl: zod.string(),
	walletPath: zod.string(),
	indexerApiEndpoint: zod.string().optional(),
});

export type CliConfig = zod.infer<typeof CliConfigSchema>;

export class ConfigNotFoundError extends Error {
	constructor() {
		super('Umbra CLI config not found. Run "umbra-cli register" to set up.');
		this.name = 'ConfigNotFoundError';
	}
}

export async function readConfig(): Promise<CliConfig> {
	let raw: string;
	try {
		raw = await fs.readFile(CONFIG_PATH, 'utf-8');
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new ConfigNotFoundError();
		}

		throw err;
	}

	return CliConfigSchema.parse(JSON.parse(raw) as unknown);
}

export async function writeConfig(cfg: CliConfig): Promise<void> {
	await fs.mkdir(CONFIG_DIR, {recursive: true});
	await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
