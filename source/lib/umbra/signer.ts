import type {SolanaSigner} from '@solana/keychain-core';
import {createSignableMessage} from '@solana/kit';
import type {
	IUmbraSigner,
	SignableTransaction,
	SignedMessage,
} from '@umbra-privacy/sdk/interfaces';
import type {SignedTransaction} from '@umbra-privacy/sdk/types';

/**
 * Adapt a `SolanaSigner` (the unified interface exported by
 * `@solana/keychain-*` for local keypairs, Privy, Turnkey, Para, etc.)
 * into the `IUmbraSigner` shape that `@umbra-privacy/sdk` expects.
 *
 * Why this adapter exists:
 *
 * The SDK ships `convertSolanaKitKeypairSignerToIUmbraSigner` for message
 * signing, but that helper reaches into `kps.keyPair.privateKey` and calls
 * `signBytes` directly — which is impossible for managed/remote backends
 * (Privy, Turnkey, Para) that never expose private key bytes to the client.
 *
 * Transaction signing mirrors the SDK's own adapter: we call the unified
 * `signTransactions` method, get back a `SignatureDictionary`, and merge
 * it into the original transaction's `signatures` map. Message signing
 * wraps the raw bytes in a `SignableMessage`, delegates to the backend's
 * `signMessages`, and extracts the signature keyed by the signer address.
 */
export function createUmbraSignerFromSolanaSigner(
	signer: SolanaSigner,
): IUmbraSigner {
	return {
		address: signer.address,

		async signTransaction(
			transaction: SignableTransaction,
		): Promise<SignedTransaction> {
			// Cast is unavoidable: SolanaSigner.signTransactions expects the
			// @solana/kit transaction branded with size-limit + lifetime. SDK
			// transactions carry blockhash-lifetime (a subtype) but not the
			// size-limit brand. Runtime shape is identical.
			const [sigDict] = await signer.signTransactions([
				transaction as never,
			]);

			return {
				...transaction,
				signatures: {...transaction.signatures, ...sigDict},
			} as SignedTransaction;
		},

		async signTransactions(
			transactions: readonly SignableTransaction[],
		): Promise<SignedTransaction[]> {
			const sigDicts = await signer.signTransactions(
				transactions as readonly never[],
			);

			return transactions.map(
				(tx, i) =>
					({
						...tx,
						signatures: {...tx.signatures, ...sigDicts[i]},
					}) as SignedTransaction,
			);
		},

		async signMessage(message: Uint8Array): Promise<SignedMessage> {
			const signable = createSignableMessage(message);
			const [sigDict] = await signer.signMessages([signable]);
			const signature = sigDict?.[signer.address];

			if (!signature) {
				throw new Error(
					`Signer "${signer.address}" did not return a signature for the message. ` +
						`Verify the backend is reachable and that the configured address matches ` +
						`the key that signed.`,
				);
			}

			return {
				message,
				signature,
				signer: signer.address,
			};
		},
	};
}
