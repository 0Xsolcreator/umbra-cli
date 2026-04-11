/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';
import type {QueryEncryptedBalanceResult} from '@umbra-privacy/sdk/interfaces';

// --- Module mocks ---

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

const mockQuery = mock(
	async (_mints: unknown): Promise<Map<string, QueryEncryptedBalanceResult>> =>
		new Map(),
);
const mockGetBalanceQuerier = mock((_args: unknown) => mockQuery);

mock.module('@solana/kit', () => ({
	address: (a: string) => a,
}));

mock.module('../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getEncryptedBalanceQuerierFunction: mockGetBalanceQuerier,
}));

import Balance from '../../source/commands/balance.js';
import {waitFor} from '../utils.js';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// --- Tests ---

describe('Balance command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockQuery.mockReset();
		mockGetBalanceQuerier.mockReset();

		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetBalanceQuerier.mockImplementation((_args: unknown) => mockQuery);
		mockQuery.mockImplementation(async () => new Map());
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows querying status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(<Balance args={[USDC]} />);

			expect(lastFrame()).toContain('Fetching encrypted balances...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Query args
	// -----------------------------------------------------------------------

	describe('query args', () => {
		test('passes all mint addresses to query function', async () => {
			const {lastFrame} = render(<Balance args={[USDC, USDT]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Encrypted balances');
			});

			expect(mockQuery).toHaveBeenCalledWith([USDC, USDT]);
		});
	});

	// -----------------------------------------------------------------------
	// Balance states
	// -----------------------------------------------------------------------

	describe('balance states', () => {
		test('shows balance for shared state', async () => {
			mockQuery.mockImplementation(
				async () =>
					new Map([
						[
							USDC,
							{
								state: 'shared',
								balance: 50_000_000n,
							} as unknown as QueryEncryptedBalanceResult,
						],
					]),
			);

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Encrypted balances');
				expect(lastFrame()).toContain('50000000');
			});
		});

		test('shows MXE mode message for mxe state', async () => {
			mockQuery.mockImplementation(
				async () =>
					new Map([[USDC, {state: 'mxe'} as QueryEncryptedBalanceResult]]),
			);

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('MXE mode');
			});
		});

		test('shows uninitialized message for uninitialized state', async () => {
			mockQuery.mockImplementation(
				async () =>
					new Map([
						[USDC, {state: 'uninitialized'} as QueryEncryptedBalanceResult],
					]),
			);

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('uninitialized');
			});
		});

		test('shows deposit prompt for non_existent state', async () => {
			mockQuery.mockImplementation(
				async () =>
					new Map([
						[USDC, {state: 'non_existent'} as QueryEncryptedBalanceResult],
					]),
			);

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('deposit first');
			});
		});

		test('shows a row per mint for multiple results', async () => {
			mockQuery.mockImplementation(
				async () =>
					new Map([
						[
							USDC,
							{
								state: 'shared',
								balance: 1_000_000n,
							} as unknown as QueryEncryptedBalanceResult,
						],
						[USDT, {state: 'non_existent'} as QueryEncryptedBalanceResult],
					]),
			);

			const {lastFrame} = render(<Balance args={[USDC, USDT]} />);

			await waitFor(() => {
				const frame = lastFrame()!;
				expect(frame).toContain('1000000');
				expect(frame).toContain('deposit first');
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

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Balance query failed');
				expect(lastFrame()).toContain(
					"Umbra client not initialized. Run 'umbra init' first.",
				);
			});
		});

		test('shows error when query throws', async () => {
			mockQuery.mockImplementation(async () => {
				throw new Error('RPC connection failed');
			});

			const {lastFrame} = render(<Balance args={[USDC]} />);

			await waitFor(() => {
				expect(lastFrame()).toContain('Balance query failed');
				expect(lastFrame()).toContain('RPC connection failed');
			});
		});
	});
});
