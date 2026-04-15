import {Args, Flags} from '@oclif/core';

/**
 * BigInt flag factory. Parses any string accepted by the BigInt() constructor.
 * Used for tree indices, page sizes, and other large integer parameters.
 *
 * Usage: `myFlag: bigintFlag({ description: '...', required: false })`
 */
export const bigintFlag = Flags.custom<bigint>({
	async parse(input) {
		try {
			return BigInt(input);
		} catch {
			throw new Error(`Expected a valid integer but received: ${input}`);
		}
	},
});

/**
 * BigInt positional arg factory. Same parse logic as bigintFlag.
 *
 * Usage: `amount: bigintArg({ description: '...', required: true })`
 */
export const bigintArg = Args.custom<bigint>({
	async parse(input) {
		try {
			return BigInt(input);
		} catch {
			throw new Error(`Expected a valid integer but received: ${input}`);
		}
	},
});
