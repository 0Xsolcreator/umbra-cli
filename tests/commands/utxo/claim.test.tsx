/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';

// --- Module mocks ---

type UtxoData = {amount: bigint; insertionIndex: bigint};
type ScanResult = {
	selfBurnable: UtxoData[];
	received: UtxoData[];
	publicSelfBurnable: UtxoData[];
	publicReceived: UtxoData[];
	nextScanStartIndex: bigint;
};
type ClaimResult = {
	batches: Map<bigint, {status: string; txSignature?: string}>;
};
type MockClient = {
	signer: {address: string};
	fetchBatchMerkleProof?: ReturnType<typeof mock>;
};

const mockGetClient = mock(
	async (): Promise<MockClient> => ({
		signer: {address: 'TestWalletAddress'},
		fetchBatchMerkleProof: mock(() => {}),
	}),
);

const mockScan = mock(
	async (
		_tree: unknown,
		_start: unknown,
		_end?: unknown,
	): Promise<ScanResult> => ({
		selfBurnable: [],
		received: [],
		publicSelfBurnable: [],
		publicReceived: [],
		nextScanStartIndex: 0n,
	}),
);
const mockCreateUtxoScanner = mock((_client: unknown) => mockScan);

const mockSelfEncryptedClaimer = mock(
	async (_utxos: unknown): Promise<ClaimResult> => ({
		batches: new Map(),
	}),
);
const mockSelfPublicClaimer = mock(
	async (_utxos: unknown): Promise<ClaimResult> => ({
		batches: new Map(),
	}),
);
const mockReceiverEncryptedClaimer = mock(
	async (_utxos: unknown): Promise<ClaimResult> => ({
		batches: new Map(),
	}),
);

const mockGetSelfEncryptedClaimerFunction = mock(
	(_ctx: unknown, _deps: unknown) => mockSelfEncryptedClaimer,
);
const mockGetSelfPublicClaimerFunction = mock(
	(_ctx: unknown, _deps: unknown) => mockSelfPublicClaimer,
);
const mockGetReceiverEncryptedClaimerFunction = mock(
	(_ctx: unknown, _deps: unknown) => mockReceiverEncryptedClaimer,
);
const mockGetUmbraRelayer = mock((_opts: unknown) => ({relayer: 'mock'}));

const mockGetClaimReceiverProver = mock(() => ({prover: 'receiver'}));
const mockGetClaimPublicProver = mock(() => ({prover: 'public'}));

const mockIsFetchUtxosError = mock((_err: unknown) => false);
const mockIsClaimUtxoError = mock((_err: unknown) => false);

mock.module('../../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('../../../source/lib/umbra/scanner.js', () => ({
	createUtxoScanner: mockCreateUtxoScanner,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getSelfClaimableUtxoToEncryptedBalanceClaimerFunction:
		mockGetSelfEncryptedClaimerFunction,
	getSelfClaimableUtxoToPublicBalanceClaimerFunction:
		mockGetSelfPublicClaimerFunction,
	getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction:
		mockGetReceiverEncryptedClaimerFunction,
	getUmbraRelayer: mockGetUmbraRelayer,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isFetchUtxosError: mockIsFetchUtxosError,
	isClaimUtxoError: mockIsClaimUtxoError,
}));

mock.module('@umbra-privacy/web-zk-prover', () => ({
	getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver:
		mockGetClaimReceiverProver,
	getClaimSelfClaimableUtxoIntoPublicBalanceProver: mockGetClaimPublicProver,
}));

import Claim from '../../../source/commands/utxo/claim.js';
import {waitFor} from '../../utils.js';

const DEFAULT_OPTS = {
	tree: 0n,
	start: 0n,
	end: undefined,
	to: 'encrypted' as const,
	relayer: 'https://relayer.test',
};

// --- Tests ---

describe('Claim UTXO command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockScan.mockReset();
		mockCreateUtxoScanner.mockReset();
		mockSelfEncryptedClaimer.mockReset();
		mockSelfPublicClaimer.mockReset();
		mockReceiverEncryptedClaimer.mockReset();
		mockGetSelfEncryptedClaimerFunction.mockReset();
		mockGetSelfPublicClaimerFunction.mockReset();
		mockGetReceiverEncryptedClaimerFunction.mockReset();
		mockGetUmbraRelayer.mockReset();
		mockGetClaimReceiverProver.mockReset();
		mockGetClaimPublicProver.mockReset();
		mockIsFetchUtxosError.mockReset();
		mockIsClaimUtxoError.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
			fetchBatchMerkleProof: mock(() => {}),
		}));
		mockCreateUtxoScanner.mockImplementation((_client: unknown) => mockScan);
		mockScan.mockImplementation(
			async (): Promise<ScanResult> => ({
				selfBurnable: [],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 0n,
			}),
		);
		mockSelfEncryptedClaimer.mockImplementation(
			async (): Promise<ClaimResult> => ({
				batches: new Map(),
			}),
		);
		mockSelfPublicClaimer.mockImplementation(
			async (): Promise<ClaimResult> => ({
				batches: new Map(),
			}),
		);
		mockReceiverEncryptedClaimer.mockImplementation(
			async (): Promise<ClaimResult> => ({
				batches: new Map(),
			}),
		);
		mockGetSelfEncryptedClaimerFunction.mockImplementation(
			(_ctx: unknown, _deps: unknown) => mockSelfEncryptedClaimer,
		);
		mockGetSelfPublicClaimerFunction.mockImplementation(
			(_ctx: unknown, _deps: unknown) => mockSelfPublicClaimer,
		);
		mockGetReceiverEncryptedClaimerFunction.mockImplementation(
			(_ctx: unknown, _deps: unknown) => mockReceiverEncryptedClaimer,
		);
		mockGetUmbraRelayer.mockImplementation((_opts: unknown) => ({
			relayer: 'mock',
		}));
		mockGetClaimReceiverProver.mockImplementation(() => ({prover: 'receiver'}));
		mockGetClaimPublicProver.mockImplementation(() => ({prover: 'public'}));
		mockIsFetchUtxosError.mockImplementation(() => false);
		mockIsClaimUtxoError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows scanning status while client is loading', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Claim options={DEFAULT_OPTS} />);

			expect(lastFrame()).toContain('Scanning for claimable UTXOs');
			unmount();
		});

		test('shows claiming status after UTXOs are found', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockSelfEncryptedClaimer.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Found 1 UTXO');
			});
			unmount();
		});

		test('pluralises UTXO count in claiming label', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [
					{amount: 1_000_000n, insertionIndex: 1n},
					{amount: 2_000_000n, insertionIndex: 2n},
				],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 3n,
			}));
			mockSelfEncryptedClaimer.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Found 2 UTXOs');
			});
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Nothing found
	// -----------------------------------------------------------------------

	describe('nothing found', () => {
		test('shows no claimable UTXOs message when scan is empty', async () => {
			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('No claimable UTXOs found');
			});
		});

		test('does not call any claimer when nothing found', async () => {
			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('No claimable UTXOs');
			});

			expect(mockSelfEncryptedClaimer).not.toHaveBeenCalled();
			expect(mockSelfPublicClaimer).not.toHaveBeenCalled();
			expect(mockReceiverEncryptedClaimer).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Claimer selection
	// -----------------------------------------------------------------------

	describe('claimer selection', () => {
		test('uses self-encrypted claimer for selfBurnable when to=encrypted', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 1 UTXO');
			});

			expect(mockGetSelfEncryptedClaimerFunction).toHaveBeenCalled();
			expect(mockGetSelfPublicClaimerFunction).not.toHaveBeenCalled();
		});

		test('uses self-public claimer for selfBurnable when to=public', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));

			const {lastFrame} = render(
				<Claim options={{...DEFAULT_OPTS, to: 'public'}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 1 UTXO');
			});

			expect(mockGetSelfPublicClaimerFunction).toHaveBeenCalled();
			expect(mockGetSelfEncryptedClaimerFunction).not.toHaveBeenCalled();
		});

		test('combines selfBurnable and publicSelfBurnable for self claim', async () => {
			const utxo1 = {amount: 1_000_000n, insertionIndex: 1n};
			const utxo2 = {amount: 2_000_000n, insertionIndex: 2n};
			mockScan.mockImplementation(async () => ({
				selfBurnable: [utxo1],
				received: [],
				publicSelfBurnable: [utxo2],
				publicReceived: [],
				nextScanStartIndex: 3n,
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 2 UTXOs');
			});

			expect(mockSelfEncryptedClaimer).toHaveBeenCalledWith([utxo1, utxo2]);
		});

		test('always uses receiver-encrypted claimer for received UTXOs', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [{amount: 3_000_000n, insertionIndex: 5n}],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 6n,
			}));

			const {lastFrame} = render(
				<Claim options={{...DEFAULT_OPTS, to: 'public'}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 1 UTXO');
			});

			expect(mockGetReceiverEncryptedClaimerFunction).toHaveBeenCalled();
			expect(mockGetSelfPublicClaimerFunction).not.toHaveBeenCalled();
		});

		test('combines received and publicReceived for receiver claim', async () => {
			const utxo1 = {amount: 3_000_000n, insertionIndex: 5n};
			const utxo2 = {amount: 4_000_000n, insertionIndex: 6n};
			mockScan.mockImplementation(async () => ({
				selfBurnable: [],
				received: [utxo1],
				publicSelfBurnable: [],
				publicReceived: [utxo2],
				nextScanStartIndex: 7n,
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 2 UTXOs');
			});

			expect(mockReceiverEncryptedClaimer).toHaveBeenCalledWith([utxo1, utxo2]);
		});

		test('claims both self and received UTXOs when both present', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [{amount: 3_000_000n, insertionIndex: 5n}],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 6n,
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 2 UTXOs');
			});

			expect(mockGetSelfEncryptedClaimerFunction).toHaveBeenCalled();
			expect(mockGetReceiverEncryptedClaimerFunction).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Success output
	// -----------------------------------------------------------------------

	describe('success', () => {
		test('shows claimed count singular', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockSelfEncryptedClaimer.mockImplementation(async () => ({
				batches: new Map([[0n, {status: 'confirmed', txSignature: 'sig123'}]]),
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 1 UTXO');
				expect(lastFrame()).not.toContain('Claimed 1 UTXOs');
			});
		});

		test('shows claimed count plural', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [
					{amount: 1_000_000n, insertionIndex: 1n},
					{amount: 2_000_000n, insertionIndex: 2n},
				],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 3n,
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claimed 2 UTXOs');
			});
		});

		test('shows batch index and status', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockSelfEncryptedClaimer.mockImplementation(async () => ({
				batches: new Map([[3n, {status: 'confirmed', txSignature: undefined}]]),
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Batch 3');
				expect(lastFrame()).toContain('confirmed');
			});
		});

		test('shows tx signature when present', async () => {
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockSelfEncryptedClaimer.mockImplementation(async () => ({
				batches: new Map([
					[0n, {status: 'confirmed', txSignature: 'abc123sig'}],
				]),
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('abc123sig');
			});
		});
	});

	// -----------------------------------------------------------------------
	// fetchBatchMerkleProof guard
	// -----------------------------------------------------------------------

	describe('indexer guard', () => {
		test('errors when fetchBatchMerkleProof is not configured', async () => {
			mockGetClient.mockImplementation(async () => ({
				signer: {address: 'TestWalletAddress'},
				// fetchBatchMerkleProof intentionally omitted
			}));

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Indexer not configured');
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

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows initialization error for FetchUtxosError', async () => {
			const err = Object.assign(new Error('indexerApiEndpoint is required'), {
				stage: 'initialization',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Indexer not configured');
				expect(lastFrame()).toContain('indexerApiEndpoint is required');
			});
		});

		test('shows indexer-fetch error for FetchUtxosError', async () => {
			const err = Object.assign(new Error('ECONNREFUSED'), {
				stage: 'indexer-fetch',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Indexer unreachable');
				expect(lastFrame()).toContain('ECONNREFUSED');
			});
		});

		test('shows stage name for unknown FetchUtxosError stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'unknown-stage',
			});
			mockIsFetchUtxosError.mockImplementation(() => true);
			mockScan.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('unknown-stage');
			});
		});

		test('shows zk-proof-generation error for ClaimUtxoError', async () => {
			const err = Object.assign(new Error('WASM load failed'), {
				stage: 'zk-proof-generation',
			});
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockIsClaimUtxoError.mockImplementation(() => true);
			mockSelfEncryptedClaimer.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('ZK proof generation failed');
				expect(lastFrame()).toContain('WASM load failed');
			});
		});

		test('shows signing cancelled message for transaction-sign error', async () => {
			const err = Object.assign(new Error('User rejected'), {
				stage: 'transaction-sign',
			});
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockIsClaimUtxoError.mockImplementation(() => true);
			mockSelfEncryptedClaimer.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Transaction signing cancelled');
			});
		});

		test('shows validate error for transaction-validate error', async () => {
			const err = Object.assign(new Error('Simulation failed'), {
				stage: 'transaction-validate',
			});
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockIsClaimUtxoError.mockImplementation(() => true);
			mockSelfEncryptedClaimer.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Pre-flight simulation failed');
				expect(lastFrame()).toContain('Simulation failed');
			});
		});

		test('shows send error for transaction-send error', async () => {
			const err = Object.assign(new Error('Network error'), {
				stage: 'transaction-send',
			});
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockIsClaimUtxoError.mockImplementation(() => true);
			mockSelfEncryptedClaimer.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('Network error');
				expect(lastFrame()).toContain('nullifier may already be burned');
			});
		});

		test('shows stage name for unknown ClaimUtxoError stages', async () => {
			const err = Object.assign(new Error('Something broke'), {
				stage: 'unknown-stage',
			});
			mockScan.mockImplementation(async () => ({
				selfBurnable: [{amount: 1_000_000n, insertionIndex: 1n}],
				received: [],
				publicSelfBurnable: [],
				publicReceived: [],
				nextScanStartIndex: 2n,
			}));
			mockIsClaimUtxoError.mockImplementation(() => true);
			mockSelfEncryptedClaimer.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(<Claim options={DEFAULT_OPTS} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Claim failed');
				expect(lastFrame()).toContain('unknown-stage');
			});
		});
	});
});
