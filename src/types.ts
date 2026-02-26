import { TAbstractFile } from "obsidian";

/**
 * Plugin settings persisted via loadData/saveData.
 */
export interface SimplePinSettings {
	/** Show a pin indicator (📌) prefix in the file explorer */
	showPinIndicator: boolean;
	/** Array of pinned file paths (vault-relative) */
	pinnedPaths: string[];
}

export const DEFAULT_SETTINGS: SimplePinSettings = {
	showPinIndicator: true,
	pinnedPaths: [],
};

/**
 * Minimal typing for the internal File Explorer view.
 * These are not part of the public Obsidian API and may change;
 * we access them defensively.
 */
export interface FileExplorerView {
	/** Internal method that triggers a re-sort of the file tree */
	requestSort?(): void;
	/** The root folder item */
	fileItems: Record<string, FileItem>;
	/** The tree/sort related object */
	tree?: unknown;
	/** The sort order string */
	sortOrder?: string;
}

export interface FileItem {
	file: TAbstractFile;
	/** DOM element for this item */
	el?: HTMLElement;
	/** Rendered inner element (title area) */
	innerEl?: HTMLElement;
	/** Self title element */
	selfEl?: HTMLElement;
	/** Children items (for folders) */
	children?: FileItem[];
	/** Vault-change counter for sort invalidation */
	vaultChangeMade?: boolean;
	/** Sort method on folder items */
	sort?(): void;
}
