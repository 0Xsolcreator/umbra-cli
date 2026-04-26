import {getUmbraRelayer} from '@umbra-privacy/sdk';

import {readConfig} from './config.js';
import {RELAYER_DEFAULTS} from './constants.js';

export async function fetchSupportedMints(): Promise<readonly string[]> {
	const {network} = await readConfig();
	const url = RELAYER_DEFAULTS[network];
	if (!url) throw new Error(`No relayer available for network "${network}"`);
	const relayer = getUmbraRelayer({apiEndpoint: url});
	const {mints} = await relayer.getSupportedMints();
	return mints;
}
