/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';
import type {WithdrawResult} from '@umbra-privacy/sdk';

// --- Module mocks ---

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

const mockWithdraw = mock(
	async (_destination: unknown, _mint: unknown, _amount: unknown) =>
		({
			queueSignature: 'queueSig123',
			callbackStatus: 'finalized',
			callbackSignature: 'callbackSig456',
			callbackElapsedMs: 1200,
		} as unknown as WithdrawResult),
);
const mockGetWithdrawerFunction = mock((_args: unknown) => mockWithdraw);

const mockIsEncryptedWithdrawalError = mock((_err: unknown) => false);

mock.module('@solana/kit', () => ({
	address: (a: string) => a,
}));

mock.module('../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction:
		mockGetWithdrawerFunction,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isEncryptedWithdrawalError: mockIsEncryptedWithdrawalError,
}));

import Withdraw from '../../source/commands/withdraw.js';
import {waitFor} from '../utils.js';

const DEFAULT_ARGS = ['MintAddress111', 1_000_000n] as [string, bigint];
const DEFAULT_OPTS = {destination: undefined};

// --- Tests ---

describe('Withdraw command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockWithdraw.mockReset();
		mockGetWithdrawerFunction.mockReset();
		mockIsEncryptedWithdrawalError.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetWithdrawerFunction.mockImplementation(
			(_args: unknown) => mockWithdraw,
		);
		mockWithdraw.mockImplementation(
			async () =>
				({
					queueSignature: 'queueSig123',
					callbackStatus: 'finalized',
					callbackSignature: 'callbackSig456',
					callbackElapsedMs: 1200,
				} as unknown as WithdrawResult),
		);
		mockIsEncryptedWithdrawalError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows withdrawing status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			expect(lastFrame()).toContain('Preparing withdrawal...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Destination address
	// -----------------------------------------------------------------------

	describe('destination address', () => {
		test('defaults destination to own wallet address when not specified', async () => {
			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal complete');
			});

			expect(mockWithdraw).toHaveBeenCalledWith(
				'TestWalletAddress',
				DEFAULT_ARGS[0],
				DEFAULT_ARGS[1],
			);
		});

		test('shows destination address in spinner label', async () => {
			mockWithdraw.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Withdraw
					args={DEFAULT_ARGS}
					options={{destination: 'DestinationAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawing to DestinationAddress999');
			});
			unmount();
		});

		test('uses provided destination address when specified', async () => {
			const {lastFrame} = render(
				<Withdraw
					args={DEFAULT_ARGS}
					options={{destination: 'DestinationAddress999'}}
				/>,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal complete');
			});

			expect(mockWithdraw).toHaveBeenCalledWith(
				'DestinationAddress999',
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
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal complete');
				expect(lastFrame()).toContain('queueSig123');
				expect(lastFrame()).toContain('callbackSig456');
			});
		});

		test('shows only queue signature when callback is absent', async () => {
			mockWithdraw.mockImplementation(
				async () =>
					({queueSignature: 'queueSigOnly'} as unknown as WithdrawResult),
			);

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal complete');
				expect(lastFrame()).toContain('queueSigOnly');
				expect(lastFrame()).not.toContain('Callback:');
			});
		});

		test('passes mint and amount from positional args to withdraw function', async () => {
			const {lastFrame} = render(
				<Withdraw args={['SomeMint222', 5_000_000n]} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal complete');
			});

			expect(mockWithdraw).toHaveBeenCalledWith(
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
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows validation error message', async () => {
			const err = Object.assign(new Error('Amount must be greater than zero'), {
				stage: 'validation',
			});
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain('Invalid arguments');
				expect(lastFrame()).toContain('Amount must be greater than zero');
			});
		});

		test('shows mint-fetch error message', async () => {
			const err = Object.assign(new Error('Account not found'), {
				stage: 'mint-fetch',
			});
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain('Could not fetch mint account');
				expect(lastFrame()).toContain('Account not found');
			});
		});

		test('shows instruction-build error message', async () => {
			const err = Object.assign(new Error('Pool state mismatch'), {
				stage: 'instruction-build',
			});
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain('Could not construct instruction');
				expect(lastFrame()).toContain('Pool state mismatch');
			});
		});

		test('shows transaction-sign error message', async () => {
			const err = Object.assign(new Error('Rejected'), {
				stage: 'transaction-sign',
			});
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain('Transaction signing cancelled');
			});
		});

		test('shows transaction-send error with retry warning', async () => {
			const err = Object.assign(
				new Error('Transaction confirmation timed out after 30000ms'),
				{stage: 'transaction-send'},
			);
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain(
					'Transaction confirmation timed out after 30000ms',
				);
				expect(lastFrame()).toContain('check on-chain state before retrying');
			});
		});

		test('shows stage name for unknown withdrawal error stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'pda-derivation',
			});
			mockIsEncryptedWithdrawalError.mockImplementation(() => true);
			mockWithdraw.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Withdraw args={DEFAULT_ARGS} options={DEFAULT_OPTS} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Withdrawal failed');
				expect(lastFrame()).toContain('pda-derivation');
			});
		});
	});
});
