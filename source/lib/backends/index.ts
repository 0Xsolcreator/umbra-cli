import type {SolanaSigner} from '@solana/keychain-core';

import {localBackend} from './local.js';
import {privyBackend} from './privy.js';
import {turnkeyBackend} from './turnkey.js';
import {paraBackend} from './para.js';
import type {BackendDefinition, BuildSignerContext} from './types.js';

/**
 * Registry of supported signer backends. To add a new backend:
 *   1. Create a new file under `source/lib/backends/` exporting a
 *      `BackendDefinition`.
 *   2. Import it here and add it to this object.
 *
 * The registry's keys determine the set of `--backend` values the
 * `user add` command will accept — nothing outside this list is reachable.
 */
const BACKENDS = {
	local: localBackend,
	privy: privyBackend,
	turnkey: turnkeyBackend,
	para: paraBackend,
} as const satisfies Record<string, BackendDefinition>;

export type BackendName = keyof typeof BACKENDS;

export const BACKEND_NAMES = Object.keys(BACKENDS) as BackendName[];

export function isBackendName(value: string): value is BackendName {
	return value in BACKENDS;
}

export function getBackend(name: BackendName): BackendDefinition {
	return BACKENDS[name];
}

export function listBackends(): readonly BackendDefinition[] {
	return Object.values(BACKENDS);
}

/**
 * Parse an array of `key=value` strings (from `--param` repeated flags)
 * into a map. Throws if any entry is missing an `=` or has an empty key.
 */
export function parseParamFlags(
	raw: readonly string[],
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const arg of raw) {
		const eq = arg.indexOf('=');
		if (eq <= 0) {
			throw new Error(
				`Invalid --param value "${arg}". Expected format: key=value`,
			);
		}

		const key = arg.slice(0, eq);
		const value = arg.slice(eq + 1);
		out[key] = value;
	}

	return out;
}

/**
 * Verify a parsed param map against a backend's schema. Throws on missing
 * required params or unknown keys.
 */
export function validateParams(
	backend: BackendDefinition,
	params: Readonly<Record<string, string>>,
): void {
	const allowed = new Set(backend.params.map(p => p.name));
	for (const key of Object.keys(params)) {
		if (!allowed.has(key)) {
			throw new Error(
				`Unknown parameter "${key}" for backend "${backend.name}". ` +
					`Expected one of: ${[...allowed].join(', ') || '(none)'}`,
			);
		}
	}

	const missing = backend.params
		.filter(p => p.required && !(p.name in params))
		.map(p => p.name);
	if (missing.length > 0) {
		throw new Error(
			`Missing required parameter${missing.length === 1 ? '' : 's'} for backend "${
				backend.name
			}": ${missing.join(', ')}`,
		);
	}
}

/** Build a SolanaSigner for the named backend from a parsed params map. */
export async function buildSigner(
	name: BackendName,
	params: Readonly<Record<string, string>>,
	ctx: BuildSignerContext,
): Promise<SolanaSigner> {
	const backend = getBackend(name);
	validateParams(backend, params);
	return backend.buildSigner(params, ctx);
}

export type {
	BackendDefinition,
	BackendParam,
	BackendEnvSecret,
	BuildSignerContext,
} from './types.js';
