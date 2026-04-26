export const NETWORK_DEFAULTS = {
	mainnet: {
		rpcUrl: 'https://api.mainnet-beta.solana.com',
		rpcSubscriptionsUrl: 'wss://api.mainnet-beta.solana.com',
	},
	devnet: {
		rpcUrl: 'https://api.devnet.solana.com',
		rpcSubscriptionsUrl: 'wss://api.devnet.solana.com',
	},
	localnet: {
		rpcUrl: 'http://127.0.0.1:8899',
		rpcSubscriptionsUrl: 'ws://127.0.0.1:8900',
	},
} as const;

export const DEFAULT_INDEXER_ENDPOINT =
	'https://utxo-indexer.api-devnet.umbraprivacy.com';

export const RELAYER_DEFAULTS: Partial<Record<string, string>> = {
	mainnet: 'https://relayer.api-mainnet.umbraprivacy.com',
	devnet: 'https://relayer.api-devnet.umbraprivacy.com',
};

export const KNOWN_MINT_SYMBOLS: Record<string, string> = {
	So11111111111111111111111111111111111111112: 'Wrapped SOL',
	EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
	Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
	PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta: 'UMBRA',
};
