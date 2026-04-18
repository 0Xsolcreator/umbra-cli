import * as fs from 'node:fs/promises';
import zod from 'zod';

import {BACKEND_NAMES, type BackendName} from './backends/index.js';
import {USERS_DIR, userFilePath} from './paths.js';

/**
 * Persisted per-user record. Lives at `~/.umbra-cli/users/<name>.json`.
 *
 * This file contains ONLY non-sensitive configuration — the backend's
 * identifier, the resolved Solana address (for display / quick reference),
 * and the parameter map the backend needs to rebuild a signer. Secrets
 * (API keys, app secrets) are always read from environment variables at
 * runtime and are never written to disk.
 */
const UserRecordSchema = zod.object({
	name: zod.string().min(1),
	backend: zod.enum(BACKEND_NAMES as [BackendName, ...BackendName[]]),
	address: zod.string().min(1),
	params: zod.record(zod.string(), zod.string()).default({}),
});

export type UserRecord = zod.infer<typeof UserRecordSchema>;

export class UserNotFoundError extends Error {
	constructor(public readonly userName: string) {
		super(
			`User "${userName}" not found. Run "umbra user list" to see configured users, ` +
				`or "umbra user add ${userName} --backend <backend>" to create it.`,
		);
		this.name = 'UserNotFoundError';
	}
}

export class UserAlreadyExistsError extends Error {
	constructor(public readonly userName: string) {
		super(
			`User "${userName}" already exists. Remove it first with "umbra user remove ${userName}".`,
		);
		this.name = 'UserAlreadyExistsError';
	}
}

/**
 * User names are used as filenames, so restrict them to a safe alphabet.
 * This mirrors conventions in tools like `solana-keygen` / `jup-cli`.
 */
const USER_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function assertValidUserName(name: string): void {
	if (!USER_NAME_PATTERN.test(name)) {
		throw new Error(
			`Invalid user name "${name}". ` +
				`Allowed characters: letters, digits, "-", "_".`,
		);
	}
}

export async function readUser(name: string): Promise<UserRecord> {
	assertValidUserName(name);

	let raw: string;
	try {
		raw = await fs.readFile(userFilePath(name), 'utf-8');
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new UserNotFoundError(name);
		}

		throw err;
	}

	return UserRecordSchema.parse(JSON.parse(raw) as unknown);
}

export async function userExists(name: string): Promise<boolean> {
	assertValidUserName(name);
	try {
		await fs.access(userFilePath(name));
		return true;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return false;
		}

		throw err;
	}
}

export async function writeUser(
	user: UserRecord,
	{overwrite = false}: {overwrite?: boolean} = {},
): Promise<void> {
	const parsed = UserRecordSchema.parse(user);
	assertValidUserName(parsed.name);

	await fs.mkdir(USERS_DIR, {recursive: true});

	if (!overwrite && (await userExists(parsed.name))) {
		throw new UserAlreadyExistsError(parsed.name);
	}

	await fs.writeFile(
		userFilePath(parsed.name),
		JSON.stringify(parsed, null, 2),
	);
}

export async function removeUser(name: string): Promise<void> {
	assertValidUserName(name);
	try {
		await fs.unlink(userFilePath(name));
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new UserNotFoundError(name);
		}

		throw err;
	}
}

export async function listUsers(): Promise<UserRecord[]> {
	let entries: string[];
	try {
		entries = await fs.readdir(USERS_DIR);
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}

		throw err;
	}

	const names = entries
		.filter(f => f.endsWith('.json'))
		.map(f => f.slice(0, -'.json'.length))
		.filter(name => USER_NAME_PATTERN.test(name))
		.sort();

	const out: UserRecord[] = [];
	for (const name of names) {
		try {
			out.push(await readUser(name));
		} catch {
			// Skip malformed user files rather than crashing the whole listing.
			// `user list` will silently omit them; `user use <name>` will still
			// surface a parse error for the specific bad file.
		}
	}

	return out;
}
