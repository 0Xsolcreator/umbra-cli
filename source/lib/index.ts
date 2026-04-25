/** Config */
export {
	type CliConfig,
	type ConfigKey,
	CONFIG_KEYS,
	NoActiveUserError,
	isConfigKey,
	parseConfigValue,
	readConfig,
	updateConfig,
	writeConfig,
} from './config.js';

/** Users */
export {
	type UserRecord,
	UserAlreadyExistsError,
	UserNotFoundError,
	listUsers,
	readUser,
	removeUser,
	userExists,
	writeUser,
} from './users.js';

/** Backend registry */
export {
	type BackendDefinition,
	type BackendEnvSecret,
	type BackendName,
	type BackendParam,
	type BuildSignerContext,
	BACKEND_NAMES,
	buildSigner,
	getBackend,
	isBackendName,
	listBackends,
	parseParamFlags,
	validateParams,
} from './backends/index.js';

/** Per-user secrets (OS keychain, env-var overridable) */
export {
	deleteSecret,
	getSecret,
	isKeychainAvailable,
	setSecret,
} from './secrets.js';

/** Interactive prompt helpers */
export {promptSecret} from './prompt.js';

/** Umbra SDK client and primitives */
export {getClient, setClient} from './umbra/client.js';

export {createFileSeedStorage} from './umbra/seed-storage.js';
export {createUtxoScanner, scanAllUtxos, scanAcrossTrees} from './umbra/scanner.js';
export type {
	ScanAllOptions,
	ScanAllResult,
	ScanProgress,
	MultiTreeScanOptions,
	MultiTreeScanProgress,
	MultiTreeScanResult,
} from './umbra/scanner.js';
export {createUmbraSignerFromSolanaSigner} from './umbra/signer.js';

/** Per-plugin config, wallet resolution, and RPC helpers for plugin authors */
export {
	type PluginConfig,
	getPluginActiveUser,
	getPluginRpc,
	pluginConfigPath,
	readPluginConfig,
	resolvePluginUser,
	writePluginConfig,
} from './plugins.js';

/** Error formatting */
export {
	type ErrorState,
	formatError,
	formatRegistrationError,
	formatDepositError,
	formatWithdrawalError,
	formatCreateUtxoError,
	formatFetchUtxosError,
	formatClaimUtxoError,
} from './errors.js';

/** Formatting utilities */
export {shortenPath} from './format.js';
