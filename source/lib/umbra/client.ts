import {
	type GetUmbraClientArgs,
	type GetUmbraClientDeps,
	getUmbraClient,
} from '@umbra-privacy/sdk';

import {buildSigner, isBackendName} from '../backends/index.js';
import {NoActiveUserError, readConfig} from '../config.js';
import {readUser} from '../users.js';
import {createFileSeedStorage} from './seed-storage.js';
import {createUmbraSignerFromSolanaSigner} from './signer.js';

type UmbraClient = Awaited<ReturnType<typeof getUmbraClient>>;

let _client: UmbraClient | undefined;

/**
 * Eagerly install a pre-built client. Mainly for tests and commands that
 * need to wire up a non-default signer (e.g. an ephemeral keypair) — the
 * normal path is `getClient()` which builds from the on-disk config.
 */
export async function setClient(
	args: GetUmbraClientArgs,
	deps?: GetUmbraClientDeps,
): Promise<void> {
	_client = await getUmbraClient(args, deps);
}

/**
 * Build (or return the cached) Umbra client for the currently-active user.
 *
 * Reads `~/.umbra-cli/config.json` for network settings and the active
 * user name, then loads `~/.umbra-cli/users/<name>.json` to discover the
 * backend + params. The backend registry constructs a `SolanaSigner`,
 * which we wrap in an `IUmbraSigner` adapter for the SDK.
 *
 * Throws `NoActiveUserError` when no user has been selected yet — the
 * commands that depend on a client surface this with instructions to run
 * `umbra user add` / `umbra user use`.
 */
export async function getClient(): Promise<UmbraClient> {
	if (_client) return _client;

	const config = await readConfig();

	if (!config.activeUser) {
		throw new NoActiveUserError();
	}

	const user = await readUser(config.activeUser);

	if (!isBackendName(user.backend)) {
		throw new Error(
			`User "${user.name}" is configured with unsupported backend "${user.backend}". ` +
				`Remove and re-add the user with a currently supported backend.`,
		);
	}

	const solanaSigner = await buildSigner(user.backend, user.params, {
		userName: user.name,
	});
	const signer = createUmbraSignerFromSolanaSigner(solanaSigner);

	await setClient(
		{
			signer,
			network: config.network,
			rpcUrl: config.rpcUrl,
			rpcSubscriptionsUrl: config.rpcSubscriptionsUrl,
			indexerApiEndpoint: config.indexerApiEndpoint,
			deferMasterSeedSignature: config.deferMasterSeedSignature,
		},
		{masterSeedStorage: createFileSeedStorage(user.name)},
	);

	return _client!;
}
