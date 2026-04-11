/** Config */
export {
	type CliConfig,
	ConfigNotFoundError,
	readConfig,
	writeConfig,
} from './config.js';

/** Umbra SDK client and primitives */
export {getClient, setClient} from './umbra/client.js';

export {createFileSeedStorage} from './umbra/seed-storage.js';
export {createUtxoScanner, scanAllUtxos} from './umbra/scanner.js';
export type {ScanAllOptions, ScanAllResult, ScanProgress} from './umbra/scanner.js';
export {createSignerFromKeypairFile} from './umbra/signer.js';

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
