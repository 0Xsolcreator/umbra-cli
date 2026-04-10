import {getClaimableUtxoScannerFunction, getUmbraClient} from '@umbra-privacy/sdk';

type UmbraClient = Awaited<ReturnType<typeof getUmbraClient>>;

export function createUtxoScanner(client: UmbraClient) {
	return getClaimableUtxoScannerFunction({client});
}
