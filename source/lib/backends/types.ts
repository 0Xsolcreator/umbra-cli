import type {SolanaSigner} from '@solana/keychain-core';

/** Spec for a single `--param key=value` flag accepted by a backend. */
export type BackendParam = {
	readonly name: string;
	readonly required: boolean;
	readonly description: string;
};

/**
 * Secret material a backend needs to sign. `envKey` doubles as the env
 * var name (runtime override) AND the keychain account suffix — see
 * `source/lib/secrets.ts`. `description` shows up in the interactive
 * prompt when `user add` asks the user for the value.
 */
export type BackendEnvSecret = {
	readonly key: string;
	readonly description: string;
};

/**
 * Context passed to `buildSigner` so the implementation can look up
 * per-user secrets. `userName` scopes keychain entries so that multiple
 * users configured on the same machine don't collide.
 */
export type BuildSignerContext = {
	readonly userName: string;
};

/** Description of a backend for the user-facing `user add` command. */
export type BackendDefinition = {
	readonly name: string;
	readonly description: string;
	readonly params: readonly BackendParam[];
	readonly envSecrets: readonly BackendEnvSecret[];
	readonly buildSigner: (
		params: Readonly<Record<string, string>>,
		ctx: BuildSignerContext,
	) => Promise<SolanaSigner>;
};
