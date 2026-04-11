/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';

// --- Module mocks ---
// Bun registers these before resolving static imports in this file,
// so the component picks up the mocked versions when it loads.

const mockWriteConfig = mock(async (_cfg: unknown) => {});
const mockAccess = mock(async (_path: unknown, _mode?: unknown) => {});
const mockCreateSigner = mock(async (_path: unknown) => ({} as any));

mock.module('node:fs/promises', () => ({
	access: mockAccess,
}));

mock.module('../../source/lib/config.js', () => ({
	writeConfig: mockWriteConfig,
}));

mock.module('../../source/lib/umbra/signer.js', () => ({
	createSignerFromKeypairFile: mockCreateSigner,
}));

import Init from '../../source/commands/init.js';
import {
	DEFAULT_INDEXER_ENDPOINT,
	NETWORK_DEFAULTS,
} from '../../source/lib/constants.js';
import {DEFAULT_KEYPAIR_PATH} from '../../source/lib/paths.js';
import {waitFor} from '../utils.js';

// Fully-resolved option object matching Zod defaults.
const defaultOptions = {
	keypair: DEFAULT_KEYPAIR_PATH,
	network: 'devnet' as const,
	rpcUrl: undefined,
	rpcSubscriptionsUrl: undefined,
	indexerEndpoint: DEFAULT_INDEXER_ENDPOINT,
	deferMasterSeed: false,
};

// --- Tests ---

describe('Init command', () => {
	beforeEach(() => {
		mockWriteConfig.mockReset();
		mockAccess.mockReset();
		mockCreateSigner.mockReset();

		// Default happy path
		mockAccess.mockImplementation(async () => {});
		mockCreateSigner.mockImplementation(async () => ({}));
		mockWriteConfig.mockImplementation(async () => {});
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows "Initializing…" while async work is pending', () => {
			// Hang fs.access so the component never leaves the running state
			mockAccess.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Init options={defaultOptions} />);

			expect(lastFrame()).toContain('Initializing Umbra CLI...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Success path
	// -----------------------------------------------------------------------

	describe('success', () => {
		test('shows green success message after initialization', async () => {
			const {lastFrame} = render(<Init options={defaultOptions} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Umbra CLI initialized');
			});
		});

		test.each([
			['devnet', NETWORK_DEFAULTS.devnet],
			['mainnet', NETWORK_DEFAULTS.mainnet],
			['localnet', NETWORK_DEFAULTS.localnet],
		] as const)(
			'uses %s RPC defaults when rpcUrl is not provided',
			async (network, defaults) => {
				const {lastFrame} = render(
					<Init options={{...defaultOptions, network}} />,
				);

				await waitFor(() => {
					expect(lastFrame()).toContain('initialized');
				});

				expect(mockWriteConfig).toHaveBeenCalledWith(
					expect.objectContaining({
						network,
						rpcUrl: defaults.rpcUrl,
						rpcSubscriptionsUrl: defaults.rpcSubscriptionsUrl,
					}),
				);
			},
		);

		test('overrides rpcUrl when explicitly provided', async () => {
			const customRpcUrl = 'https://custom-rpc.example.com';
			const {lastFrame} = render(
				<Init options={{...defaultOptions, rpcUrl: customRpcUrl}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({rpcUrl: customRpcUrl}),
			);
		});

		test('overrides rpcSubscriptionsUrl when explicitly provided', async () => {
			const customWsUrl = 'wss://custom-rpc.example.com';
			const {lastFrame} = render(
				<Init
					options={{...defaultOptions, rpcSubscriptionsUrl: customWsUrl}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({rpcSubscriptionsUrl: customWsUrl}),
			);
		});

		test('writes the keypair path as walletPath in config', async () => {
			const keypair = '/custom/path/keypair.json';
			const {lastFrame} = render(
				<Init options={{...defaultOptions, keypair}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({walletPath: keypair}),
			);
		});

		test('passes custom indexerEndpoint to config as indexerApiEndpoint', async () => {
			const customIndexer = 'https://my-indexer.example.com';
			const {lastFrame} = render(
				<Init options={{...defaultOptions, indexerEndpoint: customIndexer}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({indexerApiEndpoint: customIndexer}),
			);
		});

		test('sets deferMasterSeedSignature: false by default', async () => {
			const {lastFrame} = render(<Init options={defaultOptions} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({deferMasterSeedSignature: false}),
			);
		});

		test('sets deferMasterSeedSignature: true when --defer-master-seed is passed', async () => {
			const {lastFrame} = render(
				<Init options={{...defaultOptions, deferMasterSeed: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('initialized');
			});

			expect(mockWriteConfig).toHaveBeenCalledWith(
				expect.objectContaining({deferMasterSeedSignature: true}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Error path
	// -----------------------------------------------------------------------

	describe('errors', () => {
		test('shows error and skips writeConfig when keypair file does not exist', async () => {
			const keypair = '/nonexistent/id.json';
			mockAccess.mockImplementation(async () => {
				throw Object.assign(new Error('ENOENT: no such file or directory'), {
					code: 'ENOENT',
				});
			});

			const {lastFrame} = render(
				<Init options={{...defaultOptions, keypair}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Initialization failed');
				expect(lastFrame()).toContain(`Keypair file not found: ${keypair}`);
			});

			expect(mockWriteConfig).not.toHaveBeenCalled();
		});

		test('shows error and skips writeConfig when keypair has wrong format', async () => {
			const keypair = '/bad/keypair.json';
			const errorMessage = `Invalid keypair file at "${keypair}": expected Solana keypair (64-byte array)`;

			mockCreateSigner.mockImplementation(async () => {
				throw new Error(errorMessage);
			});

			const {lastFrame} = render(
				<Init options={{...defaultOptions, keypair}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Initialization failed');
				expect(lastFrame()).toContain(errorMessage);
			});

			expect(mockWriteConfig).not.toHaveBeenCalled();
		});
	});
});
