/// <reference types="bun-types" />

import {beforeEach, describe, expect, mock, test} from 'bun:test';
import React from 'react';
import {render} from 'ink-testing-library';
import type {QueryUserAccountResult} from '@umbra-privacy/sdk';

// --- Module mocks ---
// Bun registers these before resolving static imports in this file,
// so the component picks up the mocked versions when it loads.

const mockGetClient = mock(async () => ({
	signer: {address: 'TestWalletAddress'},
}));

const mockQueryUserAccount = mock(
	async (_address: unknown): Promise<QueryUserAccountResult> => ({
		state: 'non_existent',
	}),
);
const mockGetUserAccountQuerier = mock(
	(_args: unknown) => mockQueryUserAccount,
);

const mockRegisterUser = mock(async (_opts: unknown) => [] as string[]);
const mockGetUserRegistration = mock((_args: unknown) => mockRegisterUser);

const mockIsRegistrationError = mock((_err: unknown) => false);

mock.module('../../source/lib/umbra/client.js', () => ({
	getClient: mockGetClient,
}));

mock.module('@umbra-privacy/sdk', () => ({
	getUserAccountQuerierFunction: mockGetUserAccountQuerier,
	getUserRegistrationFunction: mockGetUserRegistration,
}));

mock.module('@umbra-privacy/sdk/errors', () => ({
	isRegistrationError: mockIsRegistrationError,
}));

import Register from '../../source/commands/register.js';
import {waitFor} from '../utils.js';

// --- Tests ---

describe('Register command', () => {
	beforeEach(() => {
		mockGetClient.mockReset();
		mockQueryUserAccount.mockReset();
		mockGetUserAccountQuerier.mockReset();
		mockRegisterUser.mockReset();
		mockGetUserRegistration.mockReset();
		mockIsRegistrationError.mockReset();

		// Default happy path: not registered, full registration succeeds
		mockGetClient.mockImplementation(async () => ({
			signer: {address: 'TestWalletAddress'},
		}));
		mockGetUserAccountQuerier.mockImplementation(
			(_args: unknown) => mockQueryUserAccount,
		);
		mockQueryUserAccount.mockImplementation(async () => ({
			state: 'non_existent',
		}));
		mockGetUserRegistration.mockImplementation(
			(_args: unknown) => mockRegisterUser,
		);
		mockRegisterUser.mockImplementation(async () => ['sig1', 'sig2', 'sig3']);
		mockIsRegistrationError.mockImplementation(() => false);
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	describe('initial render', () => {
		test('shows checking status while async work is pending', () => {
			mockGetClient.mockImplementation(() => new Promise(() => {}));

			const {lastFrame, unmount} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			expect(lastFrame()).toContain('Checking registration status...');
			unmount();
		});
	});

	// -----------------------------------------------------------------------
	// Already registered
	// -----------------------------------------------------------------------

	describe('already registered', () => {
		test('shows already registered when X25519 key and commitment are registered', async () => {
			mockQueryUserAccount.mockImplementation(
				async () =>
					({
						state: 'exists',
						data: {
							isUserAccountX25519KeyRegistered: true,
							isUserCommitmentRegistered: true,
							isActiveForAnonymousUsage: true,
						},
					} as unknown as QueryUserAccountResult),
			);

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('User already registered');
			});

			expect(mockGetUserRegistration).not.toHaveBeenCalled();
		});

		test('does not skip registration when X25519 key is missing', async () => {
			mockQueryUserAccount.mockImplementation(
				async () =>
					({
						state: 'exists',
						data: {
							isUserAccountX25519KeyRegistered: false,
							isUserCommitmentRegistered: true,
							isActiveForAnonymousUsage: false,
						},
					} as unknown as QueryUserAccountResult),
			);

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration complete');
			});

			expect(mockGetUserRegistration).toHaveBeenCalledTimes(1);
		});

		test('does not skip registration when commitment is missing', async () => {
			mockQueryUserAccount.mockImplementation(
				async () =>
					({
						state: 'exists',
						data: {
							isUserAccountX25519KeyRegistered: true,
							isUserCommitmentRegistered: false,
							isActiveForAnonymousUsage: false,
						},
					} as unknown as QueryUserAccountResult),
			);

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration complete');
			});

			expect(mockGetUserRegistration).toHaveBeenCalledTimes(1);
		});
	});

	// -----------------------------------------------------------------------
	// Registration success
	// -----------------------------------------------------------------------

	describe('success', () => {
		test('forwards confidential and anonymous options to register call', async () => {
			const {lastFrame} = render(
				<Register options={{confidential: false, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration complete');
			});

			expect(mockRegisterUser).toHaveBeenCalledWith(
				expect.objectContaining({confidential: false, anonymous: true}),
			);
		});

		test('defaults confidential and anonymous to true', async () => {
			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration complete');
			});

			expect(mockRegisterUser).toHaveBeenCalledWith(
				expect.objectContaining({confidential: true, anonymous: true}),
			);
		});

		test('shows transaction count on success', async () => {
			mockRegisterUser.mockImplementation(async () => ['sig1', 'sig2', 'sig3']);

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('3 transactions submitted');
			});
		});

		test('shows singular "transaction" when 1 transaction submitted', async () => {
			mockRegisterUser.mockImplementation(async () => ['sig1']);

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('1 transaction submitted');
			});
		});
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------

	describe('errors', () => {
		test('shows error when getClient fails', async () => {
			mockGetClient.mockImplementation(async () => {
				throw new Error('Umbra client not initialized. Run umbra init first.');
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain(
					'Umbra client not initialized. Run umbra init first.',
				);
			});
		});

		test('shows master-seed-derivation error message', async () => {
			const err = Object.assign(new Error('User cancelled'), {
				stage: 'master-seed-derivation',
			});
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain('Sign the master seed message');
			});
		});

		test('shows transaction-sign error message', async () => {
			const err = Object.assign(new Error('Rejected'), {
				stage: 'transaction-sign',
			});
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain('Transaction signing cancelled');
			});
		});

		test('shows zk-proof-generation error with message', async () => {
			const err = Object.assign(new Error('Circuit constraint failed'), {
				stage: 'zk-proof-generation',
			});
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain('ZK proof generation failed');
				expect(lastFrame()).toContain('Circuit constraint failed');
			});
		});

		test('shows account-fetch error for RPC failures during account check', async () => {
			const err = Object.assign(
				new Error('Connection refused: https://api.devnet.solana.com'),
				{stage: 'account-fetch'},
			);
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain('RPC error while checking account state');
				expect(lastFrame()).toContain('Connection refused');
			});
		});

		test('shows transaction-send error with SDK message', async () => {
			const err = Object.assign(
				new Error('Transaction confirmation timed out after 30000ms'),
				{stage: 'transaction-send'},
			);
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain(
					'Transaction confirmation timed out after 30000ms',
				);
				expect(lastFrame()).toContain('check on-chain state before retrying');
			});
		});

		test('shows stage name for unknown registration error stages', async () => {
			const err = Object.assign(new Error('Something went wrong'), {
				stage: 'instruction-build',
			});
			mockIsRegistrationError.mockImplementation(() => true);
			mockRegisterUser.mockImplementation(async () => {
				throw err;
			});

			const {lastFrame} = render(
				<Register options={{confidential: true, anonymous: true}} />,
			);

			await waitFor(() => {
				expect(lastFrame()).toContain('Registration failed');
				expect(lastFrame()).toContain('instruction-build');
			});
		});
	});
});
