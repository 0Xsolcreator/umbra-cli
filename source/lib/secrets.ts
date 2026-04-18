/**
 * OS-keychain-backed secret store for backend credentials.
 *
 * Secrets are scoped `(service, account)` = `("umbra-cli", "<userName>:<envKey>")`
 * so that users on the same machine get isolated entries and the env var
 * name doubles as an obvious identifier when inspecting the keychain.
 *
 * Design rules:
 *   - At runtime, env var ALWAYS wins. This guarantees CI and other
 *     headless setups (where the OS keyring daemon isn't running) keep
 *     working regardless of what's in the keychain.
 *   - Keychain access can fail for operational reasons (missing libsecret,
 *     locked keyring, no daemon). Every call here is defensive — callers
 *     get `undefined` / `false` rather than a crash, and can decide
 *     whether the failure is fatal for their flow.
 *
 * `keytar` is loaded lazily so that commands that don't touch secrets
 * (e.g. `umbra config get`) don't pay the native-module load cost or
 * crash on platforms where libsecret is missing.
 */

const SERVICE = 'umbra-cli';

type KeytarLike = {
	getPassword: (service: string, account: string) => Promise<string | null>;
	setPassword: (
		service: string,
		account: string,
		password: string,
	) => Promise<void>;
	deletePassword: (service: string, account: string) => Promise<boolean>;
};

let _keytar: KeytarLike | undefined | null;

async function loadKeytar(): Promise<KeytarLike | undefined> {
	if (_keytar !== undefined) return _keytar ?? undefined;
	try {
		const mod = (await import('keytar')) as unknown as
			| KeytarLike
			| {default: KeytarLike};
		_keytar = 'default' in mod ? mod.default : mod;
		return _keytar;
	} catch {
		_keytar = null;
		return undefined;
	}
}

function accountKey(userName: string, envKey: string): string {
	return `${userName}:${envKey}`;
}

/**
 * Resolve a secret for `(userName, envKey)`. Env var takes precedence so
 * that CI / `export FOO=bar` flows always work. Returns `undefined` if
 * neither source has a value (or if the keychain is unavailable).
 */
export async function getSecret(
	userName: string,
	envKey: string,
): Promise<string | undefined> {
	const fromEnv = process.env[envKey];
	if (fromEnv) return fromEnv;

	const keytar = await loadKeytar();
	if (!keytar) return undefined;

	try {
		const value = await keytar.getPassword(SERVICE, accountKey(userName, envKey));
		return value ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * Persist a secret to the OS keychain. Returns true on success, false if
 * the keychain is unavailable — callers should surface that condition so
 * the user knows to set the env var instead.
 */
export async function setSecret(
	userName: string,
	envKey: string,
	value: string,
): Promise<boolean> {
	const keytar = await loadKeytar();
	if (!keytar) return false;

	try {
		await keytar.setPassword(SERVICE, accountKey(userName, envKey), value);
		return true;
	} catch {
		return false;
	}
}

/**
 * Remove a stored secret. Returns true if a secret was actually deleted,
 * false otherwise (including when the keychain is unavailable). Safe to
 * call on accounts that don't exist.
 */
export async function deleteSecret(
	userName: string,
	envKey: string,
): Promise<boolean> {
	const keytar = await loadKeytar();
	if (!keytar) return false;

	try {
		return await keytar.deletePassword(SERVICE, accountKey(userName, envKey));
	} catch {
		return false;
	}
}

/** Whether the OS keychain is reachable right now. Useful for one-shot preflight checks. */
export async function isKeychainAvailable(): Promise<boolean> {
	const keytar = await loadKeytar();
	if (!keytar) return false;
	try {
		await keytar.getPassword(SERVICE, '__probe__');
		return true;
	} catch {
		return false;
	}
}
