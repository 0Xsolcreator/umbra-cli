import React, {useEffect, useState} from 'react';
import {Box, Text, render, useApp} from 'ink';
import {Command, Flags, Args} from '@oclif/core';

import {
	BACKEND_NAMES,
	buildSigner,
	getBackend,
	isBackendName,
	listBackends,
	parseParamFlags,
	validateParams,
	type BackendName,
} from '../../lib/backends/index.js';
import {writeUser, assertValidUserName} from '../../lib/users.js';
import {updateConfig, readConfig} from '../../lib/config.js';
import {promptSecret} from '../../lib/prompt.js';
import {setSecret} from '../../lib/secrets.js';
import {ErrorMessage, Row, Spinner} from '../../components/index.js';
import {type ErrorState} from '../../lib/errors.js';

type Props = {
	options: {
		name: string;
		backend: BackendName;
		params: Record<string, string>;
		activate: boolean;
		keychainWarnings: readonly string[];
	};
};

type State =
	| {status: 'resolving'}
	| {status: 'success'; address: string; activated: boolean}
	| ErrorState;

export default function UserAdd({options: opts}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({status: 'resolving'});

	useEffect(() => {
		async function run() {
			try {
				// Cheap sync validation already ran in the command's `run()`
				// method so misuse fails fast with a non-zero exit code.
				// Here we only handle async work: building the signer (which
				// may hit the network or disk) and persisting the user record.
				const signer = await buildSigner(opts.backend, opts.params, {
					userName: opts.name,
				});

				await writeUser({
					name: opts.name,
					backend: opts.backend,
					address: signer.address,
					params: opts.params,
				});

				let activated = opts.activate;
				if (!activated) {
					// First user configured? Auto-select it so the common first-run
					// flow (add one user, then run a command) just works.
					const config = await readConfig();
					if (!config.activeUser) {
						await updateConfig({activeUser: opts.name});
						activated = true;
					}
				} else {
					await updateConfig({activeUser: opts.name});
				}

				setState({status: 'success', address: signer.address, activated});
			} catch (err: unknown) {
				setState({
					status: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				exit();
			}
		}

		void run();
	}, []);

	if (state.status === 'resolving')
		return <Spinner label={`Configuring ${opts.backend} backend...`} />;

	if (state.status === 'error')
		return <ErrorMessage title="Failed to add user" detail={state.message} />;

	return (
		<Box flexDirection="column">
			<Text color="green">✓ User &quot;{opts.name}&quot; added</Text>
			<Box flexDirection="column" marginTop={1} marginLeft={2}>
				<Row label="Backend" value={opts.backend} />
				<Row label="Address" value={state.address} />
				{state.activated && <Row label="Active" value="yes" />}
			</Box>
			{opts.keychainWarnings.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">
						⚠ Could not save the following to the OS keychain:
					</Text>
					{opts.keychainWarnings.map(key => (
						<Text key={key} color="yellow">
							{'  '}- {key}
						</Text>
					))}
					<Text color="yellow">
						Export these as environment variables before running other
						commands.
					</Text>
				</Box>
			)}
		</Box>
	);
}

function buildBackendsHelp(): string {
	const lines = [
		'Add a signer user backed by a local keypair or a managed wallet provider',
		'',
		'Backend parameters:',
	];
	for (const backend of listBackends()) {
		lines.push(`  ${backend.name}: ${backend.description}`);
		if (backend.params.length === 0) {
			lines.push('    (no --param flags required)');
		} else {
			for (const p of backend.params) {
				lines.push(
					`    --param ${p.name}=...  (${p.required ? 'required' : 'optional'}) ${p.description}`,
				);
			}
		}
		for (const s of backend.envSecrets) {
			lines.push(`    --secret ${s.key}=...  (required) ${s.description}`);
		}
	}
	return lines.join('\n');
}

export class UserAddCommand extends Command {
	static override description = buildBackendsHelp();

	static override args = {
		name: Args.string({
			description: 'Name for this user (letters, digits, "-", "_")',
			required: true,
		}),
	};

	static override flags = {
		backend: Flags.string({
			description: 'Signer backend type',
			options: [...BACKEND_NAMES],
			required: true,
		}),
		param: Flags.string({
			description:
				'Backend parameter as key=value (repeat for multiple). See "umbra user add --help" output.',
			multiple: true,
			default: [],
		}),
		secret: Flags.string({
			description:
				'Backend secret as ENV_KEY=value (repeat for multiple). Values are stored in the OS keychain. Omit to be prompted interactively.',
			multiple: true,
			default: [],
		}),
		activate: Flags.boolean({
			description: 'Set this user as the active user after adding',
			default: false,
		}),
	};

	static override examples = [
		'<%= config.bin %> user add alice --backend local',
		'<%= config.bin %> user add alice --backend local --param keypair=/path/to/id.json',
		'<%= config.bin %> user add alice --backend privy --param appId=... --param walletId=...',
		'<%= config.bin %> user add alice --backend privy --param appId=... --param walletId=... --secret PRIVY_APP_SECRET=...',
		'<%= config.bin %> user add alice --backend turnkey --param apiPublicKey=... --param organizationId=... --param privateKeyId=... --param publicKey=...',
		'<%= config.bin %> user add alice --backend para --param walletId=...',
	];

	async run() {
		const {args, flags} = await this.parse(UserAddCommand);

		if (!isBackendName(flags.backend)) {
			this.error(
				`Unknown backend "${flags.backend}". Expected one of: ${BACKEND_NAMES.join(', ')}`,
			);
		}

		let params: Record<string, string>;
		let secretFlags: Record<string, string>;
		try {
			params = parseParamFlags(flags.param);
			secretFlags = parseParamFlags(flags.secret);
		} catch (err) {
			this.error(err instanceof Error ? err.message : String(err));
		}

		const backend = getBackend(flags.backend);

		// Do all the cheap, synchronous validation here (before we spin up
		// Ink) so that misuse errors surface with a non-zero exit code and
		// a visible message rather than disappearing behind the spinner.
		try {
			assertValidUserName(args.name);
			validateParams(backend, params);
		} catch (err) {
			this.error(err instanceof Error ? err.message : String(err));
		}

		// Reject `--secret` entries that don't correspond to a declared secret
		// for this backend, matching the strictness of `--param` validation.
		const knownSecrets = new Set(backend.envSecrets.map(s => s.key));
		for (const key of Object.keys(secretFlags)) {
			if (!knownSecrets.has(key)) {
				this.error(
					`Unknown secret "${key}" for backend "${backend.name}". ` +
						`Expected one of: ${[...knownSecrets].join(', ') || '(none)'}`,
				);
			}
		}

		// Resolve each declared secret in priority order:
		//   1. --secret flag  → save to keychain (explicit user intent)
		//   2. env var        → leave alone, buildSigner will pick it up
		//   3. interactive    → prompt (requires TTY), then save to keychain
		const secretsToSave: Array<{key: string; value: string}> = [];
		for (const envSecret of backend.envSecrets) {
			const fromFlag = secretFlags[envSecret.key];
			if (fromFlag !== undefined) {
				secretsToSave.push({key: envSecret.key, value: fromFlag});
				continue;
			}
			if (process.env[envSecret.key]) {
				// Runtime env var is set — no need to save, buildSigner finds it.
				continue;
			}
			if (!process.stdin.isTTY) {
				this.error(
					`Backend "${backend.name}" requires secret "${envSecret.key}" ` +
						`(${envSecret.description}). ` +
						`Pass --secret ${envSecret.key}=... or export ${envSecret.key}=... before running.`,
				);
			}
			this.log(`\nEnter ${envSecret.description}`);
			const value = await promptSecret(`  ${envSecret.key}: `);
			if (!value) {
				this.error(`No value provided for ${envSecret.key}`);
			}
			secretsToSave.push({key: envSecret.key, value});
		}

		// Persist secrets before we start the Ink UI — `buildSigner` reads
		// them back via `getSecret()` which checks env first then keychain.
		// If the keychain write fails (headless Linux, locked keyring, …)
		// fall back to stuffing the value into this process's env so the
		// signer can still resolve the address; then warn the user that
		// they'll need an env var for future runs.
		const keychainWarnings: string[] = [];
		for (const {key, value} of secretsToSave) {
			const ok = await setSecret(args.name, key, value);
			if (!ok) {
				process.env[key] = value;
				keychainWarnings.push(key);
			}
		}

		const {waitUntilExit} = render(
			<UserAdd
				options={{
					name: args.name,
					backend: flags.backend,
					params,
					activate: flags.activate,
					keychainWarnings,
				}}
			/>,
		);
		await waitUntilExit();
	}
}
