import {
	getClaimableUtxoScannerFunction,
	getUmbraClient,
} from '@umbra-privacy/sdk';
import type {ScannedUtxoData} from '@umbra-privacy/sdk/interfaces';
import {type U32} from '@umbra-privacy/sdk/types';

type UmbraClient = Awaited<ReturnType<typeof getUmbraClient>>;

export function createUtxoScanner(client: UmbraClient) {
	return getClaimableUtxoScannerFunction({client});
}

export type ScanProgress = {
	/** 0-based index of the page just completed. */
	page: number;
	/** The start index for the next page (= nextScanStartIndex from the SDK). */
	nextStart: bigint;
};

export type ScanAllOptions = {
	/**
	 * Number of insertion indices to cover per SDK call.
	 * When omitted the entire range is fetched in a single call.
	 */
	pageSize?: bigint;
	/** Called after each page completes, useful for progress UI updates. */
	onProgress?: (progress: ScanProgress) => void;
};

export type ScanAllResult = {
	selfBurnable: ScannedUtxoData[];
	received: ScannedUtxoData[];
	publicSelfBurnable: ScannedUtxoData[];
	publicReceived: ScannedUtxoData[];
	/**
	 * Pass this as `startIndex` on the next scan to resume where this one left off.
	 * Mirrors the SDK's `ScannedUtxoResult.nextScanStartIndex`.
	 */
	nextScanStartIndex: bigint;
};

/**
 * Scan a single Merkle tree for claimable UTXOs, optionally in pages.
 *
 * When `pageSize` is set the scanner is called repeatedly with
 * non-overlapping ranges until the entire requested range is covered or the
 * tree returns no further results.  All partial results are merged before
 * returning.
 */
export async function scanAllUtxos(
	client: UmbraClient,
	treeIndex: bigint,
	startIndex: bigint,
	endIndex: bigint | undefined,
	options: ScanAllOptions = {},
): Promise<ScanAllResult> {
	const scan = getClaimableUtxoScannerFunction({client});
	const {pageSize, onProgress} = options;

	const selfBurnable: ScannedUtxoData[] = [];
	const received: ScannedUtxoData[] = [];
	const publicSelfBurnable: ScannedUtxoData[] = [];
	const publicReceived: ScannedUtxoData[] = [];

	let currentStart = startIndex;
	let page = 0;
	let nextScanStartIndex = startIndex;

	while (true) {
		let pageEnd: bigint | undefined;
		if (pageSize !== undefined) {
			const candidate = currentStart + pageSize - 1n;
			pageEnd =
				endIndex !== undefined && candidate > endIndex ? endIndex : candidate;
		} else {
			pageEnd = endIndex;
		}

		const result = await scan(
			treeIndex as U32,
			currentStart as U32,
			pageEnd !== undefined ? (pageEnd as U32) : undefined,
		);

		selfBurnable.push(...result.selfBurnable);
		received.push(...result.received);
		publicSelfBurnable.push(...result.publicSelfBurnable);
		publicReceived.push(...result.publicReceived);

		nextScanStartIndex = result.nextScanStartIndex as bigint;
		onProgress?.({page, nextStart: nextScanStartIndex});
		page++;

		if (nextScanStartIndex === currentStart) break;
		if (endIndex !== undefined && nextScanStartIndex > endIndex) break;
		if (pageSize === undefined) break;

		currentStart = nextScanStartIndex;
	}

	return {
		selfBurnable,
		received,
		publicSelfBurnable,
		publicReceived,
		nextScanStartIndex,
	};
}
