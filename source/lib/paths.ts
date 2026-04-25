import * as os from 'node:os';
import * as path from 'node:path';

export const CONFIG_DIR = path.join(os.homedir(), '.umbra-cli');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const USERS_DIR = path.join(CONFIG_DIR, 'users');
export const SEEDS_DIR = path.join(CONFIG_DIR, 'seeds');
export const PLUGINS_CONFIG_DIR = path.join(CONFIG_DIR, 'plugins');
export const DEFAULT_KEYPAIR_PATH = path.join(
	os.homedir(),
	'.config',
	'solana',
	'id.json',
);

export function userFilePath(name: string): string {
	return path.join(USERS_DIR, `${name}.json`);
}

export function seedFilePath(name: string): string {
	return path.join(SEEDS_DIR, `${name}.seed`);
}
