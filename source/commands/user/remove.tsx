import * as fs from 'node:fs/promises';

import {Args, Command, Flags} from '@oclif/core';

import {getBackend, isBackendName} from '../../lib/backends/index.js';
import {readConfig, updateConfig} from '../../lib/config.js';
import {seedFilePath} from '../../lib/paths.js';
import {deleteSecret} from '../../lib/secrets.js';
import {readUser, removeUser} from '../../lib/users.js';

export class UserRemoveCommand extends Command {
	static override description =
		'Remove a user and (optionally) its stored master seed';

	static override args = {
		name: Args.string({
			description: 'Name of the user to remove',
			required: true,
		}),
	};

	static override flags = {
		'keep-seed': Flags.boolean({
			description:
				"Don't delete the user's master seed file; only remove the user record",
			default: false,
		}),
		'keep-secrets': Flags.boolean({
			description: "Don't delete the user's secrets from the OS keychain",
			default: false,
		}),
	};

	async run() {
		const {args, flags} = await this.parse(UserRemoveCommand);

		// Peek at the user record before deleting so we know which keychain
		// entries to clean up. If the read fails (e.g. user doesn't exist),
		// let `removeUser()` below raise the user-facing error.
		let secretKeys: readonly string[] = [];
		try {
			const user = await readUser(args.name);
			if (isBackendName(user.backend)) {
				secretKeys = getBackend(user.backend).envSecrets.map(s => s.key);
			}
		} catch {
			// Best-effort; fall through and let removeUser surface the real error.
		}

		await removeUser(args.name);

		const deletedSecrets: string[] = [];
		if (!flags['keep-secrets']) {
			for (const key of secretKeys) {
				const ok = await deleteSecret(args.name, key);
				if (ok) deletedSecrets.push(key);
			}
		}

		let seedDeleted = false;
		if (!flags['keep-seed']) {
			try {
				await fs.unlink(seedFilePath(args.name));
				seedDeleted = true;
			} catch (err: unknown) {
				if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
					throw err;
				}
			}
		}

		// If this was the active user, clear the pointer so commands don't try
		// to load a user that no longer exists.
		const config = await readConfig();
		if (config.activeUser === args.name) {
			await updateConfig({activeUser: undefined});
			this.log(`✓ User "${args.name}" removed. No active user set.`);
		} else {
			this.log(`✓ User "${args.name}" removed.`);
		}

		if (seedDeleted) {
			this.log('  Deleted master seed file.');
		}
		if (deletedSecrets.length > 0) {
			this.log(`  Deleted keychain secrets: ${deletedSecrets.join(', ')}.`);
		}
	}
}
