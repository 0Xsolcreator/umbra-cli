import * as os from 'node:os';
import * as path from 'node:path';

export const CONFIG_DIR = path.join(os.homedir(), '.umbra-cli');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const SEED_PATH = path.join(CONFIG_DIR, 'master.seed');
