import {createInterface} from 'node:readline';

/**
 * Prompt the user for a secret value with character echo suppressed.
 *
 * Uses readline with an `_writeToOutput` override — a well-known Node
 * trick since `readline` doesn't expose a public masked-input API. The
 * caller is responsible for gating on `process.stdin.isTTY`; this
 * function will still run without a TTY but will block waiting for
 * piped input.
 */
export async function promptSecret(prompt: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		});

		// `_writeToOutput` is called with the prompt string first, then with
		// each character the user types as it's echoed back. Let the prompt
		// through, swallow everything else.
		const rlInternal = rl as unknown as {
			_writeToOutput: (s: string) => void;
		};
		const originalWrite = rlInternal._writeToOutput.bind(rl);
		let promptWritten = false;
		rlInternal._writeToOutput = (s: string) => {
			if (!promptWritten) {
				originalWrite(s);
				promptWritten = true;
			}
			// Suppress subsequent echoes (typed characters, backspace redraws).
		};

		rl.once('error', err => {
			rl.close();
			reject(err);
		});

		rl.question(prompt, answer => {
			// Newline after the (suppressed) Enter keypress so the next line
			// of output lands on its own row.
			process.stdout.write('\n');
			rl.close();
			resolve(answer);
		});
	});
}
