import {
	type GetUmbraClientArgs,
	type GetUmbraClientDeps,
	getUmbraClient,
} from '@umbra-privacy/sdk';

import {ConfigNotFoundError, readConfig} from '../config.js';
import {createFileSeedStorage} from './seed-storage.js';
import {createSignerFromKeypairFile} from './signer.js';

type UmbraClient = Awaited<ReturnType<typeof getUmbraClient>>;

let _client: UmbraClient | undefined;

export async function setClient(
	args: GetUmbraClientArgs,
	deps?: GetUmbraClientDeps,
): Promise<void> {
	_client = await getUmbraClient(args, deps);
}

export async function getClient(): Promise<UmbraClient> {
	if (_client) return _client;

	let config;
	try {
		config = await readConfig();
	} catch (err: unknown) {
		if (err instanceof ConfigNotFoundError) {
			throw new Error("Umbra client not initialized. Run 'umbra init' first.");
		}

		throw err;
	}

	const signer = await createSignerFromKeypairFile(config.walletPath);

	await setClient(
		{
			signer,
			network: config.network,
			rpcUrl: config.rpcUrl,
			rpcSubscriptionsUrl: config.rpcSubscriptionsUrl,
			indexerApiEndpoint: config.indexerApiEndpoint,
			deferMasterSeedSignature: config.deferMasterSeedSignature,
		},
		{masterSeedStorage: createFileSeedStorage()},
	);

	return _client!;
}
