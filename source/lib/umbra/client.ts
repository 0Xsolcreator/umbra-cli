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

async function buildClientForUser(userName: string): Promise<UmbraClient> {
	const config = await readConfig();
	const user = await readUser(userName);

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

	return getUmbraClient(
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
}

/**
 * Build (or return the cached) Umbra client.
 *
 * When `userName` is provided the client is built for that user directly,
 * bypassing the active-user config. This lets concurrent automation threads
 * each target their own user without racing to mutate the global active-user
 * pointer.
 *
 * With no argument, reads `config.activeUser` and caches the result for the
 * lifetime of the process (safe because each CLI invocation is one process).
 *
 * Throws `NoActiveUserError` when no user has been selected and no explicit
 * name was given — commands surface this with instructions to run
 * `umbra user add` / `umbra user use`.
 */
export async function getClient(userName?: string): Promise<UmbraClient> {
	if (userName !== undefined) {
		return buildClientForUser(userName);
	}

	if (_client) return _client;

	const config = await readConfig();

	if (!config.activeUser) {
		throw new NoActiveUserError();
	}

	_client = await buildClientForUser(config.activeUser);
	return _client;
}
