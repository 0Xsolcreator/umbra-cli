/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';

// --- Module mocks ---

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

// Public-balance creator functions
const mockPublicSelfCreate = mock(async (_args: unknown) => ({
	createProofAccountSignature: 'proofAccSig',
	createUtxoSignature: 'createUtxoSig',
}));
const mockGetPublicSelfCreatorFunction = mock(
	(_args: unknown, _deps: unknown) => mockPublicSelfCreate,
);

const mockPublicReceiverCreate = mock(async (_args: unknown) => ({
	createProofAccountSignature: 'proofAccSig',
	createUtxoSignature: 'createUtxoSig',
}));
const mockGetPublicReceiverCreatorFunction = mock(
	(_args: unknown, _deps: unknown) => mockPublicReceiverCreate,
);

// Encrypted-balance creator functions
const mockEncryptedSelfCreate = mock(async (_args: unknown) => ({
	createProofAccountSignature: 'proofAccSig',
	queueSignature: 'queueSig123',
	callbackSignature: 'callbackSig456',
}));
const mockGetEncryptedSelfCreatorFunction = mock(
	(_args: unknown, _deps: unknown) => mockEncryptedSelfCreate,
);

const mockEncryptedReceiverCreate = mock(async (_args: unknown) => ({
	createProofAccountSignature: 'proofAccSig',
	queueSignature: 'queueSig123',
	callbackSignature: 'callbackSig456',
}));
const mockGetEncryptedReceiverCreatorFunction = mock(
	(_args: unknown, _deps: unknown) => mockEncryptedReceiverCreate,
);

const mockIsCreateUtxoError = mock((_err: unknown) => false);

mock.module('@solana/kit', () => ({
	address: (a: string) => a,
}));

mock.module('../../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getPublicBalanceToSelfClaimableUtxoCreatorFunction:
		mockGetPublicSelfCreatorFunction,
	getPublicBalanceToReceiverClaimableUtxoCreatorFunction:
		mockGetPublicReceiverCreatorFunction,
	getEncryptedBalanceToSelfClaimableUtxoCreatorFunction:
		mockGetEncryptedSelfCreatorFunction,
	getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction:
		mockGetEncryptedReceiverCreatorFunction,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isCreateUtxoError: mockIsCreateUtxoError,
}));

mock.module('@umbra-privacy/web-zk-prover', () => ({
	getCreateSelfClaimableUtxoFromPublicBalanceProver: mock(() => ({})),
	getCreateReceiverClaimableUtxoFromPublicBalanceProver: mock(() => ({})),
	getCreateSelfClaimableUtxoFromEncryptedBalanceProver: mock(() => ({})),
	getCreateReceiverClaimableUtxoFromEncryptedBalanceProver: mock(() => ({})),
}));

import Create from '../../../source/commands/utxo/create.js';

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

const DEFAULT_ARGS = ['MintAddress111', 1_000_000n] as [string, bigint];
const DEFAULT_OPTS = {from: 'public' as const, receiver: undefined};

// --- Tests ---

describe('Create UTXO command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockPublicSelfCreate.mockReset();
		mockGetPublicSelfCreatorFunction.mockReset();
		mockPublicReceiverCreate.mockReset();
		mockGetPublicReceiverCreatorFunction.mockReset();
		mockEncryptedSelfCreate.mockReset();
		mockGetEncryptedSelfCreatorFunction.mockReset();
		mockEncryptedReceiverCreate.mockReset();
		mockGetEncryptedReceiverCreatorFunction.mockReset();
		mockIsCreateUtxoError.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetPublicSelfCreatorFunction.mockImplementation(
			(_args: unknown, _deps: unknown) => mockPublicSelfCreate,
		);
		mockPublicSelfCreate.mockImplementation(async () => ({
			createProofAccountSignature: 'proofAccSig',
			createUtxoSignature: 'createUtxoSig',
		}));
		mockGetPublicReceiverCreatorFunction.mockImplementation(
			(_args: unknown, _deps: unknown) => mockPublicReceiverCreate,
		);
		mockPublicReceiverCreate.mockImplementation(async () => ({
			createProofAccountSignature: 'proofAccSig',
			createUtxoSignature: 'createUtxoSig',
		}));
		mockGetEncryptedSelfCreatorFunction.mockImplementation(
			(_args: unknown, _deps: unknown) => mockEncryptedSelfCreate,
		);
		mockEncryptedSelfCreate.mockImplementation(async () => ({
			createProofAccountSignature: 'proofAccSig',
			queueSignature: 'queueSig123',
			callbackSignature: 'callbackSig456',
		}));
		mockGetEncryptedReceiverCreatorFunction.mockImplementation(
			(_args: unknown, _deps: unknown) => mockEncryptedReceiverCreate,
		);
		mockEncryptedReceiverCreate.mockImplementation(async () => ({
			createProofAccountSignature: 'proofAccSig',
			queueSignature: 'queueSig123',
			callbackSignature: 'callbackSig456',
		}));
		mockIsCreateUtxoError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows preparing status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			expect(lastFrame()).toContain('Preparing UTXO...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Factory selection
	// -----------------------------------------------------------------------

	describe('factory selection', () => {
		test('uses public+self factory by default', async () => {
			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockGetPublicSelfCreatorFunction).toHaveBeenCalledTimes(1);
			expect(mockGetEncryptedSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetPublicReceiverCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetEncryptedReceiverCreatorFunction).not.toHaveBeenCalled();
		});

		test('uses encrypted+self factory when --from encrypted and no receiver', async () => {
			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'encrypted', receiver: undefined}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockGetEncryptedSelfCreatorFunction).toHaveBeenCalledTimes(1);
			expect(mockGetPublicSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetPublicReceiverCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetEncryptedReceiverCreatorFunction).not.toHaveBeenCalled();
		});

		test('uses public+receiver factory when --receiver is set and no --from', async () => {
			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'public', receiver: 'ReceiverAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockGetPublicReceiverCreatorFunction).toHaveBeenCalledTimes(1);
			expect(mockGetPublicSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetEncryptedSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetEncryptedReceiverCreatorFunction).not.toHaveBeenCalled();
		});

		test('uses encrypted+receiver factory when --from encrypted and --receiver set', async () => {
			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'encrypted', receiver: 'ReceiverAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockGetEncryptedReceiverCreatorFunction).toHaveBeenCalledTimes(1);
			expect(mockGetPublicSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetEncryptedSelfCreatorFunction).not.toHaveBeenCalled();
			expect(mockGetPublicReceiverCreatorFunction).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Destination address
	// -----------------------------------------------------------------------

	describe('destination address', () => {
		test('defaults destination to own wallet address when no receiver specified', async () => {
			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockPublicSelfCreate).toHaveBeenCalledWith(
				expect.objectContaining({destinationAddress: 'TestWalletAddress'}),
			);
		});

		test('uses provided receiver address when --receiver is set', async () => {
			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'public', receiver: 'ReceiverAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockPublicReceiverCreate).toHaveBeenCalledWith(
				expect.objectContaining({destinationAddress: 'ReceiverAddress999'}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Args passthrough
	// -----------------------------------------------------------------------

	describe('args passthrough', () => {
		test('passes mint and amount from positional args', async () => {
			const {lastFrame} = render(
				<Create args={['SomeMint222', 5_000_000n]} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
			});

			expect(mockPublicSelfCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					mint: 'SomeMint222',
					amount: 5_000_000n,
				}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Success output
	// -----------------------------------------------------------------------

	describe('success', () => {
		test('public balance: shows proof account and createUtxo signatures', async () => {
			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
				expect(lastFrame()).toContain('proofAccSig');
				expect(lastFrame()).toContain('createUtxoSig');
			});
		});

		test('public balance: does not show queue or callback labels', async () => {
			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
				expect(lastFrame()).not.toContain('Queue:');
				expect(lastFrame()).not.toContain('Callback:');
			});
		});

		test('encrypted balance: shows proof account, queue, and callback signatures', async () => {
			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'encrypted', receiver: undefined}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
				expect(lastFrame()).toContain('proofAccSig');
				expect(lastFrame()).toContain('queueSig123');
				expect(lastFrame()).toContain('callbackSig456');
			});
		});

		test('encrypted balance: omits callback label when callbackSignature is absent', async () => {
			mockEncryptedSelfCreate.mockImplementation(async () => ({
				createProofAccountSignature: 'proofAccSig',
				queueSignature: 'queueSigOnly',
			}));

			const {lastFrame} = render(
				<Create
					args={DEFAULT_ARGS}
					options={{from: 'encrypted', receiver: undefined}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO created');
				expect(lastFrame()).toContain('queueSigOnly');
				expect(lastFrame()).not.toContain('Callback:');
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

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows validation error message', async () => {
			const err = Object.assign(new Error('Amount must be greater than zero'), {
				stage: 'validation',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('Invalid arguments');
				expect(lastFrame()).toContain('Amount must be greater than zero');
			});
		});

		test('shows account-fetch error message', async () => {
			const err = Object.assign(new Error('Recipient not registered'), {
				stage: 'account-fetch',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('Could not fetch recipient account');
				expect(lastFrame()).toContain('Recipient not registered');
			});
		});

		test('shows mint-fetch error message', async () => {
			const err = Object.assign(new Error('Account not found'), {
				stage: 'mint-fetch',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('Could not fetch mint account');
				expect(lastFrame()).toContain('Account not found');
			});
		});

		test('shows zk-proof-generation error message', async () => {
			const err = Object.assign(new Error('Out of memory'), {
				stage: 'zk-proof-generation',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('ZK proof generation failed');
				expect(lastFrame()).toContain('Out of memory');
			});
		});

		test('shows transaction-sign error message', async () => {
			const err = Object.assign(new Error('Rejected'), {
				stage: 'transaction-sign',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('Transaction signing cancelled');
			});
		});

		test('shows transaction-validate error message', async () => {
			const err = Object.assign(new Error('Insufficient funds'), {
				stage: 'transaction-validate',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('Pre-flight simulation failed');
				expect(lastFrame()).toContain('Insufficient funds');
			});
		});

		test('shows transaction-send error with retry warning', async () => {
			const err = Object.assign(
				new Error('Transaction confirmation timed out after 30000ms'),
				{stage: 'transaction-send'},
			);
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain(
					'Transaction confirmation timed out after 30000ms',
				);
				expect(lastFrame()).toContain('check on-chain state before retrying');
			});
		});

		test('shows stage name for unknown error stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'pda-derivation',
			});
			mockIsCreateUtxoError.mockImplementation(() => true);
			mockPublicSelfCreate.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Create args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('UTXO creation failed');
				expect(lastFrame()).toContain('pda-derivation');
			});
		});
	});
});
