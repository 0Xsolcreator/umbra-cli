import {
	isEncryptedDepositError,
	isEncryptedWithdrawalError,
	isRegistrationError,
	isCreateUtxoError,
	isFetchUtxosError,
	isClaimUtxoError,
	// eslint-disable-next-line n/file-extension-in-import
} from '@umbra-privacy/sdk/errors';

export type ErrorState = {status: 'error'; message: string};

export function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function formatRegistrationError(error: unknown): string {
	if (!isRegistrationError(error)) return formatError(error);
	switch (error.stage) {
		case 'master-seed-derivation': {
			return 'Sign the master seed message to proceed.';
		}

		case 'transaction-sign': {
			return 'Transaction signing cancelled.';
		}

		case 'zk-proof-generation': {
			return `ZK proof generation failed: ${error.message}`;
		}

		case 'account-fetch': {
			return `RPC error while checking account state: ${error.message}`;
		}

		case 'transaction-send': {
			return `${error.message} — check on-chain state before retrying.`;
		}

		default: {
			return `Registration failed at stage "${error.stage}": ${error.message}`;
		}
	}
}

export function formatDepositError(error: unknown): string {
	if (!isEncryptedDepositError(error)) return formatError(error);
	switch (error.stage) {
		case 'validation': {
			return `Invalid arguments: ${error.message}`;
		}

		case 'mint-fetch': {
			return `Could not fetch mint account — check RPC connectivity and mint address: ${error.message}`;
		}

		case 'account-fetch': {
			return `Could not fetch destination account: ${error.message}`;
		}

		case 'transaction-sign': {
			return 'Transaction signing cancelled.';
		}

		case 'transaction-validate': {
			return `Pre-flight simulation failed — check funds and account state: ${error.message}`;
		}

		case 'transaction-send': {
			return `${error.message} — check on-chain state before retrying.`;
		}

		default: {
			return `Deposit failed at stage "${error.stage}": ${error.message}`;
		}
	}
}

export function formatWithdrawalError(error: unknown): string {
	if (!isEncryptedWithdrawalError(error)) return formatError(error);
	switch (error.stage) {
		case 'validation': {
			return `Invalid arguments: ${error.message}`;
		}

		case 'mint-fetch': {
			return `Could not fetch mint account — check RPC connectivity and mint address: ${error.message}`;
		}

		case 'instruction-build': {
			return `Could not construct instruction — protocol state mismatch: ${error.message}`;
		}

		case 'transaction-sign': {
			return 'Transaction signing cancelled.';
		}

		case 'transaction-send': {
			return `${error.message} — check on-chain state before retrying.`;
		}

		default: {
			return `Withdrawal failed at stage "${error.stage}": ${error.message}`;
		}
	}
}

export function formatCreateUtxoError(error: unknown): string {
	if (!isCreateUtxoError(error)) return formatError(error);
	switch (error.stage) {
		case 'validation': {
			return `Invalid arguments: ${error.message}`;
		}

		case 'account-fetch': {
			return `Could not fetch recipient account — check RPC and recipient address: ${error.message}`;
		}

		case 'mint-fetch': {
			return `Could not fetch mint account — check RPC and mint address: ${error.message}`;
		}

		case 'zk-proof-generation': {
			return `ZK proof generation failed — try again: ${error.message}`;
		}

		case 'transaction-sign': {
			return 'Transaction signing cancelled.';
		}

		case 'transaction-validate': {
			return `Pre-flight simulation failed — check funds and account state: ${error.message}`;
		}

		case 'transaction-send': {
			return `${error.message} — check on-chain state before retrying.`;
		}

		default: {
			return `UTXO creation failed at stage "${error.stage}": ${error.message}`;
		}
	}
}

export function formatFetchUtxosError(error: unknown): string {
	if (!isFetchUtxosError(error)) return formatError(error);
	switch (error.stage) {
		case 'initialization': {
			return `Indexer not configured — set indexerApiEndpoint in your config: ${error.message}`;
		}

		case 'validation': {
			return `Invalid scan parameters: ${error.message}`;
		}

		case 'key-derivation': {
			return `Key derivation failed: ${error.message}`;
		}

		case 'indexer-fetch': {
			return `Indexer unreachable — check your connection: ${error.message}`;
		}

		case 'proof-fetch': {
			return `Merkle proof fetch failed: ${error.message}`;
		}

		default: {
			return `Scan failed at stage "${error.stage}": ${error.message}`;
		}
	}
}

export function formatClaimUtxoError(error: unknown): string {
	if (!isClaimUtxoError(error)) return formatError(error);
	switch (error.stage) {
		case 'zk-proof-generation': {
			return `ZK proof generation failed — try again: ${error.message}`;
		}

		case 'transaction-sign': {
			return 'Transaction signing cancelled.';
		}

		case 'transaction-validate': {
			return `Pre-flight simulation failed — Merkle proof may be stale, re-scan and retry: ${error.message}`;
		}

		case 'transaction-send': {
			return `${error.message} — verify on-chain before retrying, nullifier may already be burned.`;
		}

		default: {
			return `Claim failed at stage "${error.stage}": ${error.message}`;
		}
	}
}
