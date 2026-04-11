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

/** Single-tree paginated scan */

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
	 * Pass this as `startIndex` on the next scan to resume where this one
	 * left off. Mirrors the SDK's `ScannedUtxoResult.nextScanStartIndex`.
	 */
	nextScanStartIndex: bigint;
};

/**
 * Scan a single Merkle tree for claimable UTXOs, optionally in pages.
 *
 * When `pageSize` is set the scanner is called repeatedly with
 * non-overlapping ranges until the entire requested range is covered or the
 * tree returns no further results. All partial results are merged before
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

/** Multi-tree scan */

export type MultiTreeScanProgress = {
	/** The tree currently being scanned. */
	treeIndex: bigint;
	/** 0-based page within the current tree. */
	page: number;
	/** The start index for the next page within this tree. */
	nextStart: bigint;
};

export type MultiTreeScanOptions = {
	/**
	 * Number of insertion indices to cover per SDK call per tree.
	 * When omitted each tree is fetched in a single call.
	 */
	pageSize?: bigint;
	/** Called after each page of each tree completes. */
	onProgress?: (progress: MultiTreeScanProgress) => void;
};

export type MultiTreeScanResult = {
	selfBurnable: ScannedUtxoData[];
	received: ScannedUtxoData[];
	publicSelfBurnable: ScannedUtxoData[];
	publicReceived: ScannedUtxoData[];
	/**
	 * Tree index to pass as `startTree` on the next call to resume scanning.
	 * - Explicit range completed → last tree + 1.
	 * - Auto-detect stop (empty tree found) → the empty tree (re-check it next time).
	 * - Single-tree scan → the same tree (resume with `nextScanStartIndex`).
	 */
	nextScanTreeIndex: bigint;
	/**
	 * Insertion index within `nextScanTreeIndex` to pass as `startIndex`.
	 * Only meaningful for single-tree scans; 0 for multi-tree completions.
	 */
	nextScanStartIndex: bigint;
};

/**
 * Scan one or more Merkle trees for claimable UTXOs.
 *
 * Trees are scanned sequentially from `startTree`.  The first tree uses
 * `startIndex`; all subsequent trees start from insertion index 0.
 *
 * When `endTree` is `undefined` the scanner advances through trees until it
 * finds one that returns zero indexer results from index 0 — a reliable
 * indicator that no further trees have been created by the protocol.
 */
export async function scanAcrossTrees(
	client: UmbraClient,
	startTree: bigint,
	endTree: bigint | undefined,
	startIndex: bigint,
	endIndex: bigint | undefined,
	options: MultiTreeScanOptions = {},
): Promise<MultiTreeScanResult> {
	const {pageSize, onProgress} = options;

	const selfBurnable: ScannedUtxoData[] = [];
	const received: ScannedUtxoData[] = [];
	const publicSelfBurnable: ScannedUtxoData[] = [];
	const publicReceived: ScannedUtxoData[] = [];

	let currentTree = startTree;
	let treeStartIndex = startIndex;
	let lastNextScanStartIndex = startIndex;
	let stoppedByAutoDetect = false;

	while (true) {
		const treeResult = await scanAllUtxos(
			client,
			currentTree,
			treeStartIndex,
			endIndex,
			{
				pageSize,
				onProgress(p) {
					onProgress?.({treeIndex: currentTree, ...p});
				},
			},
		);

		selfBurnable.push(...treeResult.selfBurnable);
		received.push(...treeResult.received);
		publicSelfBurnable.push(...treeResult.publicSelfBurnable);
		publicReceived.push(...treeResult.publicReceived);
		lastNextScanStartIndex = treeResult.nextScanStartIndex;

		if (endTree !== undefined && currentTree >= endTree) break;

		// Auto-detect: a tree that returned no raw indexer data from its start
		// position marks the end of the existing tree sequence.
		if (
			endTree === undefined &&
			treeStartIndex === 0n &&
			treeResult.nextScanStartIndex === 0n
		) {
			stoppedByAutoDetect = true;
			break;
		}

		currentTree += 1n;
		treeStartIndex = 0n;
		lastNextScanStartIndex = 0n;
	}

	const movedTrees = currentTree > startTree;
	let nextScanTreeIndex: bigint;
	let nextScanStartIndex: bigint;

	if (!movedTrees) {
		nextScanTreeIndex = currentTree;
		nextScanStartIndex = lastNextScanStartIndex;
	} else if (stoppedByAutoDetect) {
		nextScanTreeIndex = currentTree;
		nextScanStartIndex = 0n;
	} else {
		nextScanTreeIndex = currentTree + 1n;
		nextScanStartIndex = 0n;
	}

	return {
		selfBurnable,
		received,
		publicSelfBurnable,
		publicReceived,
		nextScanTreeIndex,
		nextScanStartIndex,
	};
}
