export type CommandInfo = {name: string; description: string};

export const COMMANDS: CommandInfo[] = [
	{name: 'init', description: 'Link your keypair and configure the CLI'},
	{name: 'register', description: 'Publish your stealth meta-address on-chain'},
	{name: 'eta deposit', description: 'Move tokens from your public wallet into an encrypted eta'},
	{name: 'eta balance', description: 'Check your encrypted token eta balances'},
	{name: 'eta withdraw', description: 'Move tokens from your encrypted eta back to a public wallet'},
	{name: 'utxo scan', description: 'Scan the chain for unspent stealth UTXOs'},
	{name: 'utxo claim', description: 'Claim scanned UTXOs to your wallet'},
	{name: 'utxo create', description: 'Create a new stealth UTXO'},
];
