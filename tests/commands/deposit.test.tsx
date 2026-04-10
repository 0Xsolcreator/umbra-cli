/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';
// --- Module mocks ---

type MockDepositResult = {
	queueSignature: string;
	callbackStatus?: string;
	callbackSignature?: string;
	callbackElapsedMs?: number;
};

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

const mockDeposit = mock(
	async (
		_destination: unknown,
		_mint: unknown,
		_amount: unknown,
	): Promise<MockDepositResult> => ({
		queueSignature: 'queueSig123',
		callbackStatus: 'finalized',
		callbackSignature: 'callbackSig456',
		callbackElapsedMs: 1200,
	}),
);
const mockGetDepositorFunction = mock((_args: unknown) => mockDeposit);

const mockIsEncryptedDepositError = mock((_err: unknown) => false);

mock.module('@solana/kit', () => ({
	address: (a: string) => a,
}));

mock.module('../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getPublicBalanceToEncryptedBalanceDirectDepositorFunction:
		mockGetDepositorFunction,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isEncryptedDepositError: mockIsEncryptedDepositError,
}));

import Deposit from '../../source/commands/deposit.js';
import {waitFor} from '../utils.js';

const DEFAULT_ARGS = ['MintAddress111', 1_000_000n] as [string, bigint];
const DEFAULT_OPTS = {recipient: undefined};

// --- Tests ---

describe('Deposit command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockDeposit.mockReset();
		mockGetDepositorFunction.mockReset();
		mockIsEncryptedDepositError.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetDepositorFunction.mockImplementation(
			(_args: unknown) => mockDeposit,
		);
		mockDeposit.mockImplementation(async () => ({
			queueSignature: 'queueSig123',
			callbackStatus: 'finalized',
			callbackSignature: 'callbackSig456',
			callbackElapsedMs: 1200,
		}));
		mockIsEncryptedDepositError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows depositing status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			expect(lastFrame()).toContain('Preparing deposit...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Recipient address
	// -----------------------------------------------------------------------

	describe('recipient address', () => {
		test('defaults recipient to own wallet address when not specified', async () => {
			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit complete');
			});

			expect(mockDeposit).toHaveBeenCalledWith(
				'TestWalletAddress',
				DEFAULT_ARGS[0],
				DEFAULT_ARGS[1],
			);
		});

		test('uses provided recipient address when specified', async () => {
			const {lastFrame} = render(
				<Deposit
					args={DEFAULT_ARGS}
					options={{recipient: 'RecipientAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit complete');
			});

			expect(mockDeposit).toHaveBeenCalledWith(
				'RecipientAddress999',
				DEFAULT_ARGS[0],
				DEFAULT_ARGS[1],
			);
		});
	});

	// -----------------------------------------------------------------------
	// Success
	// -----------------------------------------------------------------------

	describe('success', () => {
		test('shows queue and callback signatures on success', async () => {
			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit complete');
				expect(lastFrame()).toContain('queueSig123');
				expect(lastFrame()).toContain('callbackSig456');
			});
		});

		test('shows only queue signature when callback is absent', async () => {
			mockDeposit.mockImplementation(async () => ({
				queueSignature: 'queueSigOnly',
			}));

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit complete');
				expect(lastFrame()).toContain('queueSigOnly');
				expect(lastFrame()).not.toContain('Callback:');
			});
		});

		test('passes mint and amount from positional args to deposit function', async () => {
			const {lastFrame} = render(
				<Deposit args={['SomeMint222', 5_000_000n]} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit complete');
			});

			expect(mockDeposit).toHaveBeenCalledWith(
				'TestWalletAddress',
				'SomeMint222',
				5_000_000n,
			);
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
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows validation error message', async () => {
			const err = Object.assign(new Error('Amount must be greater than zero'), {
				stage: 'validation',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('Invalid arguments');
				expect(lastFrame()).toContain('Amount must be greater than zero');
			});
		});

		test('shows mint-fetch error message', async () => {
			const err = Object.assign(new Error('Account not found'), {
				stage: 'mint-fetch',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('Could not fetch mint account');
				expect(lastFrame()).toContain('Account not found');
			});
		});

		test('shows account-fetch error message', async () => {
			const err = Object.assign(new Error('Destination not registered'), {
				stage: 'account-fetch',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('Could not fetch destination account');
				expect(lastFrame()).toContain('Destination not registered');
			});
		});

		test('shows transaction-sign error message', async () => {
			const err = Object.assign(new Error('Rejected'), {
				stage: 'transaction-sign',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('Transaction signing cancelled');
			});
		});

		test('shows transaction-validate error message', async () => {
			const err = Object.assign(new Error('Insufficient funds'), {
				stage: 'transaction-validate',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('Pre-flight simulation failed');
				expect(lastFrame()).toContain('Insufficient funds');
			});
		});

		test('shows transaction-send error with retry warning', async () => {
			const err = Object.assign(
				new Error('Transaction confirmation timed out after 30000ms'),
				{stage: 'transaction-send'},
			);
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain(
					'Transaction confirmation timed out after 30000ms',
				);
				expect(lastFrame()).toContain('check on-chain state before retrying');
			});
		});

		test('shows stage name for unknown deposit error stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'pda-derivation',
			});
			mockIsEncryptedDepositError.mockImplementation(() => true);
			mockDeposit.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Deposit args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Deposit failed');
				expect(lastFrame()).toContain('pda-derivation');
			});
		});
	});
});
