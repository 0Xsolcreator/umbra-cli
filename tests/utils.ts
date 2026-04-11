/**
 * Polls `fn` (an assertion callback) until it stops throwing or the
 * timeout elapses. Mirrors the behaviour of @testing-library/dom waitFor.
 */
export async function waitFor(fn: () => void, timeout = 1000): Promise<void> {
	const start = Date.now();
	let lastError: unknown;
	while (Date.now() - start < timeout) {
		try {
			fn();
			return;
		} catch (error: unknown) {
			lastError = error;
			// eslint-disable-next-line no-await-in-loop
			await Bun.sleep(10);
		}
	}

	throw lastError;
}
