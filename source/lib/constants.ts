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

export const DEFAULT_INDEXER_ENDPOINT = 'https://indexer.api.umbraprivacy.com';
