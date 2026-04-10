/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';

// --- Module mocks ---

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

const mockScan = mock(async (_tree: unknown, _start: unknown, _end?: unknown) => ({
	selfBurnable: [],
	received: [],
	publicSelfBurnable: [],
	publicReceived: [],
	nextScanStartIndex: 0n,
}));
const mockGetScannerFunction = mock((_args: unknown) => mockScan);

const mockIsFetchUtxosError = mock((_err: unknown) => false);

mock.module('../../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getClaimableUtxoScannerFunction: mockGetScannerFunction,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isFetchUtxosError: mockIsFetchUtxosError,
}));

import Scan from '../../../source/commands/utxo/scan.js';

// --- Helpers ---

async function waitFor(fn: () => void, timeout = 1000): Promise<void> {
	const start = Date.now();
	let lastError: unknown;
	while (Date.now() - start < timeout) {
		try {
			fn();
			return;
		} catch (error: unknown) {
			lastError = error;
			await Bun.sleep(10);
		}
	}

	throw lastError;
}

const DEFAULT_OPTS = {tree: 0n, start: 0n, end: undefined};

// --- Tests ---

describe('Scan UTXO command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockScan.mockReset();
		mockGetScannerFunction.mockReset();
		mockIsFetchUtxosError.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetScannerFunction.mockImplementation((_args: unknown) => mockScan);
		mockScan.mockImplementation(async () => ({
			selfBurnable: [],
			received: [],
			publicSelfBurnable: [],
			publicReceived: [],
			nextScanStartIndex: 0n,
		}));
		mockIsFetchUtxosError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows scanning status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Scan options={DEFAULT_OPTS} />);

			expect(lastFrame()).toContain('Scanning for UTXOs...');
			unmount();
		});

		test('shows tree index in spinner label after client loads', async () => {
			mockScan.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Scan options={{tree: 2n, start: 0n, end: undefined}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scanning tree 2');
			});
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Scanner args
	// -----------------------------------------------------------------------

	describe('scanner args', () => {
		test('passes tree and start indices to scan function', async () => {
			const {lastFrame} = render(
				<Scan options={{tree: 1n, start: 500n, end: undefined}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan complete');
			});

			expect(mockScan).toHaveBeenCalledWith(1n, 500n, undefined);
		});

		test('passes end index when provided', async () => {
			const {lastFrame} = render(
				<Scan options={{tree: 0n, start: 0n, end: 1000n}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan complete');
			});

			expect(mockScan).toHaveBeenCalledWith(0n, 0n, 1000n);
		});

		test('passes undefined for end when omitted', async () => {
			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan complete');
			});

			expect(mockScan).toHaveBeenCalledWith(0n, 0n, undefined);
		});
	});

	// -----------------------------------------------------------------------
	// Success — empty result
	// -----------------------------------------------------------------------

	describe('empty result', () => {
		test('shows no UTXOs message when all categories are empty', async () => {
			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan complete');
				expect(lastFrame()).toContain('No UTXOs found');
			});
		});

		test('shows next scan start index', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 42n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Next scan start: 42');
			});
		});
	});

	// -----------------------------------------------------------------------
	// Success — UTXOs found
	// -----------------------------------------------------------------------

	describe('UTXOs found', () => {
		test('shows self-claimable encrypted UTXOs with amount and index', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [
					{amount: 1_000_000n, insertionIndex: 7n},
					{amount: 500_000n, insertionIndex: 12n},
				],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 13n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Self-claimable (encrypted)');
				expect(lastFrame()).toContain('1000000');
				expect(lastFrame()).toContain('index 7');
				expect(lastFrame()).toContain('500000');
				expect(lastFrame()).toContain('index 12');
			});
		});

		test('shows self-claimable public UTXOs', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [],
				publicSelfBurnable: [{amount: 2_000_000n, insertionIndex: 3n}],
				publicReceived: [],
				nextScanStartIndex: 4n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Self-claimable (public)');
				expect(lastFrame()).toContain('2000000');
				expect(lastFrame()).toContain('index 3');
			});
		});

		test('shows received encrypted UTXOs', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [{amount: 3_000_000n, insertionIndex: 99n}],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 100n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Received (encrypted)');
				expect(lastFrame()).toContain('3000000');
				expect(lastFrame()).toContain('index 99');
			});
		});

		test('shows received public UTXOs', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [{amount: 4_000_000n, insertionIndex: 200n}],
				nextScanStartIndex: 201n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Received (public)');
				expect(lastFrame()).toContain('4000000');
				expect(lastFrame()).toContain('index 200');
			});
		});

		test('hides empty categories', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Self-claimable (encrypted)');
				expect(lastFrame()).not.toContain('Received (encrypted)');
				expect(lastFrame()).not.toContain('Self-claimable (public)');
				expect(lastFrame()).not.toContain('Received (public)');
			});
		});
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------

	describe('errors', () => {
		test('shows error when getClient fails', async () => {
			mockGetClient.mockImplementation(async () => {
				throw new Error(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows initialization error message', async () => {
			const err = Object.assign(
				new Error('indexerApiEndpoint is required'),
				{stage: 'initialization'},
			);
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('Indexer not configured');
				expect(lastFrame()).toContain('indexerApiEndpoint is required');
			});
		});

		test('shows validation error message', async () => {
			const err = Object.assign(new Error('treeIndex out of range'), {
				stage: 'validation',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('Invalid scan parameters');
				expect(lastFrame()).toContain('treeIndex out of range');
			});
		});

		test('shows key-derivation error message', async () => {
			const err = Object.assign(new Error('Master seed unavailable'), {
				stage: 'key-derivation',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('Key derivation failed');
				expect(lastFrame()).toContain('Master seed unavailable');
			});
		});

		test('shows indexer-fetch error message', async () => {
			const err = Object.assign(new Error('ECONNREFUSED'), {
				stage: 'indexer-fetch',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('Indexer unreachable');
				expect(lastFrame()).toContain('ECONNREFUSED');
			});
		});

		test('shows proof-fetch error message', async () => {
			const err = Object.assign(new Error('Proof server timeout'), {
				stage: 'proof-fetch',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('Merkle proof fetch failed');
				expect(lastFrame()).toContain('Proof server timeout');
			});
		});

		test('shows stage name for unknown error stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'unknown-stage',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Scan options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Scan failed');
				expect(lastFrame()).toContain('unknown-stage');
			});
		});
	});
});
